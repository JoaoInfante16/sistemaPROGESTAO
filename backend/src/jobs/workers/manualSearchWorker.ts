// ============================================
// Manual Search Worker - BullMQ
// ============================================
// Usa pipelineCore para stages compartilhados.
// Peculiaridades: filtro cidade/estado, progress tracking, search_results.

import * as Sentry from '@sentry/node';
import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../config/redis';
import { config } from '../../config';
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

async function isCancelled(searchId: string): Promise<boolean> {
  try {
    const status = await db.getSearchStatus(searchId);
    return status.status === 'cancelled';
  } catch {
    return false; // Erro de DB não é cancelamento
  }
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
      dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
    };

    // STAGE 1: Collect URLs
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 1`); return; }
    await db.updateSearchProgress(searchId, { stage: 'searching', stage_num: 1, total_stages: 7, details: `Pesquisando ${cidades.length} cidades` });

    const { searchResults, sourceTypeMap } = await collectManualSearchUrls(
      { estado, cidades, periodoDias, tipoCrime },
      pipelineConfig,
      LOG_PREFIX,
    );

    // Bright Data: $0.0015/request, com paginacao (20 results/page) por cidade
    // Brave: $0.005/query (sem paginacao interna)
    const isBrightData = config.searchBackend === 'brightdata';
    const requestsPerCity = isBrightData ? Math.ceil(pipelineConfig.searchMaxResults / 20) : 1;
    const costPerRequest = isBrightData ? 0.0015 : 0.005;
    const totalRequests = cidades.length * requestsPerCity;
    await db.trackCost({
      source: 'manual_search',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave' | 'brightdata',
      cost_usd: totalRequests * costPerRequest,
      details: { searchId, cidadesCount: cidades.length, requestsPerCity, totalRequests, resultsCount: searchResults.length },
    });

    const rejectedUrls: RejectedUrl[] = [];

    // STAGE 2: Filter0
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 2`); return; }
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 2, total_stages: 7, details: `${searchResults.length} URLs para filtrar` });
    const afterFilter0 = runFilter0(searchResults, pipelineConfig.filter0RegexEnabled, rejectedUrls, LOG_PREFIX);

    // STAGE 3: Filter1
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 3`); return; }
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 3, total_stages: 7, details: `${afterFilter0.length} URLs no GPT` });
    const filter1Result = await runFilter1(afterFilter0, rejectedUrls, LOG_PREFIX);
    const afterFilter1 = filter1Result.passed;

    await db.trackCost({
      source: 'manual_search', provider: 'openai',
      cost_usd: filter1Result.tokensUsed * 0.00000015,
      details: { searchId, stage: 'filter1_batch', snippetCount: afterFilter0.length, tokensUsed: filter1Result.tokensUsed },
    });

    if (afterFilter1.length === 0) {
      await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 7, total_stages: 7 });
      await db.updateSearchStatus(searchId, 'completed', 0);
      logger.info(`${LOG_PREFIX} completed with 0 results`);
      return;
    }

    // STAGE 4: Content Fetch
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 4`); return; }
    await db.updateSearchProgress(searchId, { stage: 'fetching', stage_num: 4, total_stages: 7, details: `${afterFilter1.length} artigos` });
    const validContents = await runContentFetch(afterFilter1, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX);

    const jinaTokensTotal = validContents.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);
    await db.trackCost({
      source: 'manual_search', provider: 'jina',
      cost_usd: jinaTokensTotal * 0.00000005,
      details: { searchId, stage: 'fetch', count: validContents.length, tokensUsed: jinaTokensTotal },
    });

    // STAGE 5: Filter2 + Embedding (com filtro de cidade/estado e data)
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 5`); return; }
    await db.updateSearchProgress(searchId, { stage: 'analyzing', stage_num: 5, total_stages: 7, details: `${validContents.length} conteudos` });
    const filter2Result = await runFilter2WithEmbedding(
      validContents,
      { maxContentChars: pipelineConfig.filter2MaxContentChars, minConfidence: pipelineConfig.filter2ConfidenceMin },
      rejectedUrls, LOG_PREFIX,
      { periodoDias, estado, cidades },
      sourceTypeMap,
    );
    const extractions = filter2Result.extractions;

    const f2tokens = filter2Result.tokensUsed;
    await db.trackCost({
      source: 'manual_search', provider: 'openai',
      cost_usd: f2tokens.filter2 * 0.00000015 + f2tokens.embedding * 0.00000002,
      details: { searchId, stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length, tokensUsed: f2tokens },
    });

    // STAGE 6: Dedup intra-batch
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 6`); return; }
    await db.updateSearchProgress(searchId, { stage: 'dedup', stage_num: 6, total_stages: 7, details: `Consolidando ${extractions.length} resultados` });
    const { consolidated } = runIntraBatchDedup(extractions, LOG_PREFIX, pipelineConfig.dedupSimilarityThreshold);

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
      const cidadesLabel = cidades.length <= 2 ? cidades.join(' e ') : `${cidades.length} cidades`;
      logger.info(`${LOG_PREFIX} Sending push to user ${job.data.userId}`);
      const pushResult = await sendPushToUser(
        job.data.userId,
        `Busca concluída — ${finalResults.length} resultado${finalResults.length !== 1 ? 's' : ''}`,
        `${cidadesLabel} (${estado}) · ${tipoCrime || 'todos os crimes'} · ${periodoDias} dias`,
        { search_id: searchId, type: 'manual_search_completed' }
      );
      logger.info(`${LOG_PREFIX} Push result: sent=${pushResult.sent}, devices=${pushResult.deviceCount}, reason=${pushResult.reason || 'ok'}`);
    } catch (pushErr) {
      logger.warn(`${LOG_PREFIX} Push failed: ${(pushErr as Error).message}`);
    }
  } catch (error) {
    Sentry.captureException(error, { tags: { component: 'manual_search', searchId } });
    logger.error(`${LOG_PREFIX} failed: ${(error as Error).message}`);
    await db.updateSearchStatus(searchId, 'failed');

    try {
      await sendPushToUser(
        job.data.userId, 'Busca não concluída',
        'Ocorreu um erro durante a busca. Tente novamente.',
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

  const dateRestrict = periodoDias <= 1 ? 'd1'
    : periodoDias <= 7 ? 'd7'
    : periodoDias <= 30 ? 'd30'
    : periodoDias <= 60 ? 'd60'
    : `d${periodoDias}`;

  // 1 + 2 em PARALELO por cidade: Web Top100 (volume) + News paginado (qualidade)
  const cityPromises = cidades.map(async (cidade) => {
    const cityResults: Array<{ url: string; title: string; snippet: string; source: string }> = [];

    // Web Top100
    const webQuery = tipoCrime
      ? `allintext:"${cidade}" ${tipoCrime} ocorrência policial -site:instagram.com -site:facebook.com -site:youtube.com`
      : `allintext:"${cidade}" (ocorrência OR crime OR segurança OR policial OR estatística) -site:instagram.com -site:facebook.com -site:youtube.com`;

    logger.info(`${logPrefix} [${cidade}] Web+News em paralelo | ${dateRestrict}`);

    const [webResults, newsResults] = await Promise.allSettled([
      // Web Top100
      rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(webQuery, {
          maxResults: cfg.searchMaxResults,
          dateRestrict,
          searchMode: 'web',
          location: { city: cidade, state: estado, country: 'BR' },
        })
      ),
      // News paginado
      rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(
          tipoCrime ? `${tipoCrime} ${cidade} ${estado}` : `notícias policiais ocorrências crime ${cidade} ${estado}`,
          {
            maxResults: 30,
            dateRestrict,
            searchMode: 'news',
            location: { city: cidade, state: estado, country: 'BR' },
          }
        )
      ),
    ]);

    if (webResults.status === 'fulfilled') {
      for (const r of webResults.value) cityResults.push({ ...r, source: 'web' });
    } else {
      logger.warn(`${logPrefix} [${cidade}] Web Top100 failed: ${webResults.reason}`);
    }

    if (newsResults.status === 'fulfilled') {
      for (const r of newsResults.value) cityResults.push({ ...r, source: 'news' });
    } else {
      logger.warn(`${logPrefix} [${cidade}] News failed: ${newsResults.reason}`);
    }

    logger.info(`${logPrefix} [${cidade}] Web: ${webResults.status === 'fulfilled' ? webResults.value.length : 0} + News: ${newsResults.status === 'fulfilled' ? newsResults.value.length : 0}`);
    return cityResults;
  });

  // Todas as cidades em paralelo
  const cityResultsAll = await Promise.all(cityPromises);

  for (const cityResults of cityResultsAll) {
    for (const r of cityResults) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        sourceTypeMap.set(r.url, r.source);
        allResults.push({ url: r.url, title: r.title, snippet: r.snippet });
      }
    }
  }

  logger.info(`${logPrefix} Total: ${allResults.length} URLs from ${cidades.length} cidades (parallel)`);

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
      stalledInterval: 300000, // 5 min — Top100 pode levar 3min
      lockDuration: 600000,    // 10 min lock
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
