// ============================================
// Scan Pipeline - Orquestração principal
// ============================================
// Fluxo: Multi-Source Collect → Filter0 → Filter1 → Fetch → Filter2 → Embed → Dedup → Save

import { config } from '../../config';
import { createSearchProvider } from '../../services/search';
import { createContentFetcher } from '../../services/content';
import { createEmbeddingProvider } from '../../services/embedding';
import { filter0Regex } from '../../services/filters/filter0Regex';
import { filter1GPTBatch } from '../../services/filters/filter1GPTBatch';
import { filter2GPT } from '../../services/filters/filter2GPT';
import { deduplicateNews } from '../../services/deduplication';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { MonitoredLocation, NewsExtraction, PipelineResult } from '../../utils/types';
import { asyncPool } from '../../utils/helpers';
import { FetchedContent } from '../../services/content/ContentFetcher';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';
import { SearchResult } from '../../services/search/SearchProvider';
import { buildQueries } from '../../services/search/queryTemplates';
import { deduplicateResults } from '../../services/search/urlDeduplicator';
import { fetchGoogleNewsRSS } from '../../services/search/GoogleNewsRSSProvider';
import { crawlSections } from '../../services/search/SectionCrawler';
import { scrapeSSP } from '../../services/search/SSPScraper';
import { sendPushNotification } from '../../services/notifications/pushService';

const searchProvider = createSearchProvider();
const contentFetcher = createContentFetcher();
const embeddingProvider = createEmbeddingProvider();

/**
 * Executa pipeline completo para uma localização.
 * FIX #3: try-catch global para não crashar o worker.
 */
export async function executePipeline(locationId: string): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    return await runPipeline(locationId, startTime);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[Pipeline] FATAL error for location ${locationId}: ${(error as Error).message}`);

    // Tenta logar o erro no banco (best effort)
    try {
      await db.insertOperationLog({
        location_id: locationId,
        stage: 'error',
        urls_processed: 0,
        news_found: 0,
        cost_usd: 0,
        duration_ms: duration,
      });
    } catch {
      logger.error('[Pipeline] Failed to log error to database');
    }

    throw error;
  }
}

async function runPipeline(locationId: string, startTime: number): Promise<PipelineResult> {
  const location = await db.getLocation(locationId);

  // Ler configs centralizadas do admin panel (cache 5min)
  const pipelineConfig = {
    searchMaxResults: await configManager.getNumber('search_max_results'),
    contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
    filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
    filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
    dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
    // Novas configs de ingestão
    multiQueryEnabled: await configManager.getBoolean('multi_query_enabled'),
    queriesPerScan: await configManager.getNumber('search_queries_per_scan'),
    googleNewsRSSEnabled: await configManager.getBoolean('google_news_rss_enabled'),
    sectionCrawlingEnabled: await configManager.getBoolean('section_crawling_enabled'),
    sectionCrawlingMaxDomains: await configManager.getNumber('section_crawling_max_domains'),
    sspScrapingEnabled: await configManager.getBoolean('ssp_scraping_enabled'),
  };

  logger.info(`[Pipeline] Starting scan for ${location.name}`);

  // ============================================
  // STAGE 1: Multi-Source URL Collector
  // ============================================
  const { allResults, googleQueryCount, sources } = await collectUrls(location, pipelineConfig);

  // Deduplicar URLs de todas as fontes
  const searchResults = deduplicateResults(allResults);
  logger.info(`[Pipeline] Collected ${allResults.length} URLs → ${searchResults.length} unique (sources: ${sources.join(', ')})`);

  // Track Google Search cost
  if (googleQueryCount > 0) {
    await db.trackCost({
      source: 'auto_scan',
      provider: config.searchBackend as 'google' | 'perplexity',
      cost_usd: estimateGoogleCost(googleQueryCount),
      details: { queryCount: googleQueryCount, resultsCount: searchResults.length, sources },
    });
  }

  // Track Jina cost for section crawling + SSP
  const jinaScanCost = sources.filter(s => s === 'section_crawling' || s === 'ssp').length;
  if (jinaScanCost > 0) {
    await db.trackCost({
      source: 'auto_scan',
      provider: 'jina',
      cost_usd: jinaScanCost * 0.002,
      details: { stage: 'source_crawling', sources: sources.filter(s => s !== 'google' && s !== 'google_news_rss') },
    });
  }

  // ============================================
  // STAGE 2: Filter0 - Regex (local, sem custo)
  // ============================================
  const afterFilter0 = searchResults.filter((r) => filter0Regex(r.url, r.snippet));
  logger.info(`[Pipeline] After Filter0 (regex): ${afterFilter0.length}/${searchResults.length}`);

  // ============================================
  // STAGE 3: Filter1 - GPT Batch
  // ============================================
  const snippets = afterFilter0.map((r) => r.snippet);
  const batchResults = await rateLimiter.schedule('openai', () =>
    filter1GPTBatch(snippets)
  );
  const afterFilter1 = afterFilter0.filter((_, index) => batchResults[index]);
  logger.info(`[Pipeline] After Filter1 (GPT batch): ${afterFilter1.length}/${afterFilter0.length}`);

  await db.trackCost({
    source: 'auto_scan',
    provider: 'openai',
    cost_usd: afterFilter0.length > 0 ? 0.0002 : 0,
    details: { stage: 'filter1_batch', snippetCount: afterFilter0.length },
  });

  if (afterFilter1.length === 0) {
    logger.info(`[Pipeline] No URLs passed filters, stopping`);
    const duration = Date.now() - startTime;
    await db.insertOperationLog({
      location_id: locationId,
      stage: 'complete',
      urls_processed: searchResults.length,
      news_found: 0,
      cost_usd: calculateCost(googleQueryCount, afterFilter0.length, 0, 0),
      duration_ms: duration,
    });
    return buildResult(location, searchResults.length, afterFilter0.length, 0, 0, 0, 0, 0, duration);
  }

  // ============================================
  // STAGE 4: Content Fetch via Jina
  // ============================================
  const contentResults = await asyncPool<typeof afterFilter1[0], FetchedContent | null>(
    afterFilter1,
    pipelineConfig.contentFetchConcurrency,
    async (r) => {
      try {
        return await rateLimiter.schedule('jina', () =>
          contentFetcher.fetch(r.url)
        );
      } catch (err) {
        logger.error(`Failed to fetch ${r.url}: ${(err as Error).message}`);
        return null;
      }
    }
  );
  const validContents = contentResults.filter(
    (c): c is FetchedContent => c !== null
  );
  logger.info(`[Pipeline] Fetched ${validContents.length} articles via Jina`);

  await db.trackCost({
    source: 'auto_scan',
    provider: 'jina',
    cost_usd: validContents.length * 0.002,
    details: { stage: 'fetch', count: validContents.length },
  });

  // ============================================
  // STAGE 5: Filter2 - GPT Full Analysis + Embedding
  // ============================================
  const extractions: Array<NewsExtraction & { embedding: number[]; sourceUrl: string }> = [];

  for (let i = 0; i < validContents.length; i++) {
    const fetched = validContents[i];

    const extracted = await rateLimiter.schedule('openai', () =>
      filter2GPT(fetched.content, {
        maxContentChars: pipelineConfig.filter2MaxContentChars,
        minConfidence: pipelineConfig.filter2ConfidenceMin,
      })
    );
    if (!extracted) continue;

    const embeddingResult = await rateLimiter.schedule('openai', () =>
      embeddingProvider.generate(extracted.resumo)
    );

    extractions.push({
      ...extracted,
      embedding: embeddingResult.embedding,
      sourceUrl: fetched.url,
    });
  }

  logger.info(`[Pipeline] After Filter2 (GPT full): ${extractions.length} valid news`);

  await db.trackCost({
    source: 'auto_scan',
    provider: 'openai',
    cost_usd: validContents.length * 0.0005 + extractions.length * 0.00002,
    details: { stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length },
  });

  // ============================================
  // STAGE 6: Dedup + Save
  // ============================================
  let newsSaved = 0;
  let duplicatesFound = 0;
  for (const news of extractions) {
    try {
      const dedupResult = await deduplicateNews(news, news.sourceUrl, pipelineConfig.dedupSimilarityThreshold);

      if (dedupResult.isDuplicate) {
        duplicatesFound++;
        logger.info(`[Pipeline] Duplicate detected, source added to ${dedupResult.existingId}`);
        continue;
      }

      const newsId = await db.insertNews({
        tipo_crime: news.tipo_crime,
        cidade: news.cidade,
        bairro: news.bairro,
        rua: news.rua,
        data_ocorrencia: news.data_ocorrencia,
        resumo: news.resumo,
        embedding: news.embedding,
        confianca: news.confianca,
      });

      await db.insertNewsSource(newsId, news.sourceUrl);

      // HOTFIX: Push direto até LISTEN/NOTIFY funcionar (Supabase Realtime no roadmap Post-MVP)
      try {
        await sendPushNotification({
          id: newsId,
          tipo_crime: news.tipo_crime,
          cidade: news.cidade,
          bairro: news.bairro || null,
          resumo: news.resumo,
        });
        logger.debug(`[Pipeline] Push sent for news ${newsId}`);
      } catch (pushErr) {
        logger.error(`[Pipeline] Push failed for news ${newsId}: ${(pushErr as Error).message}`);
      }

      newsSaved++;
    } catch (err) {
      logger.error(`Failed to save news: ${(err as Error).message}`);
    }
  }

  if (duplicatesFound > 0) {
    await db.trackCost({
      source: 'auto_scan',
      provider: 'openai',
      cost_usd: duplicatesFound * 0.001,
      details: { stage: 'dedup_gpt', duplicates: duplicatesFound },
    });
  }

  // ============================================
  // STAGE 7: Finalize
  // ============================================
  await db.updateLocationLastCheck(locationId, new Date());

  const duration = Date.now() - startTime;
  const totalCost = calculateCost(googleQueryCount, afterFilter0.length, validContents.length, extractions.length);

  await db.insertOperationLog({
    location_id: locationId,
    stage: 'complete',
    urls_processed: searchResults.length,
    news_found: newsSaved,
    cost_usd: totalCost,
    duration_ms: duration,
  });

  logger.info(
    `[Pipeline] Completed: ${newsSaved} new, ${duplicatesFound} dupes, cost $${totalCost.toFixed(4)}, ${duration}ms`
  );

  return buildResult(
    location,
    searchResults.length,
    afterFilter0.length,
    afterFilter1.length,
    extractions.length,
    newsSaved,
    duplicatesFound,
    totalCost,
    duration
  );
}

// ============================================
// Multi-Source URL Collector
// ============================================

interface CollectResult {
  allResults: SearchResult[];
  googleQueryCount: number;
  sources: string[];
}

/**
 * Coleta URLs de múltiplas fontes:
 * 1. Google Custom Search (N queries rotacionadas)
 * 2. Google News RSS (grátis)
 * 3. Section Crawling (seções de jornais)
 * 4. SSP Scraping (secretarias estaduais)
 */
async function collectUrls(
  location: MonitoredLocation,
  cfg: {
    searchMaxResults: number;
    multiQueryEnabled: boolean;
    queriesPerScan: number;
    googleNewsRSSEnabled: boolean;
    sectionCrawlingEnabled: boolean;
    sectionCrawlingMaxDomains: number;
    sspScrapingEnabled: boolean;
  }
): Promise<CollectResult> {
  const allResults: SearchResult[] = [];
  const sources: string[] = [];
  let googleQueryCount = 0;

  // Gerar scan index baseado no timestamp (para rotação de queries)
  const scanIndex = Math.floor(Date.now() / 60000);

  // 1. Google Custom Search (rate limited)
  const queries = buildQueries(location, {
    multiQueryEnabled: cfg.multiQueryEnabled,
    queriesPerScan: cfg.queriesPerScan,
    scanIndex,
  });

  for (const query of queries) {
    try {
      const results = await rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(query, { maxResults: cfg.searchMaxResults })
      );
      allResults.push(...results);
      googleQueryCount++;
      logger.debug(`[Pipeline] Google Search: "${query.substring(0, 50)}..." → ${results.length} results`);
    } catch (error) {
      logger.warn(`[Pipeline] Google Search failed: ${(error as Error).message}`);
    }
  }
  if (googleQueryCount > 0) sources.push('google');

  // 2. Google News RSS (grátis, sem rate limit pesado)
  if (cfg.googleNewsRSSEnabled) {
    try {
      // Usa a primeira query (genérica) para o RSS
      const rssQuery = queries[0] || `crime ${location.name}`;
      const rssResults = await rateLimiter.schedule('google_news_rss', () =>
        fetchGoogleNewsRSS(rssQuery)
      );
      if (rssResults.length > 0) {
        allResults.push(...rssResults);
        sources.push('google_news_rss');
        logger.debug(`[Pipeline] Google News RSS: ${rssResults.length} results`);
      }
    } catch (error) {
      logger.warn(`[Pipeline] Google News RSS failed: ${(error as Error).message}`);
    }
  }

  // 3. Section Crawling (usa domínios das URLs já encontradas)
  if (cfg.sectionCrawlingEnabled && allResults.length > 0) {
    try {
      const sectionResults = await crawlSections(
        allResults.map(r => r.url),
        { maxDomains: cfg.sectionCrawlingMaxDomains, jinaApiKey: config.jinaApiKey }
      );
      if (sectionResults.length > 0) {
        allResults.push(...sectionResults);
        sources.push('section_crawling');
      }
    } catch (error) {
      logger.warn(`[Pipeline] Section crawling failed: ${(error as Error).message}`);
    }
  }

  // 4. SSP Scraping (se estado coberto)
  if (cfg.sspScrapingEnabled) {
    try {
      // Buscar nome do estado pai da location
      const stateName = await getStateName(location);
      if (stateName) {
        const sspResults = await scrapeSSP(stateName, { jinaApiKey: config.jinaApiKey });
        if (sspResults.length > 0) {
          allResults.push(...sspResults);
          sources.push('ssp');
        }
      }
    } catch (error) {
      logger.warn(`[Pipeline] SSP scraping failed: ${(error as Error).message}`);
    }
  }

  return { allResults, googleQueryCount, sources };
}

/**
 * Resolve o nome do estado para uma location.
 * Se a location é uma cidade, busca o parent (estado).
 */
async function getStateName(location: MonitoredLocation): Promise<string | null> {
  if (location.type === 'state') {
    return location.name;
  }
  if (location.parent_id) {
    try {
      const parent = await db.getLocation(location.parent_id);
      return parent.name;
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================
// Cost helpers
// ============================================

function estimateGoogleCost(queryCount: number): number {
  return queryCount * 0.005;
}

function calculateCost(
  googleQueries: number,
  gptFilter1SnippetCount: number,
  jinaFetches: number,
  gptFilter2Calls: number
): number {
  const googleCost = estimateGoogleCost(googleQueries);
  const gptFilter1Cost = gptFilter1SnippetCount > 0 ? 0.0002 : 0;
  const jinaCost = jinaFetches * 0.002;
  const gptFilter2Cost = gptFilter2Calls * 0.0005;
  const embeddingCost = gptFilter2Calls * 0.00002;

  return googleCost + gptFilter1Cost + jinaCost + gptFilter2Cost + embeddingCost;
}

function buildResult(
  location: MonitoredLocation,
  urlsFound: number,
  afterFilter0: number,
  afterFilter1: number,
  afterFilter2: number,
  newsSaved: number,
  duplicatesFound: number,
  totalCostUsd: number,
  durationMs: number
): PipelineResult {
  return {
    locationId: location.id,
    locationName: location.name,
    urlsFound,
    afterFilter0,
    afterFilter1,
    afterFilter2,
    newsSaved,
    duplicatesFound,
    totalCostUsd,
    durationMs,
  };
}
