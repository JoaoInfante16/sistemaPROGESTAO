// ============================================
// Cached Embedding Provider (Decorator Pattern)
// ============================================
// Wraps any EmbeddingProvider with Redis cache (TTL configurável).
// Mesmo texto → mesmo embedding (determinístico), seguro cachear por 30 dias.

import crypto from 'crypto';
import { EmbeddingProvider, EmbeddingResult } from './EmbeddingProvider';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

export class CachedEmbeddingProvider implements EmbeddingProvider {
  private realProvider: EmbeddingProvider;

  constructor(realProvider: EmbeddingProvider) {
    this.realProvider = realProvider;
  }

  async generate(text: string): Promise<EmbeddingResult> {
    const textHash = crypto.createHash('md5').update(text).digest('hex');
    const cacheKey = `embedding:${textHash}`;

    // 1. Verificar cache
    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        const parsed = JSON.parse(cached) as EmbeddingResult;
        // Validar dimensão — cache corrompido retorna dimensões erradas
        if (Array.isArray(parsed.embedding) && parsed.embedding.length === 1536) {
          logger.debug('[EmbeddingCache] HIT');
          await redis.incr('cache:embedding:hits').catch(() => {});
          return parsed;
        }
        // Cache corrompido — deletar e regenerar
        logger.warn(`[EmbeddingCache] Corrupted cache (dim=${parsed.embedding?.length}), regenerating`);
        await redis.del(cacheKey).catch(() => {});
      }
    } catch {
      logger.warn('[EmbeddingCache] Redis read failed, generating without cache');
    }

    // 2. Cache MISS: gerar embedding real
    logger.debug('[EmbeddingCache] MISS, generating...');
    const result = await this.realProvider.generate(text);

    // 3. Salvar no cache (TTL configurável, default 30 dias)
    try {
      await redis.setex(cacheKey, config.cacheEmbeddingTtl, JSON.stringify(result));
      await redis.incr('cache:embedding:misses').catch(() => {});
    } catch {
      logger.warn('[EmbeddingCache] Redis write failed, continuing without cache');
    }

    return result;
  }

  async generateBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Separar textos em cached e uncached
    const results: (EmbeddingResult | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const textHash = crypto.createHash('md5').update(texts[i]).digest('hex');
      const cacheKey = `embedding:${textHash}`;

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          results[i] = JSON.parse(cached) as EmbeddingResult;
          await redis.incr('cache:embedding:hits').catch(() => {});
          continue;
        }
      } catch {
        // Redis falhou, vai gerar
      }

      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }

    logger.debug(`[EmbeddingCache] Batch: ${texts.length - uncachedTexts.length} HITs, ${uncachedTexts.length} MISSes`);

    // Gerar embeddings faltantes em batch
    if (uncachedTexts.length > 0) {
      const generated = await this.realProvider.generateBatch(uncachedTexts);

      for (let j = 0; j < uncachedIndices.length; j++) {
        const originalIndex = uncachedIndices[j];
        results[originalIndex] = generated[j];

        // Cachear cada resultado individualmente
        const textHash = crypto.createHash('md5').update(uncachedTexts[j]).digest('hex');
        const cacheKey = `embedding:${textHash}`;
        try {
          await redis.setex(cacheKey, config.cacheEmbeddingTtl, JSON.stringify(generated[j]));
          await redis.incr('cache:embedding:misses').catch(() => {});
        } catch {
          // Falha silenciosa no cache
        }
      }
    }

    return results as EmbeddingResult[];
  }
}
