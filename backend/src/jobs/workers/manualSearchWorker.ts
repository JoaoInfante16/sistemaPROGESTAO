// ============================================
// Manual Search Worker - BullMQ
// ============================================
// Processa buscas manuais individuais.
// Reutiliza pipeline core mas salva em search_results (por usuário).
// NÃO faz: dedup contra news universal, push, updateLocationLastCheck.

import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../config/redis';
import { createSearchProvider } from '../../services/search';
import { createContentFetcher } from '../../services/content';
// Embedding not needed for manual search (results aren't saved to news table)
import { filter0Regex } from '../../services/filters/filter0Regex';
import { filter1GPTBatch } from '../../services/filters/filter1GPTBatch';
import { filter2GPT } from '../../services/filters/filter2GPT';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { asyncPool } from '../../utils/helpers';
import { FetchedContent } from '../../services/content/ContentFetcher';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';

const searchProvider = createSearchProvider();
const contentFetcher = createContentFetcher();

export const manualSearchQueue = new Queue('manual-search-queue', { connection: redis });

export interface ManualSearchJobData {
  searchId: string;
  userId: string;
  estado: string;
  cidade: string;
  periodoDias: number;
  tipoCrime?: string;
}

async function processManualSearch(job: Job<ManualSearchJobData>): Promise<void> {
  const { searchId, estado, cidade, periodoDias, tipoCrime } = job.data;
  const startTime = Date.now();

  try {
    const pipelineConfig = {
      searchMaxResults: await configManager.getNumber('search_max_results'),
      contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
    };

    // Build query
    const crimeKeywords = tipoCrime || 'crime polícia assalto roubo';
    const query = `${crimeKeywords} ${cidade} ${estado} site:.br`;
    logger.info(`[ManualSearch] ${searchId} query: ${query}`);

    // 1. Google Search
    const searchResults = await rateLimiter.schedule('google', () =>
      searchProvider.search(query, { maxResults: pipelineConfig.searchMaxResults })
    );
    logger.info(`[ManualSearch] ${searchId} found ${searchResults.length} URLs`);

    await db.trackCost({
      source: 'manual_search',
      provider: 'google',
      cost_usd: searchResults.length > 0 ? 0.005 : 0,
      details: { searchId, query, resultsCount: searchResults.length },
    });

    // 2. Filter 0 - Regex
    const afterFilter0 = searchResults.filter((r) => filter0Regex(r.url, r.snippet));

    // 3. Filter 1 - GPT Batch
    const snippets = afterFilter0.map((r) => r.snippet);
    const batchResults = await rateLimiter.schedule('openai', () =>
      filter1GPTBatch(snippets)
    );
    const afterFilter1 = afterFilter0.filter((_, index) => batchResults[index]);

    await db.trackCost({
      source: 'manual_search',
      provider: 'openai',
      cost_usd: afterFilter0.length > 0 ? 0.0002 : 0,
      details: { searchId, stage: 'filter1_batch', snippetCount: afterFilter0.length },
    });

    if (afterFilter1.length === 0) {
      await db.updateSearchStatus(searchId, 'completed', 0);
      logger.info(`[ManualSearch] ${searchId} completed with 0 results`);
      return;
    }

    // 4. Content Fetch via Jina
    const contentResults = await asyncPool<typeof afterFilter1[0], FetchedContent | null>(
      afterFilter1,
      pipelineConfig.contentFetchConcurrency,
      async (r) => {
        try {
          return await rateLimiter.schedule('jina', () => contentFetcher.fetch(r.url));
        } catch (err) {
          logger.error(`[ManualSearch] Failed to fetch ${r.url}: ${(err as Error).message}`);
          return null;
        }
      }
    );
    const validContents = contentResults.filter((c): c is FetchedContent => c !== null);

    await db.trackCost({
      source: 'manual_search',
      provider: 'jina',
      cost_usd: validContents.length * 0.002,
      details: { searchId, stage: 'fetch', count: validContents.length },
    });

    // 5. Filter 2 - GPT Full Analysis + Embedding
    const results: Array<{
      tipo_crime: string;
      cidade: string;
      bairro: string | null;
      rua: string | null;
      data_ocorrencia: string;
      resumo: string;
      confianca: number;
      source_url: string;
    }> = [];

    for (const fetched of validContents) {
      const extracted = await rateLimiter.schedule('openai', () =>
        filter2GPT(fetched.content, {
          maxContentChars: pipelineConfig.filter2MaxContentChars,
          minConfidence: pipelineConfig.filter2ConfidenceMin,
        })
      );
      if (!extracted) continue;

      // Filter by date range
      const newsDate = new Date(extracted.data_ocorrencia);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodoDias);
      if (newsDate < cutoff) continue;

      results.push({
        tipo_crime: extracted.tipo_crime,
        cidade: extracted.cidade,
        bairro: extracted.bairro ?? null,
        rua: extracted.rua ?? null,
        data_ocorrencia: extracted.data_ocorrencia,
        resumo: extracted.resumo,
        confianca: extracted.confianca,
        source_url: fetched.url,
      });
    }

    await db.trackCost({
      source: 'manual_search',
      provider: 'openai',
      cost_usd: validContents.length * 0.0005,
      details: { searchId, stage: 'filter2', analyzed: validContents.length, extracted: results.length },
    });

    // 6. Save results to search_results
    if (results.length > 0) {
      await db.insertSearchResults(searchId, results, 0);
    }

    await db.updateSearchStatus(searchId, 'completed', results.length);

    const duration = Date.now() - startTime;
    logger.info(`[ManualSearch] ${searchId} completed: ${results.length} results in ${duration}ms`);
  } catch (error) {
    logger.error(`[ManualSearch] ${searchId} failed: ${(error as Error).message}`);
    await db.updateSearchStatus(searchId, 'failed');
    throw error;
  }
}

export function createManualSearchWorker(): Worker {
  const worker = new Worker<ManualSearchJobData>(
    'manual-search-queue',
    processManualSearch,
    {
      connection: redis,
      concurrency: 2,
      limiter: {
        max: 5,
        duration: 60000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`[ManualSearchWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`[ManualSearchWorker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`[ManualSearchWorker] Error: ${err.message}`);
  });

  logger.info('[ManualSearchWorker] Worker started');
  return worker;
}
