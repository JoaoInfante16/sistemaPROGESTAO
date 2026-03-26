// ============================================
// Manual Search Worker - BullMQ
// ============================================
// Processa buscas manuais individuais.
// Reutiliza pipeline core mas salva em search_results (por usuário).
// NÃO faz: dedup contra news universal, push, updateLocationLastCheck.

import { Worker, Job, Queue } from 'bullmq';
import { redis } from '../../config/redis';
import { config } from '../../config';
import { createSearchProvider } from '../../services/search';
import { createContentFetcher } from '../../services/content';
import { scrapeSSP } from '../../services/search/SSPScraper';
import { fetchGoogleNewsRSS } from '../../services/search/GoogleNewsRSSProvider';
import { crawlSections } from '../../services/search/SectionCrawler';
import { deduplicateResults } from '../../services/search/urlDeduplicator';
// Embedding not needed for manual search (results aren't saved to news table)
import { filter0Regex } from '../../services/filters/filter0Regex';
import { filter1GPTBatch } from '../../services/filters/filter1GPTBatch';
import { filter2GPTWithReason } from '../../services/filters/filter2GPT';
import { db } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { asyncPool } from '../../utils/helpers';
import { FetchedContent } from '../../services/content/ContentFetcher';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';
import { sendPushToUser } from '../../services/notifications/pushService';

const searchProvider = createSearchProvider();
const contentFetcher = createContentFetcher();

export const manualSearchQueue = new Queue('manual-search-queue', { connection: redis });

export interface ManualSearchJobData {
  searchId: string;
  userId: string;
  estado: string;
  cidades: string[];
  periodoDias: number;
  tipoCrime?: string;
}

async function processManualSearch(job: Job<ManualSearchJobData>): Promise<void> {
  const { searchId, estado, cidades, periodoDias, tipoCrime } = job.data;
  const startTime = Date.now();

  try {
    // Budget check
    const monthlyBudget = await configManager.getNumber('monthly_budget_usd');
    const currentCost = await db.getCurrentMonthCost();
    if (currentCost >= monthlyBudget) {
      logger.warn(`[ManualSearch] Budget exceeded: $${currentCost.toFixed(2)} >= $${monthlyBudget}. Rejecting search.`);
      await db.updateSearchStatus(searchId, 'failed');
      return;
    }

    const pipelineConfig = {
      searchMaxResults: await configManager.getNumber('search_max_results'),
      contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
      filter0RegexEnabled: await configManager.getBoolean('filter0_regex_enabled'),
    };

    // 1. Perplexity Search — loop por cidade, coleta URLs combinadas
    await db.updateSearchProgress(searchId, { stage: 'google_search', stage_num: 1, total_stages: 6, details: `Pesquisando ${cidades.length} cidades` });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodoDias);
    const cutoffStr = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const periodoLabel = periodoDias <= 1 ? 'nas últimas 24 horas'
      : periodoDias <= 2 ? 'nas últimas 48 horas'
      : periodoDias <= 7 ? `nos últimos ${periodoDias} dias`
      : `desde ${cutoffStr}`;

    const sourceTypeMap = new Map<string, 'google' | 'ssp'>();
    const searchResults: Array<{ url: string; title: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const cidade of cidades) {
      const localidade = `${cidade}, ${estado}`;
      let query: string;

      if (tipoCrime) {
        query = `${tipoCrime} ${localidade} ${periodoLabel}: notícias individuais de ocorrências policiais com data, local e detalhes`;
      } else {
        query = `crimes ocorrências policiais ${localidade} ${periodoLabel}: notícias individuais de roubo furto homicídio tráfico assalto prisão apreensão com data e local`;
      }

      logger.info(`[ManualSearch] ${searchId} query: ${query.substring(0, 100)}...`);

      const dateRestrict = periodoDias <= 1 ? 'd1'
        : periodoDias <= 7 ? 'd7'
        : periodoDias <= 30 ? 'd30'
        : periodoDias <= 60 ? 'd60'
        : `d${periodoDias}`;

      const results = await rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(query, { maxResults: pipelineConfig.searchMaxResults, dateRestrict })
      );

      for (const r of results) {
        if (!seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          sourceTypeMap.set(r.url, 'google');
          searchResults.push(r);
        }
      }
    }

    logger.info(`[ManualSearch] ${searchId} found ${searchResults.length} unique URLs from ${cidades.length} cidades`);

    await db.trackCost({
      source: 'manual_search',
      provider: config.searchBackend as 'google' | 'perplexity',
      cost_usd: cidades.length * 0.005,
      details: { searchId, cidadesCount: cidades.length, resultsCount: searchResults.length },
    });

    // 1b. SSP Scraping — uma vez por estado
    await db.updateSearchProgress(searchId, { stage: 'ssp_scraping', stage_num: 2, total_stages: 6, details: 'Consultando portal SSP' });

    const sspEnabled = await configManager.getBoolean('ssp_scraping_enabled');
    if (sspEnabled) {
      try {
        const jinaApiKey = process.env.JINA_API_KEY || '';
        if (jinaApiKey) {
          const sspResults = await scrapeSSP(estado, { jinaApiKey });
          if (sspResults.length > 0) {
            for (const r of sspResults) {
              if (!seenUrls.has(r.url)) {
                seenUrls.add(r.url);
                sourceTypeMap.set(r.url, 'ssp');
                searchResults.push(r);
              }
            }
            logger.info(`[ManualSearch] ${searchId} found ${sspResults.length} SSP URLs`);
          }
        }
      } catch (error) {
        logger.warn(`[ManualSearch] SSP scraping failed for ${estado}: ${(error as Error).message}`);
      }
    }

    // 1c. Google News RSS (grátis, sem quota)
    const rssEnabled = await configManager.getBoolean('google_news_rss_enabled');
    if (rssEnabled) {
      try {
        for (const cidade of cidades) {
          const rssQuery = tipoCrime
            ? `${tipoCrime} ${cidade} ${estado}`
            : `crime policial ${cidade} ${estado}`;
          const rssResults = await rateLimiter.schedule('google_news_rss', () =>
            fetchGoogleNewsRSS(rssQuery, { maxAgeDays: periodoDias })
          );
          for (const r of rssResults) {
            if (!seenUrls.has(r.url)) {
              seenUrls.add(r.url);
              sourceTypeMap.set(r.url, 'google');
              searchResults.push(r);
            }
          }
        }
        logger.info(`[ManualSearch] ${searchId} after RSS: ${searchResults.length} total URLs`);
      } catch (error) {
        logger.warn(`[ManualSearch] RSS failed: ${(error as Error).message}`);
      }
    }

    // 1d. Section Crawling (usa domínios das URLs já encontradas)
    const sectionCrawlingEnabled = await configManager.getBoolean('section_crawling_enabled');
    if (sectionCrawlingEnabled && searchResults.length > 0) {
      try {
        const maxDomains = await configManager.getNumber('section_crawling_max_domains');
        const sectionResults = await crawlSections(
          searchResults.map(r => r.url),
          { maxDomains, jinaApiKey: process.env.JINA_API_KEY || '' }
        );
        for (const r of sectionResults) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            sourceTypeMap.set(r.url, 'google');
            searchResults.push(r);
          }
        }
        if (sectionResults.length > 0) {
          logger.info(`[ManualSearch] ${searchId} section crawling: +${sectionResults.length} URLs`);
        }
      } catch (error) {
        logger.warn(`[ManualSearch] Section crawling failed: ${(error as Error).message}`);
      }
    }

    // Dedup URLs de todas as fontes
    const dedupedResults = deduplicateResults(searchResults);
    logger.info(`[ManualSearch] ${searchId} total after dedup: ${dedupedResults.length} URLs (Perplexity + SSP + RSS + SectionCrawl)`);

    // 2. Filter 0 - Regex + 3. Filter 1 - GPT Batch
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 3, total_stages: 6, details: `${dedupedResults.length} URLs para filtrar` });

    const rejectedUrls: Array<{ url: string; stage: string; reason: string }> = [];

    const afterFilter0 = pipelineConfig.filter0RegexEnabled
      ? dedupedResults.filter((r) => {
          const pass = filter0Regex(r.url, r.snippet);
          if (!pass) rejectedUrls.push({ url: r.url, stage: 'filter0', reason: 'regex_block' });
          return pass;
        })
      : [...dedupedResults];

    logger.info(`[ManualSearch] ${searchId} filter0: ${dedupedResults.length} → ${afterFilter0.length} (${dedupedResults.length - afterFilter0.length} rejeitadas)`);

    // 3. Filter 1 - GPT Batch
    const snippets = afterFilter0.map((r) => r.snippet);
    const batchResults = await rateLimiter.schedule('openai', () =>
      filter1GPTBatch(snippets)
    );
    const afterFilter1 = afterFilter0.filter((_, index) => {
      const pass = batchResults[index];
      if (!pass) rejectedUrls.push({ url: afterFilter0[index].url, stage: 'filter1', reason: 'gpt_nao_crime' });
      return pass;
    });

    logger.info(`[ManualSearch] ${searchId} filter1: ${afterFilter0.length} → ${afterFilter1.length} (${afterFilter0.length - afterFilter1.length} rejeitadas)`);

    await db.trackCost({
      source: 'manual_search',
      provider: 'openai',
      cost_usd: afterFilter0.length > 0 ? 0.0002 : 0,
      details: { searchId, stage: 'filter1_batch', snippetCount: afterFilter0.length },
    });

    if (afterFilter1.length === 0) {
      await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 6, total_stages: 6 });
      await db.updateSearchStatus(searchId, 'completed', 0);
      logger.info(`[ManualSearch] ${searchId} completed with 0 results`);
      return;
    }

    // 4. Content Fetch via Jina
    await db.updateSearchProgress(searchId, { stage: 'fetching', stage_num: 4, total_stages: 6, details: `${afterFilter1.length} artigos` });

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
    const fetchedContents = contentResults.filter((c): c is FetchedContent => c !== null);
    const validContents = fetchedContents.filter((c) => {
      if (c.content.trim().length < 100) {
        logger.warn(`[ManualSearch] ${searchId} conteudo vazio/curto para ${c.url.substring(0, 60)} (${c.content.length} chars)`);
        rejectedUrls.push({ url: c.url, stage: 'fetch', reason: `conteudo_vazio (${c.content.length} chars)` });
        return false;
      }
      return true;
    });
    logger.info(`[ManualSearch] ${searchId} fetch: ${afterFilter1.length} URLs → ${fetchedContents.length} fetched → ${validContents.length} com conteudo`);

    await db.trackCost({
      source: 'manual_search',
      provider: 'jina',
      cost_usd: validContents.length * 0.002,
      details: { searchId, stage: 'fetch', count: validContents.length },
    });

    // 5. Filter 2 - GPT Full Analysis
    await db.updateSearchProgress(searchId, { stage: 'analyzing', stage_num: 5, total_stages: 6, details: `${validContents.length} conteudos` });

    const results: Array<{
      tipo_crime: string;
      cidade: string;
      bairro: string | null;
      rua: string | null;
      data_ocorrencia: string;
      resumo: string;
      confianca: number;
      source_url: string;
      source_type: 'google' | 'ssp';
    }> = [];

    for (const fetched of validContents) {
      const { extraction: extracted, rejectionReason } = await rateLimiter.schedule('openai', () =>
        filter2GPTWithReason(fetched.content, {
          maxContentChars: pipelineConfig.filter2MaxContentChars,
          minConfidence: pipelineConfig.filter2ConfidenceMin,
        })
      );

      if (!extracted) {
        const reason = rejectionReason || 'unknown';
        rejectedUrls.push({ url: fetched.url, stage: 'filter2', reason });
        logger.info(`[ManualSearch] ${searchId} filter2 REJEITOU ${fetched.url.substring(0, 60)}... motivo: ${reason}`);
        continue;
      }

      // Filter by date range
      const newsDate = new Date(extracted.data_ocorrencia);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodoDias);
      if (newsDate < cutoff) {
        rejectedUrls.push({ url: fetched.url, stage: 'filter2_date', reason: `data=${extracted.data_ocorrencia} fora do periodo (${periodoDias}d)` });
        logger.info(`[ManualSearch] ${searchId} filter2 data fora: ${extracted.data_ocorrencia} (cutoff: ${cutoff.toISOString().split('T')[0]})`);
        continue;
      }

      // Filter by estado — Brave retorna noticias nacionais, filtrar so o estado pedido
      const cidadeExtraida = extracted.cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const estadoLower = estado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const cidadesLower = cidades.map(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const cidadeMatch = cidadesLower.some(c => cidadeExtraida.includes(c) || c.includes(cidadeExtraida));
      const estadoNoResumo = extracted.resumo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(estadoLower);

      if (!cidadeMatch && !estadoNoResumo) {
        rejectedUrls.push({ url: fetched.url, stage: 'filter2_location', reason: `cidade=${extracted.cidade} nao pertence a ${estado}` });
        logger.info(`[ManualSearch] ${searchId} filter2 cidade fora: ${extracted.cidade} (esperado: ${cidades.join(', ')}, ${estado})`);
        continue;
      }

      results.push({
        tipo_crime: extracted.tipo_crime,
        cidade: extracted.cidade,
        bairro: extracted.bairro ?? null,
        rua: extracted.rua ?? null,
        data_ocorrencia: extracted.data_ocorrencia,
        resumo: extracted.resumo,
        confianca: extracted.confianca,
        source_url: fetched.url,
        source_type: sourceTypeMap.get(fetched.url) || 'google',
      });
    }

    logger.info(`[ManualSearch] ${searchId} filter2: ${validContents.length} → ${results.length} (${validContents.length - results.length} rejeitadas)`);

    // Dedup leve entre resultados da própria busca (mesma ocorrência, fontes diferentes)
    const beforeDedup = results.length;
    const dedupKeys = new Set<string>();
    const finalResults = results.filter((r) => {
      const key = `${r.cidade.toLowerCase().trim()}|${r.tipo_crime.toLowerCase().trim()}|${r.data_ocorrencia}`;
      if (dedupKeys.has(key)) {
        logger.debug(`[ManualSearch] ${searchId} dedup intra-busca: ${key} (${r.source_url.substring(0, 50)})`);
        return false;
      }
      dedupKeys.add(key);
      return true;
    });
    if (beforeDedup !== finalResults.length) {
      logger.info(`[ManualSearch] ${searchId} dedup intra-busca: ${beforeDedup} → ${finalResults.length} (${beforeDedup - finalResults.length} duplicatas removidas)`);
    }

    logger.info(`[ManualSearch] ${searchId} total rejeitadas: ${rejectedUrls.length} | motivos: ${JSON.stringify(rejectedUrls.map(r => `${r.stage}:${r.reason}`))}`);

    await db.trackCost({
      source: 'manual_search',
      provider: 'openai',
      cost_usd: validContents.length * 0.0005,
      details: { searchId, stage: 'filter2', analyzed: validContents.length, extracted: results.length },
    });

    // 6. Save results to search_results
    await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 6, total_stages: 6 });

    if (finalResults.length > 0) {
      await db.insertSearchResults(searchId, finalResults, 0);
    }

    await db.updateSearchStatus(searchId, 'completed', finalResults.length);

    const duration = Date.now() - startTime;
    logger.info(`[ManualSearch] ${searchId} completed: ${finalResults.length} results in ${duration}ms`);

    // Push notification ao usuário
    try {
      const tipoCrimeLabel = tipoCrime || 'crimes';
      await sendPushToUser(
        job.data.userId,
        'Busca concluida',
        `Encontramos ${finalResults.length} resultado${finalResults.length !== 1 ? 's' : ''} para ${tipoCrimeLabel} em ${estado}`,
        { search_id: searchId, type: 'manual_search_completed' }
      );
    } catch (pushErr) {
      logger.warn(`[ManualSearch] Push failed: ${(pushErr as Error).message}`);
    }
  } catch (error) {
    logger.error(`[ManualSearch] ${searchId} failed: ${(error as Error).message}`);
    await db.updateSearchStatus(searchId, 'failed');

    // Push notification de falha
    try {
      await sendPushToUser(
        job.data.userId,
        'Busca falhou',
        'Sua busca nao pode ser concluida. Tente novamente.',
        { search_id: searchId, type: 'manual_search_failed' }
      );
    } catch (_) { /* non-fatal */ }

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
      drainDelay: 30000, // 30s entre polls quando fila vazia (reduz uso Redis idle)
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
