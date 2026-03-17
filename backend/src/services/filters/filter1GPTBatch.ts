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
export async function filter1GPTBatch(snippets: string[]): Promise<boolean[]> {
  if (snippets.length === 0) return [];

  // Se só tem 1 snippet, não precisa de batch
  if (snippets.length === 1) {
    return [await filter1Single(snippets[0])];
  }

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
      logger.error(`[Filter1Batch] Invalid JSON response: ${raw.substring(0, 200)}`);
      return snippets.map(() => true); // Fallback: deixa Filter2 decidir
    }

    // Validar resposta
    if (!Array.isArray(data.results) || data.results.length !== snippets.length) {
      logger.error(`[Filter1Batch] Invalid results length: expected ${snippets.length}, got ${Array.isArray(data.results) ? data.results.length : 'non-array'}`);
      return snippets.map(() => true); // Fallback
    }

    // Garantir que todos são boolean
    return data.results.map((val) => val === true);
  } catch (error) {
    logger.error('[Filter1Batch] GPT error:', error);
    return snippets.map(() => true); // Fallback
  }
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
