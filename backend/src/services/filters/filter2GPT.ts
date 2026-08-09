// ============================================
// Filtro 2 - GPT Full Analysis (~$0.0005 por chamada)
// ============================================
// Análise completa do artigo: extrai dados estruturados.
// Recebe conteúdo completo da Jina, retorna NewsExtraction ou null.

import * as Sentry from '@sentry/node';
import { openai } from '../openaiClient';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { NewsExtraction, TipoCrime, TIPO_CRIME_GRUPO, Natureza } from '../../utils/types';


export interface Filter2Result {
  extraction: NewsExtraction | null;
  rejectionReason?: string;
  tokensUsed?: number;
}

const VALID_TIPOS: Set<string> = new Set(Object.keys(TIPO_CRIME_GRUPO));

// Aliases: tipos que o GPT retorna mas não estão nas 15 categorias
const TIPO_ALIAS: Record<string, string> = {
  'statistic': 'estatistica',
  'statistics': 'estatistica',
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

/**
 * Corta o resumo no fim de uma FRASE, nunca no meio de uma palavra.
 *
 * O prompt pede 190 caracteres, e o modelo passa às vezes — o mesmo aconteceu
 * com a manchete de 70. A diferença é que reticências no fim de um titulo sao
 * toleráveis e no fim de um parágrafo sao um bug: o leitor fica sem o desfecho
 * ("...dois deles com registro de rou").
 *
 * Então: pega o maior prefixo que termine em `.`, `!` ou `?` e caiba no teto.
 * Se nem a primeira frase couber (caso raro, o modelo ignorou o pedido), aí
 * sim corta na palavra e marca com reticências — mas isso e o ultimo recurso,
 * não o caminho normal.
 */
export function cortarNaFrase(texto: string, teto: number): string {
  const limpo = texto.trim();
  if (limpo.length <= teto) return limpo;

  // Última pontuação de fim de frase dentro do teto.
  let corte = -1;
  for (let i = 0; i < Math.min(limpo.length, teto); i++) {
    const c = limpo[i];
    if (c === '.' || c === '!' || c === '?') corte = i;
  }
  if (corte > 0) return limpo.slice(0, corte + 1).trim();

  const espaco = limpo.lastIndexOf(' ', teto - 1);
  return `${limpo.slice(0, espaco > 0 ? espaco : teto - 1).trim()}…`;
}

function validateExtraction(data: Record<string, unknown>, minConfidence: number = 0.7): Filter2Result {
  // Mapear campos ingles → portugues (aceita ambos)
  const isCrime = data.is_crime ?? data.e_crime;
  const confidence = (data.confidence ?? data.confianca) as number | undefined;
  const crimeType = ((data.crime_type ?? data.tipo_crime) as string | undefined)?.trim() ?? '';
  const nature = (data.nature ?? data.natureza) as string | undefined;
  const city = ((data.city ?? data.cidade) as string | undefined)?.trim() ?? '';
  const summary = ((data.summary ?? data.resumo) as string | undefined)?.trim() ?? '';
  const headline = ((data.headline ?? data.titulo) as string | undefined)?.trim() ?? '';
  const date = ((data.date ?? data.data_ocorrencia) as string | undefined)?.trim() ?? '';
  const time = ((data.time ?? data.hora) as string | undefined)?.trim() ?? '';
  const state = ((data.state ?? data.estado) as string | undefined)?.trim() ?? '';
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

  // data: YYYY-MM-DD, nao pode ser futura
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { extraction: null, rejectionReason: `data_invalida=${date}` };
  }
  const today = new Date().toISOString().split('T')[0];
  if (date > today) {
    return { extraction: null, rejectionReason: `data_futura=${date}` };
  }

  const bairro = typeof neighborhood === 'string' && neighborhood.trim() ? neighborhood.trim() : undefined;
  const rua = typeof street === 'string' && street.trim() ? street.trim() : undefined;

  // O resumo cabe INTEIRO no card, sem "ler mais" e sem reticencias.
  //
  // A medida nao e chute: o card tem 376px uteis e a lide e Archivo 14.5, o que
  // da ~52 caracteres por linha; os dois paragrafos do prototipo de referencia
  // tem 189 e 197 caracteres, ou seja quatro linhas. O teto de 195 reproduz
  // isso, e o `maxLines: 5` do TakeCard cobre o pior caso tipografico (4.5
  // linhas se o texto for todo de caracteres largos).
  //
  // Isso e o que permite o toque ter UM significado so — abrir a fonte. Enquanto
  // o texto era truncado, tocar podia querer dizer "ler o resto" ou "abrir o
  // artigo", e o usuario nao sabia qual antes de tocar.
  const resumo = cortarNaFrase(summary, 195);

  // Hora de publicacao (migration 030). Cosmetica: NUNCA rejeita o item.
  //
  // Aceita so `HH:MM` valido — o modelo as vezes devolve "14h32", "por volta
  // das 3h" ou a string "null". Qualquer coisa fora do formato vira undefined,
  // e o app **omite o carimbo** em vez de exibir 00:00, que era o bug que esta
  // coluna existe pra corrigir: `data_ocorrencia` e DATE, entao a hora lida
  // dela era meia-noite em 100% dos itens.
  const horaOk = /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  const horaPublicacao = horaOk ? time : undefined;

  // Manchete: cosmetica, entao NUNCA rejeita o item.
  //
  // Corta em 70, o MESMO teto que o prompt pede (a regra 9). Cortava em 90, e
  // isso era incoerencia minha: o app le manchete em Archivo 23 sobre 376px
  // uteis, ~32 caracteres por linha — 70 dao 2.2 linhas e cabem no maxLines: 2
  // do TakeCard, 90 dao 2.8 e estouravam com reticencias. Deixar o codigo mais
  // frouxo que o prompt so servia pra esconder quando o modelo desobedecia.
  const titulo = headline.length > 0 ? headline.substring(0, 70).trim() : undefined;

  return {
    extraction: {
      e_crime: true,
      tipo_crime: mappedType as TipoCrime,
      natureza,
      categoria_grupo: categoriaGrupo,
      cidade: city,
      estado: state || undefined,
      bairro,
      rua,
      data_ocorrencia: date,
      hora_publicacao: horaPublicacao,
      titulo,
      resumo,
      confianca: confidence,
    },
  };
}

interface Filter2Options {
  maxContentChars?: number;
  minConfidence?: number;
  /**
   * Assuntos que o usuario escolheu na tela (03/08). Presentes, viram a regra 0
   * do prompt: o que ele pediu e relevante, mesmo sem crime.
   *
   * Ausentes (auto-scan e busca sem escolha), o prompt fica identico ao de
   * sempre — este e o segundo portao, e o primeiro e o Filter1, que recebe o
   * mesmo contexto.
   */
  assuntos?: string[];
}

export async function filter2GPT(content: string, options: Filter2Options = {}): Promise<NewsExtraction | null> {
  const result = await filter2GPTWithReason(content, options);
  return result.extraction;
}

export async function filter2GPTWithReason(content: string, options: Filter2Options = {}): Promise<Filter2Result> {
  const { maxContentChars = 4000, minConfidence = 0.7, assuntos } = options;
  const truncated = content.substring(0, maxContentChars);

  // Regra 0 quando o usuario escolheu os assuntos: o que ele perguntou vale,
  // ainda que nao seja crime. Sem isso, greve pacifica e materia fora do
  // vocabulario de crime chegam ate aqui (ja pagas em SERP + Jina) e sao
  // descartadas no ultimo metro — o pior lugar possivel pra perder.
  const contextoUsuario = assuntos?.length
    ? `\n0. THE USER EXPLICITLY SEARCHED FOR: ${assuntos.join(', ')}. An article about ANY of these subjects IS relevant — set "is_crime": true even when no crime occurred (a peaceful strike, a labor stoppage, a road blockade, a protest). Classify it with the closest "crime_type" below, or "outros" when none fits. This rule wins over rule 2.`
    : '';

  const prompt = `Analyze the following news article and extract structured data as JSON.

RULES:${contextoUsuario}
1. "is_crime": true for ANY public safety content: police occurrences, crimes, operations, crime statistics, protests, strikes, labor stoppages, road blockades.
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
- manifestacao: protest, demonstration, riot, strike, labor stoppage
- bloqueio_via: road blockade, street interdiction
- estelionato: scam, fraud
- receptacao: receiving stolen goods, chop shop
- crime_ambiental: environmental crime, pollution
- trabalho_irregular: slave labor, irregular labor
- outros: does not fit above categories

LOCATION RULES:
5. "city" MUST be the MUNICIPALITY (cidade/município) where the crime physically happened. NOT the state, NOT a nearby city.
6. "neighborhood" is a subdivision WITHIN the city (bairro/distrito). Another municipality is NOT a neighborhood. Examples: "Pinheiros" is a neighborhood of São Paulo. "São José dos Campos" is a SEPARATE CITY, not a neighborhood.
7. "state" must be the Brazilian state of that city. IMPORTANT: "São Paulo" can be both a state AND a city — use "São Paulo" as state only if referring to the state, and as city only if the crime happened in the city of São Paulo itself.
8. If the article does not specify the exact city, use the most specific location mentioned.

HEADLINE RULES:
9. "headline": WRITE a short factual headline in Brazilian Portuguese, max 70 characters. Do NOT copy the source's headline — Brazilian crime outlets write sensationalist titles and this product is a sober work tool for public-safety professionals.
10. State what happened and where. Journalistic present tense ("Homem é preso após...", not "Homem foi preso"). No ALL CAPS, no exclamation marks, no "VEJA", "URGENTE", "CHOCANTE", no value judgments, no victim/suspect full names, no gore.
11. The headline must stand alone: a reader seeing only it should know the event. It is NOT a shortened summary — "summary" adds the detail the headline leaves out, so avoid repeating the headline verbatim there.

PUBLICATION TIME:
16. "time": the time the OUTLET published the article, exactly as printed on the page ("Publicado em 04/08/2026 às 14:32" → "14:32"). 24h format "HH:MM". Return null if the page does not state a time — do NOT guess it, do NOT use a time mentioned inside the story ("por volta das 3h da madrugada" is when the event happened, which is approximate and sometimes another day).

SUMMARY RULES:
12. "summary": Brazilian Portuguese, **at most 190 characters in total**. Use as many sentences as the event actually needs — usually 2, sometimes 1 when the fact is simple. The ceiling is a hard budget, not a target: the app prints the summary WHOLE, with no "read more", and anything past it is cut by the server. Never pad to reach the limit.

13. The summary must be COMPLEMENTARY to the headline, never a paraphrase of it. The reader has already read the headline; every clause here must earn its place by adding something the headline could not fit: exact figures, the force that acted, what was seized or recovered, how many people, the trigger, the outcome.

    Headline: "Empresário é preso vendendo peças de veículos roubados"
    BAD  (says the same thing again): "Um empresário foi preso por vender peças de veículos roubados. A prisão aconteceu em flagrante."
    GOOD (adds what the headline left out): "A Operação 311 prendeu o homem em flagrante em Palhoça. Foram apreendidos componentes de sete veículos, dois deles com registro de roubo."

14. Sentence 1 carries the specifics of the event; the next one carries the consequence or what came out of it. Every sentence must stand without the headline — do not start with "ele", "o caso" or any pronoun pointing back at the headline.

15. No speculation, no adjectives of severity, no victim/suspect full names. If the article does not say something, leave it out — a summary of 120 characters that adds facts beats one of 190 that repeats the headline.

ARTICLE:
${truncated}

Return ONLY JSON:
{
  "is_crime": true/false,
  "crime_type": "one of 15 categories above",
  "nature": "occurrence" or "statistic",
  "city": "Municipality where the crime happened (cidade/município)",
  "state": "Brazilian State of that municipality" or null,
  "neighborhood": "Neighborhood/bairro within the city" or null,
  "street": "Street Name" or null,
  "date": "YYYY-MM-DD (publication date of the article, NOT dates mentioned in the text)",
  "time": "HH:MM as printed by the outlet" or null,
  "headline": "Factual headline in Brazilian Portuguese, max 70 chars, neutral tone",
  "summary": "2 sentences in Brazilian Portuguese, max 190 chars TOTAL, first sentence self-contained",
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
    Sentry.captureException(error, { tags: { provider: 'openai', stage: 'filter2' } });
    logger.error('Filter2 GPT error:', error);
    return { extraction: null, rejectionReason: `gpt_error: ${(error as Error).message}`, tokensUsed: 0 };
  }
}
