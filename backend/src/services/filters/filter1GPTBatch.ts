// ============================================
// Filtro 1 Batch - GPT Snippet Analysis (UMA chamada para TODOS)
// ============================================
// Substitui N chamadas individuais por 1 chamada batch.
// Economia: ~90% em API calls, ~84% em latência.

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

/**
 * Analisa TODOS os snippets em uma única chamada GPT.
 * Retorna array de booleans na mesma ordem dos snippets.
 *
 * Fallback: se o GPT retornar resposta inválida, assume todos como true
 * (safe default - permite que Filter2 faça análise mais profunda).
 */
const BATCH_CHUNK_SIZE = 30; // Max snippets por chamada GPT (evita estourar context window)

export interface Filter1Result {
  results: boolean[];
  tokensUsed: number;
}

export async function filter1GPTBatch(snippets: string[]): Promise<Filter1Result> {
  if (snippets.length === 0) return { results: [], tokensUsed: 0 };

  // Se só tem 1 snippet, não precisa de batch
  if (snippets.length === 1) {
    const { result, tokensUsed } = await filter1Single(snippets[0]);
    return { results: [result], tokensUsed };
  }

  // Dividir em chunks pra não estourar context window do GPT
  if (snippets.length > BATCH_CHUNK_SIZE) {
    logger.info(`[Filter1Batch] Splitting ${snippets.length} snippets into chunks of ${BATCH_CHUNK_SIZE}`);
    const results: boolean[] = [];
    let totalTokens = 0;
    for (let i = 0; i < snippets.length; i += BATCH_CHUNK_SIZE) {
      const chunk = snippets.slice(i, i + BATCH_CHUNK_SIZE);
      const chunkResult = await filter1GPTBatchSingle(chunk);
      results.push(...chunkResult.results);
      totalTokens += chunkResult.tokensUsed;
    }
    return { results, tokensUsed: totalTokens };
  }

  return filter1GPTBatchSingle(snippets);
}

async function filter1GPTBatchSingle(snippets: string[]): Promise<Filter1Result> {
  const prompt = `Analyze the following ${snippets.length} news snippets.
For each one, determine if it relates to PUBLIC SAFETY (crime, police, security).

SNIPPETS:
${snippets.map((snippet, index) => `${index}. "${snippet}"`).join('\n')}

Return JSON with boolean array:
{"results": [true, false, true, ...]}

RULES:
- Return EXACTLY ${snippets.length} boolean values
- true = ANY public safety content: robbery, theft, murder, drug trafficking, arrest, police operation, seizure, fraud, protest, road blockade, crime statistics, violence indicators
- false = NOT public safety: soap opera, sports, recipe, horoscope, celebrity gossip, entertainment, academic theory with no real data`;

  // Retry 1x antes de fallback "all true"
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0].message.content || '{}';
    const tokensUsed = response.usage?.total_tokens || 0;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.error(`[Filter1Batch] Attempt ${attempt}: Invalid JSON response: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return { results: snippets.map(() => true), tokensUsed };
    }

    // Validar resposta
    if (!Array.isArray(data.results)) {
      logger.error(`[Filter1Batch] Attempt ${attempt}: results is not array: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return { results: snippets.map(() => true), tokensUsed };
    }

    // GPT às vezes retorna ±1-2 itens. Ajustar em vez de descartar tudo.
    if (data.results.length !== snippets.length) {
      logger.warn(`[Filter1Batch] Length mismatch: expected ${snippets.length}, got ${data.results.length}. Adjusting.`);

      if (data.results.length > snippets.length) {
        // Truncar extras
        data.results = data.results.slice(0, snippets.length);
      } else {
        // Paddar faltantes com true (safe: deixa Filter2 decidir)
        while (data.results.length < snippets.length) {
          data.results.push(true);
        }
      }
    }

    // Garantir que todos são boolean
    logger.info(`[Filter1Batch] ${snippets.length} snippets, ${tokensUsed} tokens`);
    return { results: (data.results as unknown[]).map((val: unknown) => val === true), tokensUsed };
  } catch (error) {
    logger.error(`[Filter1Batch] Attempt ${attempt} GPT error:`, error);
    if (attempt < 2) continue;
    return { results: snippets.map(() => true), tokensUsed: 0 };
  }
  } // end for

  return { results: snippets.map(() => true), tokensUsed: 0 };
}

/**
 * Fallback para snippet único (evita overhead do batch com 1 item).
 */
async function filter1Single(snippet: string): Promise<{ result: boolean; tokensUsed: number }> {
  const prompt = `Is this news snippet about a real public safety event or crime statistic?

Snippet: "${snippet}"

Answer ONLY "YES" or "NO":`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    const tokensUsed = response.usage?.total_tokens || 0;
    return { result: answer === 'YES', tokensUsed };
  } catch (error) {
    logger.error('[Filter1Single] GPT error:', error);
    return { result: false, tokensUsed: 0 };
  }
}
