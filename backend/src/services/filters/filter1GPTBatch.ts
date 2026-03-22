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

export async function filter1GPTBatch(snippets: string[]): Promise<boolean[]> {
  if (snippets.length === 0) return [];

  // Se só tem 1 snippet, não precisa de batch
  if (snippets.length === 1) {
    return [await filter1Single(snippets[0])];
  }

  // Dividir em chunks pra não estourar context window do GPT
  if (snippets.length > BATCH_CHUNK_SIZE) {
    logger.info(`[Filter1Batch] Splitting ${snippets.length} snippets into chunks of ${BATCH_CHUNK_SIZE}`);
    const results: boolean[] = [];
    for (let i = 0; i < snippets.length; i += BATCH_CHUNK_SIZE) {
      const chunk = snippets.slice(i, i + BATCH_CHUNK_SIZE);
      const chunkResults = await filter1GPTBatchSingle(chunk);
      results.push(...chunkResults);
    }
    return results;
  }

  return filter1GPTBatchSingle(snippets);
}

async function filter1GPTBatchSingle(snippets: string[]): Promise<boolean[]> {
  const prompt = `Analise os seguintes ${snippets.length} snippets de notícias.
Para cada um, determine se é uma notícia de CRIME POLICIAL REAL.

SNIPPETS:
${snippets.map((snippet, index) => `${index}. "${snippet}"`).join('\n')}

Retorne um JSON com array de true/false:
{
  "results": [true, false, true, ...]
}

IMPORTANTE:
- Retorne EXATAMENTE ${snippets.length} valores booleanos
- true = crime policial real (roubo, furto, homicídio, latrocínio, tráfico, assalto)
- false = não é crime (novela, futebol, receita, etc)`;

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

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      logger.error(`[Filter1Batch] Attempt ${attempt}: Invalid JSON response: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return snippets.map(() => true);
    }

    // Validar resposta
    if (!Array.isArray(data.results)) {
      logger.error(`[Filter1Batch] Attempt ${attempt}: results is not array: ${raw.substring(0, 200)}`);
      if (attempt < 2) continue;
      return snippets.map(() => true);
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
    return data.results.map((val) => val === true);
  } catch (error) {
    logger.error(`[Filter1Batch] Attempt ${attempt} GPT error:`, error);
    if (attempt < 2) continue;
    return snippets.map(() => true); // Fallback após 2 tentativas
  }
  } // end for

  return snippets.map(() => true); // Fallback (nunca deve chegar aqui)
}

/**
 * Fallback para snippet único (evita overhead do batch com 1 item).
 */
async function filter1Single(snippet: string): Promise<boolean> {
  const prompt = `Analise o seguinte snippet de notícia e responda APENAS "SIM" ou "NÃO":

Snippet: "${snippet}"

Pergunta: Isso é uma notícia de crime policial real (roubo, furto, homicídio, tráfico, etc)?

Resposta:`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 5,
      temperature: 0,
    });

    const answer = response.choices[0].message.content?.trim().toUpperCase();
    return answer === 'SIM';
  } catch (error) {
    logger.error('[Filter1Single] GPT error:', error);
    return false;
  }
}
