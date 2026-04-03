// ============================================
// Scan Pipeline - Auto-scan (CRON)
// ============================================
// Usa pipelineCore para stages compartilhados.
// Peculiaridades: dedup contra DB, push por notícia, operation logs.

import { config } from '../../config';
import { deduplicateNews } from '../../services/deduplication';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { MonitoredLocation, PipelineResult } from '../../utils/types';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';
import { SearchResult } from '../../services/search/SearchProvider';
import { buildQueries } from '../../services/search/queryTemplates';
import { fetchGoogleNewsRSS } from '../../services/search/GoogleNewsRSSProvider';
import { sendPushNotification } from '../../services/notifications/pushService';
import {
  runFilter0,
  runFilter1,
  runContentFetch,
  runFilter2WithEmbedding,
  runIntraBatchDedup,
  deduplicateResults,
  searchProvider,
  RejectedUrl,
} from './pipelineCore';

const LOG_PREFIX = '[Pipeline]';

/**
 * Executa pipeline completo para uma localização.
 */
export async function executePipeline(locationId: string): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    return await runPipeline(locationId, startTime);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`${LOG_PREFIX} FATAL error for location ${locationId}: ${(error as Error).message}`);

    try {
      await db.insertOperationLog({
        location_id: locationId, stage: 'error',
        urls_processed: 0, news_found: 0, cost_usd: 0, duration_ms: duration,
      });
    } catch {
      logger.error(`${LOG_PREFIX} Failed to log error to database`);
    }

    throw error;
  }
}

async function runPipeline(locationId: string, startTime: number): Promise<PipelineResult> {
  const location = await db.getLocation(locationId);

  // Verificar se localização ainda está ativa (pode ter sido desligada enquanto job estava na fila)
  if (!location.active) {
    logger.info(`${LOG_PREFIX} Skipping disabled location: ${location.name}`);
    return {
      locationId, locationName: location.name,
      urlsFound: 0, afterFilter0: 0, afterFilter1: 0, afterFilter2: 0,
      newsSaved: 0, duplicatesFound: 0, totalCostUsd: 0, durationMs: Date.now() - startTime,
    };
  }

  const pipelineConfig = {
    searchMaxResults: await configManager.getNumber('search_max_results'),
    contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
    filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
    filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
    dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
    multiQueryEnabled: await configManager.getBoolean('multi_query_enabled'),
    queriesPerScan: await configManager.getNumber('search_queries_per_scan'),
    googleNewsRSSEnabled: await configManager.getBoolean('google_news_rss_enabled'),
    filter0RegexEnabled: await configManager.getBoolean('filter0_regex_enabled'),
  };

  logger.info(`${LOG_PREFIX} Starting scan for ${location.name}`);

  // Buscar estado pai para filtro de cidade
  let parentState: { name: string } | null = null;
  if (location.parent_id) {
    try {
      parentState = await db.getLocation(location.parent_id);
    } catch {
      logger.warn(`${LOG_PREFIX} Could not fetch parent state for ${location.name}`);
    }
  }

  // Budget check
  const monthlyBudget = await configManager.getNumber('monthly_budget_usd');
  const currentCost = await db.getCurrentMonthCost();
  if (currentCost >= monthlyBudget) {
    logger.warn(`${LOG_PREFIX} Budget exceeded: $${currentCost.toFixed(2)} >= $${monthlyBudget}. Skipping scan.`);
    return buildResult(location, 0, 0, 0, 0, 0, 0, 0, Date.now() - startTime);
  }
  if (currentCost >= monthlyBudget * 0.9) {
    logger.warn(`${LOG_PREFIX} Budget warning: $${currentCost.toFixed(2)} / $${monthlyBudget} (${(currentCost / monthlyBudget * 100).toFixed(0)}%)`);
  }

  // STAGE 1: Multi-Source URL Collector
  const { allResults, queryCount, sources } = await collectUrls(location, pipelineConfig, parentState?.name);
  const searchResults = deduplicateResults(allResults);
  logger.info(`${LOG_PREFIX} Collected ${allResults.length} URLs → ${searchResults.length} unique (sources: ${sources.join(', ')})`);

  if (queryCount > 0) {
    await db.trackCost({
      source: 'auto_scan',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave',
      cost_usd: queryCount * 0.005,
      details: { queryCount, resultsCount: searchResults.length, sources },
    });
  }

  await db.cleanupOldRejectedUrls();

  const rejectedUrls: RejectedUrl[] = [];

  // STAGE 2: Filter0
  const afterFilter0 = runFilter0(searchResults, pipelineConfig.filter0RegexEnabled, rejectedUrls, LOG_PREFIX);

  // Save rejected from filter0
  const filter0Rejected = rejectedUrls.filter(r => r.stage === 'filter0');
  if (filter0Rejected.length > 0) {
    await db.insertRejectedUrls(filter0Rejected.map(r => ({
      url: r.url, title: '', stage: 'filter0_regex',
      reason: 'URL bloqueada (regex)', location_id: locationId,
    })));
  }

  // STAGE 3: Filter1
  const afterFilter1 = await runFilter1(afterFilter0, rejectedUrls, LOG_PREFIX);

  // Save rejected from filter1
  const filter1Rejected = rejectedUrls.filter(r => r.stage === 'filter1');
  if (filter1Rejected.length > 0) {
    await db.insertRejectedUrls(filter1Rejected.map(r => ({
      url: r.url, title: '', stage: 'filter1_gpt',
      reason: 'Não criminal', location_id: locationId,
    })));
  }

  await db.trackCost({
    source: 'auto_scan', provider: 'openai',
    cost_usd: afterFilter0.length > 0 ? 0.0002 : 0,
    details: { stage: 'filter1_batch', snippetCount: afterFilter0.length },
  });

  if (afterFilter1.length === 0) {
    logger.info(`${LOG_PREFIX} No URLs passed filters, stopping`);
    const duration = Date.now() - startTime;
    await db.insertOperationLog({
      location_id: locationId, stage: 'complete',
      urls_processed: searchResults.length, news_found: 0,
      cost_usd: calculateCost(queryCount, afterFilter0.length, 0, 0), duration_ms: duration,
    });
    return buildResult(location, searchResults.length, afterFilter0.length, 0, 0, 0, 0, 0, duration);
  }

  // STAGE 4: Content Fetch
  const validContents = await runContentFetch(afterFilter1, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX);

  await db.trackCost({
    source: 'auto_scan', provider: 'jina',
    cost_usd: validContents.length * 0.002,
    details: { stage: 'fetch', count: validContents.length },
  });

  // STAGE 5: Filter2 + Embedding (com filtro de cidade/estado)
  const locationPostFilter = parentState ? {
    estado: parentState.name,
    cidades: [location.name],
    periodoDias: 7,
  } : undefined;

  const extractions = await runFilter2WithEmbedding(
    validContents,
    { maxContentChars: pipelineConfig.filter2MaxContentChars, minConfidence: pipelineConfig.filter2ConfidenceMin },
    rejectedUrls, LOG_PREFIX,
    locationPostFilter,
  );

  // Save rejected from filter2
  const filter2Rejected = rejectedUrls.filter(r => r.stage === 'filter2');
  if (filter2Rejected.length > 0) {
    await db.insertRejectedUrls(filter2Rejected.map(r => ({
      url: r.url, title: '', stage: r.stage.startsWith('filter2') ? r.stage : 'filter2_gpt',
      reason: r.reason || 'Não criminal (análise)', location_id: locationId,
    })));
  }

  await db.trackCost({
    source: 'auto_scan', provider: 'openai',
    cost_usd: validContents.length * 0.0005 + extractions.length * 0.00002,
    details: { stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length },
  });

  // STAGE 5.5: Intra-batch dedup
  const { consolidated, intraMerged } = runIntraBatchDedup(extractions, LOG_PREFIX);

  // STAGE 6: Dedup contra DB + Save
  let newsSaved = 0;
  let duplicatesFound = 0;
  const dedupLayerStats = { layer1: 0, layer2: 0, layer3: 0 };

  for (const news of consolidated) {
    try {
      const dedupResult = await deduplicateNews(news, news.sourceUrl, pipelineConfig.dedupSimilarityThreshold);

      if (dedupResult.layer === 1) dedupLayerStats.layer1++;
      else if (dedupResult.layer === 2) dedupLayerStats.layer2++;
      else if (dedupResult.layer === 3) dedupLayerStats.layer3++;

      if (dedupResult.isDuplicate) {
        duplicatesFound++;
        logger.info(`${LOG_PREFIX} Duplicate detected (layer ${dedupResult.layer}), source added to ${dedupResult.existingId}`);
        continue;
      }

      const newsId = await db.insertNews({
        tipo_crime: news.tipo_crime, natureza: news.natureza,
        categoria_grupo: news.categoria_grupo,
        cidade: news.cidade, bairro: news.bairro, rua: news.rua,
        data_ocorrencia: news.data_ocorrencia, resumo: news.resumo,
        embedding: news.embedding, confianca: news.confianca,
      });

      await db.insertNewsSource(newsId, news.sourceUrl);
      for (const extraUrl of news.extraSourceUrls) {
        await db.insertNewsSource(newsId, extraUrl);
      }

      // Push notification
      try {
        const pushResult = await sendPushNotification({
          id: newsId, tipo_crime: news.tipo_crime,
          cidade: news.cidade, bairro: news.bairro || null, resumo: news.resumo,
        });
        if (pushResult.sent) {
          logger.info(`${LOG_PREFIX} Push sent for ${newsId}: ${pushResult.successCount}/${pushResult.deviceCount} devices`);
        } else {
          logger.warn(`${LOG_PREFIX} Push not sent for ${newsId}: ${pushResult.reason}`);
        }
      } catch (pushErr) {
        logger.error(`${LOG_PREFIX} Push failed for news ${newsId}: ${(pushErr as Error).message}`);
      }

      newsSaved++;
    } catch (err) {
      logger.error(`Failed to save news: ${(err as Error).message}`);
    }
  }

  logger.info(`${LOG_PREFIX} Dedup stats: ${extractions.length} extracted, ${intraMerged} intra-merged, ${consolidated.length} checked vs DB, ${duplicatesFound} dupes, ${newsSaved} new | Layer1(geo): ${dedupLayerStats.layer1}, Layer2(embed): ${dedupLayerStats.layer2}, Layer3(gpt): ${dedupLayerStats.layer3}`);

  if (duplicatesFound > 0) {
    await db.trackCost({
      source: 'auto_scan', provider: 'openai',
      cost_usd: duplicatesFound * 0.001,
      details: { stage: 'dedup_gpt', duplicates: duplicatesFound, layerStats: dedupLayerStats },
    });
  }

  // STAGE 7: Finalize
  await db.updateLocationLastCheck(locationId, new Date());

  const duration = Date.now() - startTime;
  const totalCost = calculateCost(queryCount, afterFilter0.length, validContents.length, extractions.length);

  await db.insertOperationLog({
    location_id: locationId, stage: 'complete',
    urls_processed: searchResults.length, news_found: newsSaved,
    cost_usd: totalCost, duration_ms: duration,
  });

  logger.info(`${LOG_PREFIX} Completed: ${newsSaved} new, ${duplicatesFound} dupes, cost $${totalCost.toFixed(4)}, ${duration}ms`);

  return buildResult(location, searchResults.length, afterFilter0.length, afterFilter1.length, extractions.length, newsSaved, duplicatesFound, totalCost, duration);
}

// ============================================
// Multi-Source URL Collector (auto-scan specific)
// ============================================

interface CollectResult {
  allResults: SearchResult[];
  queryCount: number;
  sources: string[];
}

async function collectUrls(
  location: MonitoredLocation,
  cfg: {
    searchMaxResults: number;
    multiQueryEnabled: boolean;
    queriesPerScan: number;
    googleNewsRSSEnabled: boolean;
  },
  stateName?: string,
): Promise<CollectResult> {
  const allResults: SearchResult[] = [];
  const sources: string[] = [];
  let queryCount = 0;

  const scanIndex = Math.floor(Date.now() / 60000);

  // 1. Search provider (Brave/Perplexity)
  const queries = buildQueries(location, {
    multiQueryEnabled: cfg.multiQueryEnabled,
    queriesPerScan: cfg.queriesPerScan,
    scanIndex,
  });

  for (const query of queries) {
    try {
      const results = await rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(query, {
          maxResults: cfg.searchMaxResults,
          location: { city: location.name, state: stateName, country: 'BR' },
        })
      );
      allResults.push(...results);
      queryCount++;
    } catch (error) {
      logger.warn(`${LOG_PREFIX} Search failed: ${(error as Error).message}`);
    }
  }
  if (queryCount > 0) sources.push('google');

  // 2. Google News RSS
  if (cfg.googleNewsRSSEnabled) {
    try {
      const rssQuery = queries[0] || `crime ${location.name}`;
      const rssResults = await rateLimiter.schedule('google_news_rss', () =>
        fetchGoogleNewsRSS(rssQuery, { maxAgeDays: 7 })
      );
      if (rssResults.length > 0) {
        allResults.push(...rssResults);
        sources.push('google_news_rss');
      }
    } catch (error) {
      logger.warn(`${LOG_PREFIX} RSS failed: ${(error as Error).message}`);
    }
  }

  return { allResults, queryCount, sources };
}

// ============================================
// Helpers
// ============================================

function calculateCost(queries: number, filter1Count: number, jinaFetches: number, filter2Count: number): number {
  return queries * 0.005 + (filter1Count > 0 ? 0.0002 : 0) + jinaFetches * 0.002 + filter2Count * 0.0005 + filter2Count * 0.00002;
}

function buildResult(
  location: MonitoredLocation, urlsFound: number, afterFilter0: number, afterFilter1: number,
  afterFilter2: number, newsSaved: number, duplicatesFound: number, totalCostUsd: number, durationMs: number,
): PipelineResult {
  return {
    locationId: location.id, locationName: location.name,
    urlsFound, afterFilter0, afterFilter1, afterFilter2,
    newsSaved, duplicatesFound, totalCostUsd, durationMs,
  };
}
