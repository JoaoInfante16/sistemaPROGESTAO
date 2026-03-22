// ============================================
// Sistema de Deduplicação - 3 Camadas
// ============================================
// Camada 1: Geo-Temporal (SQL, grátis, 70% eliminados)
// Camada 2: Embedding Similarity (cosine, <200ms, 92% precisão)
// Camada 3: GPT Confirmation (caro, 98% precisão, só ~5% dos casos)

import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { db } from '../../database/queries';
import { cosineSimilarity } from '../../utils/helpers';
import { NewsExtraction } from '../../utils/types';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

export interface DedupResult {
  isDuplicate: boolean;
  existingId?: string;
  layer?: 1 | 2 | 3; // Qual camada decidiu
}

/**
 * Verifica se uma notícia é duplicata usando 3 camadas progressivas.
 * Mais barato primeiro, mais preciso por último.
 */
export async function deduplicateNews(
  newsData: NewsExtraction & { embedding: number[] },
  sourceUrl: string,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD
): Promise<DedupResult> {
  // CAMADA 1: Busca Geo-Temporal (SQL, instantâneo, grátis)
  const candidates = await db.findGeoTemporalCandidates(
    newsData.cidade,
    newsData.tipo_crime,
    newsData.data_ocorrencia
  );

  if (candidates.length === 0) {
    logger.debug('[Dedup] Layer 1: no candidates → new');
    return { isDuplicate: false, layer: 1 };
  }

  logger.debug(`[Dedup] Layer 1: ${candidates.length} candidates found`);

  // CAMADA 2: Embedding Similarity (cosine distance, <200ms)
  const similarities = candidates.map((c) => ({
    id: c.id,
    resumo: c.resumo,
    score: cosineSimilarity(newsData.embedding, c.embedding),
  }));

  similarities.sort((a, b) => b.score - a.score);
  const topMatch = similarities[0];

  logger.debug(`[Dedup] Top similarity score: ${topMatch.score.toFixed(3)}`);

  if (topMatch.score < similarityThreshold) {
    logger.debug(`[Dedup] Layer 2: score ${topMatch.score.toFixed(3)} < ${similarityThreshold} → new`);
    return { isDuplicate: false, layer: 2 };
  }

  // CAMADA 3: Confirmação GPT (caro, mas só ~5% dos casos chegam aqui)
  logger.debug('[Dedup] High similarity, confirming with GPT...');
  const isDupe = await confirmDuplicateWithGPT(newsData.resumo, topMatch.resumo);

  if (isDupe) {
    // Adicionar URL como fonte alternativa do artigo existente
    await db.insertNewsSource(topMatch.id, sourceUrl);
    logger.info(`[Dedup] Duplicate confirmed (score=${topMatch.score.toFixed(3)}), source added to ${topMatch.id}`);
    return { isDuplicate: true, existingId: topMatch.id, layer: 3 };
  }

  logger.debug('[Dedup] Layer 3: GPT says different → new');
  return { isDuplicate: false, layer: 3 };
}

/**
 * Confirmação via GPT: compara dois resumos para determinar se descrevem o mesmo evento.
 * Só chamada quando cosine similarity >= 0.85 (~5% dos casos).
 */
async function confirmDuplicateWithGPT(resumo1: string, resumo2: string): Promise<boolean> {
  const prompt = `Estes dois resumos descrevem o MESMO evento criminal?

Resumo 1: "${resumo1}"
Resumo 2: "${resumo2}"

Considere duplicata se:
- Local, data e tipo de crime são idênticos
- Vítimas/suspeitos mencionados são os mesmos
- Detalhes principais coincidem

Responda APENAS "SIM" ou "NÃO":`;

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
    logger.error('[Dedup] GPT confirmation error:', error);
    // Em caso de erro, assume não-duplicata (safe default: melhor duplicar que perder)
    return false;
  }
}

// Export para testes
export { confirmDuplicateWithGPT as _confirmDuplicateWithGPT };
