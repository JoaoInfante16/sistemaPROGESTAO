// ============================================
// Manual Search Worker - BullMQ
// ============================================
// Usa pipelineCore para stages compartilhados.
// Peculiaridades: filtro cidade/estado, progress tracking, search_results.

import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { fetchGoogleNewsRSS } from '../../services/search/GoogleNewsRSSProvider';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';
import { sendPushToUser } from '../../services/notifications/pushService';
import {
  runFilter0,
  runFilter1,
  runContentFetch,
  runFilter2WithEmbedding,
  runIntraBatchDedup,
  deduplicateResults,
  searchProvider,
  RejectedUrl,
} from '../pipeline/pipelineCore';

export const manualSearchQueue = new Queue('manual-search-queue', { connection: redis });

export interface ManualSearchJobData {
  searchId: string;
  userId: string;
  estado: string;
  cidades: string[];
  periodoDias: number;
  tipoCrime?: string;
  profundidade?: number;
}

async function processManualSearch(job: Job<ManualSearchJobData>): Promise<void> {
  const { searchId, estado, cidades, periodoDias, tipoCrime, profundidade = 1.0 } = job.data;
  const startTime = Date.now();
  const LOG_PREFIX = `[ManualSearch] ${searchId}`;

  try {
    // Budget check
    const monthlyBudget = await configManager.getNumber('monthly_budget_usd');
    const currentCost = await db.getCurrentMonthCost();
    if (currentCost >= monthlyBudget) {
      logger.warn(`${LOG_PREFIX} Budget exceeded: $${currentCost.toFixed(2)} >= $${monthlyBudget}. Rejecting search.`);
      await db.updateSearchStatus(searchId, 'failed');
      return;
    }

    // Max results por período — configurável no admin panel
    const maxResultsKey = periodoDias <= 30 ? 'manual_search_max_results_30d'
      : periodoDias <= 60 ? 'manual_search_max_results_60d'
      : 'manual_search_max_results_90d';

    const baseMaxResults = await configManager.getNumber(maxResultsKey);
    const pipelineConfig = {
      searchMaxResults: Math.round(baseMaxResults * profundidade),
      contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
      filter0RegexEnabled: await configManager.getBoolean('filter0_regex_enabled'),
    };

    // STAGE 1: Collect URLs
    await db.updateSearchProgress(searchId, { stage: 'searching', stage_num: 1, total_stages: 7, details: `Pesquisando ${cidades.length} cidades` });

    const { searchResults, sourceTypeMap } = await collectManualSearchUrls(
      { estado, cidades, periodoDias, tipoCrime },
      pipelineConfig,
      LOG_PREFIX,
    );

    await db.trackCost({
      source: 'manual_search',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave',
      cost_usd: cidades.length * 0.005,
      details: { searchId, cidadesCount: cidades.length, resultsCount: searchResults.length },
    });

    const rejectedUrls: RejectedUrl[] = [];

    // STAGE 2: Filter0
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 2, total_stages: 7, details: `${searchResults.length} URLs para filtrar` });
    const afterFilter0 = runFilter0(searchResults, pipelineConfig.filter0RegexEnabled, rejectedUrls, LOG_PREFIX);

    // STAGE 3: Filter1
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 3, total_stages: 7, details: `${afterFilter0.length} URLs no GPT` });
    const afterFilter1 = await runFilter1(afterFilter0, rejectedUrls, LOG_PREFIX);

    await db.trackCost({
      source: 'manual_search', provider: 'openai',
      cost_usd: afterFilter0.length > 0 ? 0.0002 : 0,
      details: { searchId, stage: 'filter1_batch', snippetCount: afterFilter0.length },
    });

    if (afterFilter1.length === 0) {
      await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 7, total_stages: 7 });
      await db.updateSearchStatus(searchId, 'completed', 0);
      logger.info(`${LOG_PREFIX} completed with 0 results`);
      return;
    }

    // STAGE 4: Content Fetch
    await db.updateSearchProgress(searchId, { stage: 'fetching', stage_num: 4, total_stages: 7, details: `${afterFilter1.length} artigos` });
    const validContents = await runContentFetch(afterFilter1, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX);

    await db.trackCost({
      source: 'manual_search', provider: 'jina',
      cost_usd: validContents.length * 0.002,
      details: { searchId, stage: 'fetch', count: validContents.length },
    });

    // STAGE 5: Filter2 + Embedding (com filtro de cidade/estado e data)
    await db.updateSearchProgress(searchId, { stage: 'analyzing', stage_num: 5, total_stages: 7, details: `${validContents.length} conteudos` });
    const extractions = await runFilter2WithEmbedding(
      validContents,
      { maxContentChars: pipelineConfig.filter2MaxContentChars, minConfidence: pipelineConfig.filter2ConfidenceMin },
      rejectedUrls, LOG_PREFIX,
      { periodoDias, estado, cidades },
      sourceTypeMap,
    );

    await db.trackCost({
      source: 'manual_search', provider: 'openai',
      cost_usd: validContents.length * 0.0005 + extractions.length * 0.00002,
      details: { searchId, stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length },
    });

    // STAGE 6: Dedup intra-batch
    await db.updateSearchProgress(searchId, { stage: 'dedup', stage_num: 6, total_stages: 7, details: `Consolidando ${extractions.length} resultados` });
    const { consolidated } = runIntraBatchDedup(extractions, LOG_PREFIX);

    // Build final results with sources array
    const finalResults = consolidated.map(news => ({
      tipo_crime: news.tipo_crime,
      natureza: news.natureza,
      categoria_grupo: news.categoria_grupo,
      cidade: news.cidade,
      bairro: news.bairro ?? null,
      rua: news.rua ?? null,
      data_ocorrencia: news.data_ocorrencia,
      resumo: news.resumo,
      confianca: news.confianca,
      source_url: news.sourceUrl,
      source_type: news.sourceType,
      sources: news.sources,
    }));

    logger.info(`${LOG_PREFIX} total rejeitadas: ${rejectedUrls.length} | motivos: ${JSON.stringify(rejectedUrls.map(r => `${r.stage}:${r.reason}`))}`);

    // STAGE 7: Save
    await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 7, total_stages: 7 });

    if (finalResults.length > 0) {
      await db.insertSearchResults(searchId, finalResults, 0);
    }

    await db.updateSearchStatus(searchId, 'completed', finalResults.length);

    const duration = Date.now() - startTime;
    logger.info(`${LOG_PREFIX} completed: ${finalResults.length} results in ${duration}ms`);

    // Push notification
    try {
      const tipoCrimeLabel = tipoCrime || 'crimes';
      await sendPushToUser(
        job.data.userId,
        'Busca concluida',
        `Encontramos ${finalResults.length} resultado${finalResults.length !== 1 ? 's' : ''} para ${tipoCrimeLabel} em ${estado}`,
        { search_id: searchId, type: 'manual_search_completed' }
      );
    } catch (pushErr) {
      logger.warn(`${LOG_PREFIX} Push failed: ${(pushErr as Error).message}`);
    }
  } catch (error) {
    logger.error(`${LOG_PREFIX} failed: ${(error as Error).message}`);
    await db.updateSearchStatus(searchId, 'failed');

    try {
      await sendPushToUser(
        job.data.userId, 'Busca falhou',
        'Sua busca nao pode ser concluida. Tente novamente.',
        { search_id: searchId, type: 'manual_search_failed' }
      );
    } catch (_) { /* non-fatal */ }

    throw error;
  }
}

// ============================================
// URL Collection (manual search specific)
// ============================================

async function collectManualSearchUrls(
  params: { estado: string; cidades: string[]; periodoDias: number; tipoCrime?: string },
  cfg: { searchMaxResults: number; filter0RegexEnabled: boolean },
  logPrefix: string,
): Promise<{ searchResults: Array<{ url: string; title: string; snippet: string }>; sourceTypeMap: Map<string, string> }> {
  const { estado, cidades, periodoDias, tipoCrime } = params;
  const sourceTypeMap = new Map<string, string>();
  const allResults: Array<{ url: string; title: string; snippet: string }> = [];
  const seenUrls = new Set<string>();

  // 1. Search provider (Brave/Perplexity) — 1 query por cidade
  for (const cidade of cidades) {
    const localidade = `${cidade}, ${estado}`;
    const query = tipoCrime
      ? `${tipoCrime} ${localidade}`
      : `notícias policiais ocorrências crimes assalto roubo homicídio prisão tráfico operação policial flagrante ${localidade}`;

    logger.info(`${logPrefix} query: ${query.substring(0, 100)}...`);

    const dateRestrict = periodoDias <= 1 ? 'd1'
      : periodoDias <= 7 ? 'd7'
      : periodoDias <= 30 ? 'd30'
      : periodoDias <= 60 ? 'd60'
      : `d${periodoDias}`;

    const results = await rateLimiter.schedule(config.searchBackend, () =>
      searchProvider.search(query, { maxResults: cfg.searchMaxResults, dateRestrict })
    );

    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        sourceTypeMap.set(r.url, 'google');
        allResults.push(r);
      }
    }
  }

  logger.info(`${logPrefix} found ${allResults.length} unique URLs from ${cidades.length} cidades`);

  // 2. Google News RSS
  const rssEnabled = await configManager.getBoolean('google_news_rss_enabled');
  if (rssEnabled) {
    try {
      for (const cidade of cidades) {
        const rssQuery = tipoCrime ? `${tipoCrime} ${cidade} ${estado}` : `crime policial ${cidade} ${estado}`;
        const rssResults = await rateLimiter.schedule('google_news_rss', () =>
          fetchGoogleNewsRSS(rssQuery, { maxAgeDays: periodoDias })
        );
        for (const r of rssResults) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            sourceTypeMap.set(r.url, 'google');
            allResults.push(r);
          }
        }
      }
      logger.info(`${logPrefix} after RSS: ${allResults.length} total URLs`);
    } catch (error) {
      logger.warn(`${logPrefix} RSS failed: ${(error as Error).message}`);
    }
  }

  // Dedup URLs
  const searchResults = deduplicateResults(allResults);
  logger.info(`${logPrefix} total after dedup: ${searchResults.length} URLs`);

  return { searchResults, sourceTypeMap };
}

// ============================================
// Worker setup
// ============================================

export function createManualSearchWorker(): Worker {
  const worker = new Worker<ManualSearchJobData>(
    'manual-search-queue',
    processManualSearch,
    {
      connection: redis,
      concurrency: 2,
      drainDelay: 30000,
      limiter: { max: 5, duration: 60000 },
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
