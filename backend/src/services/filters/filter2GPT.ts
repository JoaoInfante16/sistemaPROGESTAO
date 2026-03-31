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
}

const VALID_TIPOS: Set<string> = new Set(Object.keys(TIPO_CRIME_GRUPO));
const VALID_NATUREZAS: Set<string> = new Set(['ocorrencia', 'estatistica']);

function validateExtraction(data: Record<string, unknown>, minConfidence: number = 0.7): Filter2Result {
  // e_crime deve ser true
  if (data.e_crime !== true) return { extraction: null, rejectionReason: `e_crime=${data.e_crime}` };

  // Confianca: numero entre 0.0 e 1.0, minimo configuravel
  if (typeof data.confianca !== 'number' || data.confianca < minConfidence || data.confianca > 1.0) {
    return { extraction: null, rejectionReason: `confianca=${data.confianca} (min=${minConfidence})` };
  }

  // tipo_crime: deve ser uma das 15 categorias padronizadas
  const tipoCrime = typeof data.tipo_crime === 'string' ? data.tipo_crime.trim() : '';
  if (!VALID_TIPOS.has(tipoCrime)) {
    return { extraction: null, rejectionReason: `tipo_crime_invalido=${data.tipo_crime}` };
  }

  // natureza: ocorrencia ou estatistica (default: ocorrencia)
  const natureza = typeof data.natureza === 'string' && VALID_NATUREZAS.has(data.natureza)
    ? data.natureza as Natureza
    : 'ocorrencia';

  // categoria_grupo: derivado do tipo_crime (ignora o que GPT retornar)
  const categoriaGrupo = TIPO_CRIME_GRUPO[tipoCrime as TipoCrime];

  // cidade e resumo obrigatorios
  if (typeof data.cidade !== 'string' || data.cidade.trim().length === 0) return { extraction: null, rejectionReason: 'cidade_vazia' };
  if (typeof data.resumo !== 'string' || data.resumo.trim().length === 0) return { extraction: null, rejectionReason: 'resumo_vazio' };

  // data_ocorrencia: YYYY-MM-DD
  if (typeof data.data_ocorrencia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.data_ocorrencia)) {
    return { extraction: null, rejectionReason: `data_invalida=${data.data_ocorrencia}` };
  }

  const bairro = typeof data.bairro === 'string' ? data.bairro : undefined;
  const rua = typeof data.rua === 'string' ? data.rua : undefined;

  return {
    extraction: {
      e_crime: true,
      tipo_crime: tipoCrime as TipoCrime,
      natureza,
      categoria_grupo: categoriaGrupo,
      cidade: data.cidade as string,
      bairro,
      rua,
      data_ocorrencia: data.data_ocorrencia as string,
      resumo: data.resumo as string,
      confianca: data.confianca as number,
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

  const prompt = `Analise a seguinte notícia e extraia dados estruturados em JSON.

REGRAS:
1. "e_crime": true para QUALQUER notícia sobre segurança pública: ocorrências policiais, crimes, operações, estatísticas criminais, manifestações, bloqueios.
2. "e_crime": false APENAS para: artigos acadêmicos, editoriais de opinião, páginas de categoria/tag, ou conteúdo sem relação com segurança pública.
3. "natureza": "ocorrencia" para fatos individuais (roubo na loja X, homicídio no bairro Y). "estatistica" para dados agregados (roubos sobem 20%, índice de violência cai).

CATEGORIAS OBRIGATÓRIAS para "tipo_crime" (use EXATAMENTE um destes valores):
- roubo_furto: assalto, furto, roubo, arrastão
- vandalismo: depredação, quebra-quebra, pichação
- invasao: ocupação, invasão, saque
- homicidio: homicídio, feminicídio, assassinato
- latrocinio: roubo seguido de morte
- lesao_corporal: agressão, briga, tentativa de homicídio
- trafico: tráfico de drogas, apreensão de drogas
- operacao_policial: operação, batida, mandado, prisão, flagrante, apreensão de armas
- manifestacao: protesto, manifestação, tumulto
- bloqueio_via: interdição, bloqueio de rua/estrada
- estelionato: golpe, fraude, estelionato
- receptacao: venda de produto roubado, desmanche
- crime_ambiental: desmatamento, poluição, crime ambiental
- trabalho_irregular: trabalho escravo, trabalho irregular
- outros: não se encaixa nas categorias acima

NOTÍCIA:
${truncated}

Retorne APENAS JSON:
{
  "e_crime": true/false,
  "tipo_crime": "uma das 15 categorias acima",
  "natureza": "ocorrencia" ou "estatistica",
  "cidade": "Nome da Cidade",
  "bairro": "Nome do Bairro" ou null,
  "rua": "Nome da Rua" ou null,
  "data_ocorrencia": "YYYY-MM-DD",
  "resumo": "Resumo em 1-2 frases",
  "confianca": 0.0 a 1.0
}

Se NÃO for sobre segurança pública, retorne: {"e_crime": false}`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content || '{}';
    logger.debug(`[Filter2] content preview: ${truncated.substring(0, 150).replace(/\n/g, ' ')}...`);
    logger.debug(`[Filter2] GPT response: ${raw.substring(0, 300)}`);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.error(`Filter2 GPT: invalid JSON response: ${raw.substring(0, 200)}`);
      return { extraction: null, rejectionReason: 'json_invalido' };
    }

    return validateExtraction(data, minConfidence);
  } catch (error) {
    logger.error('Filter2 GPT error:', error);
    return { extraction: null, rejectionReason: `gpt_error: ${(error as Error).message}` };
  }
}
