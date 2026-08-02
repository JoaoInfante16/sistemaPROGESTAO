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
import { buildManualSearchQueries } from '../../services/search/queryTemplates';
import { queueName } from '../queueNames';
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

export const manualSearchQueue = new Queue(queueName('manual-search-queue'), { connection: redis });

// Teto do ramo news POR QUERY (nao por cidade). Desde 2026-08-01 a busca manual
// dispara varias queries curtas em vez de uma longa — ver queryTemplates.ts.
// 20 = ate 2 paginas, e a paginacao para sozinha ao sair da janela.
const MANUAL_NEWS_MAX_PER_QUERY = 20;

// Ramo web (indice organico). Mesma SERP paginada do news: ~10 por pagina,
// 7-12s cada. 30 = 3 paginas, ~30s. Subir daqui vira custo de tempo linear.
const MANUAL_WEB_MAX_RESULTS = 30;

// Paginas pedidas de uma vez por query (offsets `start` sao independentes).
// Hoje MANUAL_NEWS_MAX_PER_QUERY=20 da 2 paginas, entao 4 cobre tudo de uma vez;
// o valor ja fica dimensionado pros periodos longos da 8.4, onde o teto sobe e a
// paginacao e que domina o tempo. O auto-scan NAO passa esta opcao e segue serial.
const MANUAL_PAGE_CONCURRENCY = 4;

export interface ManualSearchJobData {
  searchId: string;
  userId: string;
  estado: string;
  cidades: string[];
  periodoDias: number;
  tipoCrime?: string;
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
  const { searchId, estado, cidades, periodoDias, tipoCrime } = job.data;
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

    // Teto de ARTIGOS ANALISADOS por busca — configuravel no admin por periodo.
    //
    // Ate 2026-07-30 este numero cortava no STAGE 1, antes de qualquer filtro:
    // ficavam os N primeiros pela ordem do Google e o resto ia fora sem ninguem
    // olhar se era relevante. Como Filter0 (regex, $0) e Filter1 (GPT em lote,
    // ~$0.0000067/URL) custam ~370x menos que Jina + Filter2 (~$0.0025/artigo),
    // cortar antes deles descartava dado de graca e escolhia mal.
    //
    // Agora o corte acontece DEPOIS do Filter1: entra tudo que a busca achou,
    // os filtros baratos triam, e o teto se aplica a quem sobreviveu. Efeito
    // colateral bom: o custo vira previsivel — o numero que chega no Jina e
    // exatamente este teto, nao um resultado incerto das taxas de rejeicao.
    const maxResultsKey = periodoDias <= 30 ? 'manual_search_max_results_30d'
      : periodoDias <= 60 ? 'manual_search_max_results_60d'
      : 'manual_search_max_results_90d';

    const maxArticlesToAnalyze = await configManager.getNumber(maxResultsKey);
    const pipelineConfig = {
      contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
      filter0RegexEnabled: await configManager.getBoolean('filter0_regex_enabled'),
      dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
    };

    // STAGE 1: Collect URLs
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 1`); return; }
    await db.updateSearchProgress(searchId, { stage: 'searching', stage_num: 1, total_stages: 7, details: `Pesquisando ${cidades.length} cidades` });

    const webEnabled = await configManager.getBoolean('manual_search_web_enabled');
    const { searchResults, sourceTypeMap } = await collectManualSearchUrls(
      { estado, cidades, periodoDias, tipoCrime },
      LOG_PREFIX,
      webEnabled,
    );

    // Bright Data $0.0015/request. Os dois ramos usam a mesma SERP paginada,
    // 10 resultados por request. Web so conta se estiver ligado.
    // Brave: $0.005/query (sem paginacao interna)
    //
    // Esta conta e o TETO, nao o real. Antes ela superestimava, porque a paginacao
    // parava sozinha ao sair da janela. Com o lote de 8.1 ela ficou justa: como
    // MANUAL_PAGE_CONCURRENCY (4) cobre as 2 paginas de MANUAL_NEWS_MAX_PER_QUERY,
    // as duas sao sempre pedidas — a que o serial economizava agora e paga como
    // pagina especulativa (o provider loga quantas foram). Em compensacao o retry
    // de corpo vazio pode gastar 1 request a mais que o teto, entao numa falha
    // rara isto subestima. Para o numero exato, `requestCount` do provider.
    const isBrightData = config.searchBackend === 'brightdata';
    const queriesPorCidade = buildManualSearchQueries('x', tipoCrime).length;
    const newsReqs = queriesPorCidade * Math.ceil(MANUAL_NEWS_MAX_PER_QUERY / 10);
    const webReqs = webEnabled ? Math.ceil(MANUAL_WEB_MAX_RESULTS / 10) : 0;
    const requestsPerCity = isBrightData ? newsReqs + webReqs : 1;
    const costPerRequest = isBrightData ? 0.0015 : 0.005;
    const totalRequests = cidades.length * requestsPerCity;
    await db.trackCost({
      source: 'manual_search',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave' | 'brightdata',
      cost_usd: totalRequests * costPerRequest,
      // `commit` identifica QUAL codigo processou o job. O /health so identifica
      // o servico web; se um segundo processo (outro servico do Render, um `npm
      // run dev` local esquecido) estiver ligado no mesmo Redis, e o worker dele
      // que pega o job — e so isto aqui denuncia.
      details: {
        searchId, cidadesCount: cidades.length, requestsPerCity, totalRequests,
        resultsCount: searchResults.length,
        queries: buildManualSearchQueries(cidades[0], tipoCrime),
        commit: (process.env.RENDER_GIT_COMMIT || 'local').substring(0, 7),
      },
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

    // Freio de custo — aplicado aqui, na fronteira entre o barato e o caro.
    // Tudo acima deste ponto custa quase nada; tudo abaixo custa ~$0.0025/artigo.
    // O teto e por busca (nao por cidade), entao busca multi-cidade nao multiplica
    // a conta: 1 cidade e 5 cidades gastam o mesmo no Jina + Filter2.
    const totalCap = maxArticlesToAnalyze * cidades.length;
    const toAnalyze = afterFilter1.slice(0, totalCap);
    if (afterFilter1.length > totalCap) {
      for (const dropped of afterFilter1.slice(totalCap)) {
        rejectedUrls.push({ url: dropped.url, stage: 'cap', reason: `acima do teto de ${totalCap} artigos` });
      }
      logger.info(`${LOG_PREFIX} teto de analise: ${afterFilter1.length} → ${totalCap} artigos (${afterFilter1.length - totalCap} cortados)`);
    }

    // STAGE 4: Content Fetch
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 4`); return; }
    await db.updateSearchProgress(searchId, { stage: 'fetching', stage_num: 4, total_stages: 7, details: `${toAnalyze.length} artigos` });
    const validContents = await runContentFetch(toAnalyze, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX);

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
  logPrefix: string,
  webEnabled: boolean,
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

    // Queries curtas e SEM o estado — ver o cabecalho de queryTemplates.ts para
    // as medicoes. Resumo: `polícia São José` trouxe materia de 44 minutos atras;
    // `polícia São José SC` parou em 3 semanas. E a query longa que se usava aqui
    // (`notícias policiais ocorrências crime <cidade> <estado>`) rendia 4 de 10
    // dentro da janela contra 10 de 10 da curta.
    const queries = buildManualSearchQueries(cidade, tipoCrime);
    const webQuery = queries[0];

    logger.info(`${logPrefix} [${cidade}] ${queries.length} query(s) news${webEnabled ? ' + web' : ''} | ${dateRestrict} | ${JSON.stringify(queries)}`);

    const [webResults, newsResults] = await Promise.allSettled([
      // Web (organic) — mesmo texto do ramo news, mas no indice web do Google:
      // pega portais e sites que nao aparecem no indice de noticias.
      //
      // DESLIGADO por default desde 2026-08-01 (config manual_search_web_enabled).
      // Motivo: o tempo de coleta do scraper explodiu apos 21/07 — snapshots da
      // propria conta saltaram de 17-70s para 660-978s, com variancia enorme
      // (mesma cidade, 10 min de diferenca: 22s vs 667s). Assinatura de scraper
      // apanhando pra passar no SearchGuard do Google. Nao e incidente com data
      // pra acabar; e o novo normal do indice organico. O ramo news (tbm=nws) nao
      // sofre disso e entrega ~30 em 50s de forma estavel.
      // Religar quando/se o cenario mudar — a medicao esta em AUDITORIA_2026-07-30.
      webEnabled
        ? rateLimiter.schedule(config.searchBackend, () =>
            searchProvider.search(webQuery, {
              maxResults: MANUAL_WEB_MAX_RESULTS,
              dateRestrict,
              searchMode: 'web',
              location: { city: cidade, state: estado, country: 'BR' },
            })
          )
        : Promise.resolve([]),
      // News — as queries rodam EM PARALELO, e cada uma pagina em lote.
      //
      // Ate 01/08 rodavam em serie, com base na suspeita de que a zone SERP
      // aceitava ~1 requisicao por vez. A documentacao oficial diz o contrario
      // em uma linha: a SERP API NAO tem limite de concorrencia, so de vazao —
      // 100 QPS por conta. Uma busca inteira faz ~0.07 QPS, tres ordens de
      // grandeza abaixo. A serializacao custava ~3x no estagio 1 e nao comprava
      // nada. Ver DEV_LOG, bloco "Medicoes que NAO devem ser refeitas".
      (async () => {
        const settled = await Promise.allSettled(
          queries.map((q) =>
            rateLimiter.schedule(config.searchBackend, () =>
              searchProvider.search(q, {
                maxResults: MANUAL_NEWS_MAX_PER_QUERY,
                dateRestrict,
                searchMode: 'news',
                pageConcurrency: MANUAL_PAGE_CONCURRENCY,
                location: { city: cidade, state: estado, country: 'BR' },
              })
            )
          )
        );

        // Uma query ruim nao pode derrubar as outras — por isso allSettled e nao
        // all. Era o que o try/catch dentro do for garantia antes.
        const acumulado: Array<{ url: string; title: string; snippet: string }> = [];
        settled.forEach((s, i) => {
          if (s.status === 'fulfilled') {
            acumulado.push(...s.value);
            logger.info(`${logPrefix} [${cidade}] "${queries[i]}" → ${s.value.length}`);
          } else {
            logger.warn(`${logPrefix} [${cidade}] query "${queries[i]}" falhou: ${(s.reason as Error)?.message ?? s.reason}`);
          }
        });
        return acumulado;
      })(),
    ]);

    if (webResults.status === 'fulfilled') {
      for (const r of webResults.value) cityResults.push({ ...r, source: 'web' });
    } else {
      logger.warn(`${logPrefix} [${cidade}] Web failed: ${webResults.reason}`);
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
    queueName('manual-search-queue'),
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
