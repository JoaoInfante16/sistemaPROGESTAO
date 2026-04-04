// ============================================
// Filtro 2 - GPT Full Analysis (~$0.0005 por chamada)
// ============================================
// Análise completa do artigo: extrai dados estruturados.
// Recebe conteúdo completo da Jina, retorna NewsExtraction ou null.

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { NewsExtraction, TipoCrime, TIPO_CRIME_GRUPO, Natureza } from '../../utils/types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface Filter2Result {
  extraction: NewsExtraction | null;
  rejectionReason?: string;
  tokensUsed?: number;
}

const VALID_TIPOS: Set<string> = new Set(Object.keys(TIPO_CRIME_GRUPO));

// Aliases: tipos que o GPT retorna mas não estão nas 15 categorias
const TIPO_ALIAS: Record<string, string> = {
  'estatistica': 'outros',
  'statistic': 'outros',
  'statistics': 'outros',
  'tortura': 'lesao_corporal',
  'torture': 'lesao_corporal',
  'sequestro': 'outros',
  'corrupcao': 'estelionato',
  'extorsao': 'estelionato',
  'feminicidio': 'homicidio',
  'estupro': 'lesao_corporal',
  'incendio': 'vandalismo',
  'porte_arma': 'operacao_policial',
  'contrabando': 'trafico',
};
// Mapeamento nature (EN) → natureza (PT)
const NATURE_MAP: Record<string, Natureza> = {
  'occurrence': 'ocorrencia',
  'statistic': 'estatistica',
  'ocorrencia': 'ocorrencia',   // aceita PT tambem
  'estatistica': 'estatistica',
};

function validateExtraction(data: Record<string, unknown>, minConfidence: number = 0.7): Filter2Result {
  // Mapear campos ingles → portugues (aceita ambos)
  const isCrime = data.is_crime ?? data.e_crime;
  const confidence = (data.confidence ?? data.confianca) as number | undefined;
  const crimeType = ((data.crime_type ?? data.tipo_crime) as string | undefined)?.trim() ?? '';
  const nature = (data.nature ?? data.natureza) as string | undefined;
  const city = ((data.city ?? data.cidade) as string | undefined)?.trim() ?? '';
  const summary = ((data.summary ?? data.resumo) as string | undefined)?.trim() ?? '';
  const date = ((data.date ?? data.data_ocorrencia) as string | undefined)?.trim() ?? '';
  const neighborhood = (data.neighborhood ?? data.bairro) as string | undefined;
  const street = (data.street ?? data.rua) as string | undefined;

  // is_crime deve ser true
  if (isCrime !== true) return { extraction: null, rejectionReason: `e_crime=${isCrime}` };

  // Confianca: numero entre 0.0 e 1.0
  if (typeof confidence !== 'number' || confidence < minConfidence || confidence > 1.0) {
    return { extraction: null, rejectionReason: `confianca=${confidence} (min=${minConfidence})` };
  }

  // tipo_crime: deve ser uma das 15 categorias (ou alias)
  const mappedType = VALID_TIPOS.has(crimeType) ? crimeType : (TIPO_ALIAS[crimeType] || null);
  if (!mappedType) {
    return { extraction: null, rejectionReason: `tipo_crime_invalido=${crimeType}` };
  }

  // natureza: mapear EN→PT (default: ocorrencia)
  const natureza = (nature && NATURE_MAP[nature]) ? NATURE_MAP[nature] : 'ocorrencia';

  // categoria_grupo: derivado do tipo_crime (mapeado)
  const categoriaGrupo = TIPO_CRIME_GRUPO[mappedType as TipoCrime];

  // cidade e resumo obrigatorios
  if (city.length === 0) return { extraction: null, rejectionReason: 'cidade_vazia' };
  if (summary.length === 0) return { extraction: null, rejectionReason: 'resumo_vazio' };

  // data: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { extraction: null, rejectionReason: `data_invalida=${date}` };
  }

  const bairro = typeof neighborhood === 'string' && neighborhood.trim() ? neighborhood.trim() : undefined;
  const rua = typeof street === 'string' && street.trim() ? street.trim() : undefined;

  return {
    extraction: {
      e_crime: true,
      tipo_crime: mappedType as TipoCrime,
      natureza,
      categoria_grupo: categoriaGrupo,
      cidade: city,
      bairro,
      rua,
      data_ocorrencia: date,
      resumo: summary,
      confianca: confidence,
    },
  };
}

interface Filter2Options {
  maxContentChars?: number;
  minConfidence?: number;
}

export async function filter2GPT(content: string, options: Filter2Options = {}): Promise<NewsExtraction | null> {
  const result = await filter2GPTWithReason(content, options);
  return result.extraction;
}

export async function filter2GPTWithReason(content: string, options: Filter2Options = {}): Promise<Filter2Result> {
  const { maxContentChars = 4000, minConfidence = 0.7 } = options;
  const truncated = content.substring(0, maxContentChars);

  const prompt = `Analyze the following news article and extract structured data as JSON.

RULES:
1. "is_crime": true for ANY public safety content: police occurrences, crimes, operations, crime statistics, protests, road blockades.
2. "is_crime": false ONLY for: academic essays, opinion editorials, category/tag pages, or content unrelated to public safety.
3. "nature": "occurrence" for individual events (robbery at store X, murder in neighborhood Y). "statistic" for aggregated data (robberies up 20%, violence index drops).
4. "date": MUST be the article's PUBLICATION DATE, not dates mentioned in the article body. Look for date in the header, byline, or URL. If unsure, use today's date.

MANDATORY CATEGORIES for "crime_type" (use EXACTLY one):
- roubo_furto: robbery, theft, mugging, looting
- vandalismo: vandalism, property destruction
- invasao: invasion, occupation, looting
- homicidio: homicide, femicide, murder
- latrocinio: robbery followed by death
- lesao_corporal: assault, fight, attempted murder
- trafico: drug trafficking, drug seizure
- operacao_policial: police operation, raid, warrant, arrest, weapon seizure
- manifestacao: protest, demonstration, riot
- bloqueio_via: road blockade, street interdiction
- estelionato: scam, fraud
- receptacao: receiving stolen goods, chop shop
- crime_ambiental: environmental crime, pollution
- trabalho_irregular: slave labor, irregular labor
- outros: does not fit above categories

ARTICLE:
${truncated}

Return ONLY JSON:
{
  "is_crime": true/false,
  "crime_type": "one of 15 categories above",
  "nature": "occurrence" or "statistic",
  "city": "City Name",
  "neighborhood": "Neighborhood Name" or null,
  "street": "Street Name" or null,
  "date": "YYYY-MM-DD (publication date of the article, NOT dates mentioned in the text)",
  "summary": "1-2 sentence summary in Brazilian Portuguese",
  "confidence": 0.0 to 1.0
}

If NOT about public safety, return: {"is_crime": false}`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content || '{}';
    const tokensUsed = response.usage?.total_tokens || 0;
    logger.debug(`[Filter2] content preview: ${truncated.substring(0, 150).replace(/\n/g, ' ')}...`);
    logger.debug(`[Filter2] GPT response: ${raw.substring(0, 300)} (${tokensUsed} tokens)`);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.error(`Filter2 GPT: invalid JSON response: ${raw.substring(0, 200)}`);
      return { extraction: null, rejectionReason: 'json_invalido', tokensUsed };
    }

    const result = validateExtraction(data, minConfidence);
    return { ...result, tokensUsed };
  } catch (error) {
    logger.error('Filter2 GPT error:', error);
    return { extraction: null, rejectionReason: `gpt_error: ${(error as Error).message}`, tokensUsed: 0 };
  }
}
