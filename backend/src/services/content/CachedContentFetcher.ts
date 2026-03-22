// ============================================
// Cached Content Fetcher (Decorator Pattern)
// ============================================
// Wraps any ContentFetcher with Redis cache (TTL configurável).
// Evita re-baixar conteúdo de URLs já processadas.
// CRÍTICO: NÃO cachear Google Search results! Apenas conteúdo Jina.

import crypto from 'crypto';
import { ContentFetcher, FetchedContent } from './ContentFetcher';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

export class CachedContentFetcher implements ContentFetcher {
  private realFetcher: ContentFetcher;

  constructor(realFetcher: ContentFetcher) {
    this.realFetcher = realFetcher;
  }

  async fetch(url: string): Promise<FetchedContent> {
    const urlHash = crypto.createHash('md5').update(url).digest('hex');
    const cacheKey = `content:${urlHash}`;

    // 1. Verificar cache
    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        logger.debug(`[ContentCache] HIT for ${url}`);
        await redis.incr('cache:content:hits').catch(() => {});
        return JSON.parse(cached) as FetchedContent;
      }
    } catch {
      // Se Redis falhar, segue sem cache (graceful degradation)
      logger.warn('[ContentCache] Redis read failed, fetching without cache');
    }

    // 2. Cache MISS: buscar conteúdo real
    logger.debug(`[ContentCache] MISS for ${url}, fetching...`);
    const result = await this.realFetcher.fetch(url);

    // 3. Salvar no cache APENAS se tiver conteúdo real (>100 chars)
    if (result.content.trim().length > 100) {
      try {
        await redis.setex(cacheKey, config.cacheJinaContentTtl, JSON.stringify(result));
        await redis.incr('cache:content:misses').catch(() => {});
        logger.debug(`[ContentCache] Cached ${url} (TTL ${config.cacheJinaContentTtl}s)`);
      } catch {
        logger.warn('[ContentCache] Redis write failed, continuing without cache');
      }
    } else {
      logger.warn(`[ContentCache] NOT caching empty/short content for ${url.substring(0, 60)} (${result.content.length} chars)`);
    }

    return result;
  }
}
