// ============================================
// Filtro 1 - GPT Snippet (~$0.0001 por chamada)
// FALLBACK: Versao single-call (1 API call por snippet).
// Producao usa filter1GPTBatch.ts (1 call para TODOS, ~90% mais eficiente).
// Mantido para debug de snippets individuais.
// ============================================
// Análise rápida do snippet para eliminar ~80% restante.
// Usa apenas o snippet do Google (sem buscar conteúdo).

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

export async function filter1GPT(snippet: string): Promise<boolean> {
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
    logger.error('Filter1 GPT error:', error);
    return false; // Em caso de erro, rejeita (seguro)
  }
}
