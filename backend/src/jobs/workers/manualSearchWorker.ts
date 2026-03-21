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
    const pipelineConfig = {
      searchMaxResults: await configManager.getNumber('search_max_results'),
      contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
    };

    // 1. Perplexity Search — loop por cidade, coleta URLs combinadas
    await db.updateSearchProgress(searchId, { stage: 'google_search', stage_num: 1, total_stages: 6, details: `Pesquisando ${cidades.length} cidades` });

    const periodoLabel = periodoDias <= 1 ? 'nas últimas 24 horas'
      : periodoDias <= 2 ? 'nas últimas 48 horas'
      : periodoDias <= 7 ? `nos últimos ${periodoDias} dias`
      : `nas últimas ${Math.ceil(periodoDias / 7)} semanas`;

    const sourceTypeMap = new Map<string, 'google' | 'ssp'>();
    const searchResults: Array<{ url: string; snippet: string }> = [];
    const seenUrls = new Set<string>();

    for (const cidade of cidades) {
      const localidade = `${cidade}, ${estado}`;
      let query: string;

      if (tipoCrime) {
        query = `Resumo completo de ocorrências policiais relacionadas a ${tipoCrime} em ${localidade} ${periodoLabel}: liste por tipo, com data/hora, bairro, vítimas/suspeitos e fontes oficiais; exclua ficção/novelas; priorize notícias recentes`;
      } else {
        query = `Resumo completo de TODAS ocorrências policiais em ${localidade} ${periodoLabel}: liste por tipo (homicídio, prisão, roubo, tráfico, violência doméstica, apreensões), com data/hora, bairro, vítimas/suspeitos e fontes oficiais (PM/PC/SSP); exclua ficção/novelas; priorize notícias recentes de sites como G1, PM oficial`;
      }

      logger.info(`[ManualSearch] ${searchId} query: ${query.substring(0, 80)}...`);

      const results = await rateLimiter.schedule(config.searchBackend, () =>
        searchProvider.search(query, { maxResults: pipelineConfig.searchMaxResults })
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

    // 2. Filter 0 - Regex + 3. Filter 1 - GPT Batch
    await db.updateSearchProgress(searchId, { stage: 'filtering', stage_num: 3, total_stages: 6, details: `${searchResults.length} URLs para filtrar` });

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
    const validContents = contentResults.filter((c): c is FetchedContent => c !== null);

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
        source_type: sourceTypeMap.get(fetched.url) || 'google',
      });
    }

    await db.trackCost({
      source: 'manual_search',
      provider: 'openai',
      cost_usd: validContents.length * 0.0005,
      details: { searchId, stage: 'filter2', analyzed: validContents.length, extracted: results.length },
    });

    // 6. Save results to search_results
    await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 6, total_stages: 6 });

    if (results.length > 0) {
      await db.insertSearchResults(searchId, results, 0);
    }

    await db.updateSearchStatus(searchId, 'completed', results.length);

    const duration = Date.now() - startTime;
    logger.info(`[ManualSearch] ${searchId} completed: ${results.length} results in ${duration}ms`);

    // Push notification ao usuário
    try {
      const tipoCrimeLabel = tipoCrime || 'crimes';
      await sendPushToUser(
        job.data.userId,
        'Busca concluida',
        `Encontramos ${results.length} resultado${results.length !== 1 ? 's' : ''} para ${tipoCrimeLabel} em ${estado}`,
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
