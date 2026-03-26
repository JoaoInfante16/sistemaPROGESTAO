// ============================================
// Filtro 2 - GPT Full Analysis (~$0.0005 por chamada)
// ============================================
// Análise completa do artigo: extrai dados estruturados.
// Recebe conteúdo completo da Jina, retorna NewsExtraction ou null.

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { NewsExtraction } from '../../utils/types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export interface Filter2Result {
  extraction: NewsExtraction | null;
  rejectionReason?: string;
}

/**
 * FIX #4: Valida TODOS os campos obrigatórios antes de retornar.
 * Sem mais `as unknown as NewsExtraction` inseguro.
 */
function validateExtraction(data: Record<string, unknown>, minConfidence: number = 0.7): Filter2Result {
  // Campo obrigatório: e_crime deve ser true
  if (data.e_crime !== true) return { extraction: null, rejectionReason: `e_crime=${data.e_crime}` };

  // Confiança: número entre 0.0 e 1.0, mínimo configurável via admin panel
  if (typeof data.confianca !== 'number' || data.confianca < minConfidence || data.confianca > 1.0) {
    return { extraction: null, rejectionReason: `confianca=${data.confianca} (min=${minConfidence})` };
  }

  // tipo_crime: qualquer string não-vazia
  if (typeof data.tipo_crime !== 'string' || data.tipo_crime.trim().length === 0) {
    return { extraction: null, rejectionReason: `tipo_crime_invalido=${data.tipo_crime}` };
  }

  // cidade e resumo: strings obrigatórias
  if (typeof data.cidade !== 'string' || data.cidade.trim().length === 0) return { extraction: null, rejectionReason: 'cidade_vazia' };
  if (typeof data.resumo !== 'string' || data.resumo.trim().length === 0) return { extraction: null, rejectionReason: 'resumo_vazio' };

  // data_ocorrencia: string no formato YYYY-MM-DD
  if (typeof data.data_ocorrencia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.data_ocorrencia)) {
    return { extraction: null, rejectionReason: `data_invalida=${data.data_ocorrencia}` };
  }

  // Campos opcionais: bairro e rua (string ou null)
  const bairro = typeof data.bairro === 'string' ? data.bairro : undefined;
  const rua = typeof data.rua === 'string' ? data.rua : undefined;

  return {
    extraction: {
      e_crime: true,
      tipo_crime: data.tipo_crime as NewsExtraction['tipo_crime'],
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

IMPORTANTE: Considere como "e_crime": true QUALQUER notícia que relate uma ocorrência policial REAL e INDIVIDUAL.
Exemplos: roubo, furto, homicídio, tráfico, assalto, prisão, apreensão, operação policial, flagrante, acidente com vítima, feminicídio, estelionato, sequestro, perseguição, mandado de busca, etc.

Retorne "e_crime": false APENAS para: estatísticas gerais, artigos acadêmicos, editoriais de opinião, páginas de categoria/tag, ou conteúdo que NÃO descreva um fato policial específico.

NOTÍCIA:
${truncated}

Retorne APENAS um JSON no formato:
{
  "e_crime": true/false,
  "tipo_crime": "tipo do crime ou ocorrência (ex: roubo, prisão, homicídio, operação policial, etc.)",
  "cidade": "Nome da Cidade",
  "bairro": "Nome do Bairro" ou null,
  "rua": "Nome da Rua" ou null,
  "data_ocorrencia": "YYYY-MM-DD",
  "resumo": "Resumo em 1-2 frases do que aconteceu",
  "confianca": 0.0 a 1.0 (quão certo você está que é notícia de ocorrência policial)
}

Se NÃO for notícia de ocorrência policial individual, retorne: {"e_crime": false}`;

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
