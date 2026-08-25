// ============================================
// Scan Pipeline - Auto-scan (CRON)
// ============================================
// Usa pipelineCore para stages compartilhados.
// Peculiaridades: dedup contra DB, push por notícia, operation logs.

import * as Sentry from '@sentry/node';
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
import { sendPushForBatch, PushNewsData } from '../../services/notifications/pushService';
import {
  runFilter0,
  runFilter1,
  runContentFetch,
  runFilter2WithEmbedding,
  deduplicateResults,
  diasAtrasISO,
  searchProvider,
  RejectedUrl,
} from './pipelineCore';
import { runIntraBatchDedupLayered } from './intraBatchDedupLayered';

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
    Sentry.captureException(error, { tags: { component: 'scan_pipeline', locationId } });
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
    scanPeriodDays: await configManager.getNumber('scan_period_days'),
    contentFetchConcurrency: await configManager.getNumber('content_fetch_concurrency'),
    filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
    filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
    dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
    // Camada 3 do dedup intra-batch. Mesma chave que a busca manual usa: é a
    // alavanca genérica "confirmar duplicatas com IA" do painel, e vale pros
    // dois caminhos. Default false — só custa GPT se alguém ligar.
    dedupGptConfirmEnabled: await configManager.getBoolean('dedup_gpt_confirm_enabled'),
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

  // Custo REAL do run, somado conforme cada estágio paga.
  //
  // Antes o `operation_logs.cost_usd` vinha do `calculateCost()`, uma fórmula
  // paralela com taxas fixas que não conversava com o `budget_tracking` — os
  // dois números discordavam por construção (achado #4 da auditoria). Agora há
  // uma fonte só: o que é gravado no `budget_tracking` é o que vai no log.
  let custoDoRun = 0;
  const pagar = async (p: Parameters<typeof db.trackCost>[0]): Promise<void> => {
    custoDoRun += p.cost_usd;
    await db.trackCost(p);
  };

  // STAGE 1: Multi-Source URL Collector
  const { allResults, queryCount, sources, requestCount } = await collectUrls(location, pipelineConfig, parentState?.name);
  const searchResults = deduplicateResults(allResults);
  logger.info(`${LOG_PREFIX} Collected ${allResults.length} URLs → ${searchResults.length} unique (sources: ${sources.join(', ')})`);

  // Antes da peneira: a limpeza das rejeições velhas, senão o corte por data
  // abaixo grava e o cleanup roda logo em seguida sobre a mesma tabela.
  await db.cleanupOldRejectedUrls();

  // STAGE 1.5: peneira barata — tira o que já foi analisado antes de gastar GPT
  //
  // O scan roda de hora em hora sobre a MESMA janela (`scan_period_days`), então
  // a SERP devolve os mesmos links rodada após rodada. Sem esta checagem o mesmo
  // artigo era reanalisado até 24x/dia: o Jina tem cache no Redis, o Filter1 e o
  // Filter2 não têm nenhum.
  //
  // Roda antes do Filter0 (e não só antes do Jina) porque a URL já estar em
  // `news_sources` significa que ela JÁ virou notícia salva — não há estágio
  // seguinte que possa mudar essa conclusão, então quanto mais cedo cortar,
  // menos se paga.
  //
  // `searchResults.length` continua sendo o que vai pro `operation_logs`: é o
  // que a SERP entregou, e é com esse número que o baseline de 31/07 foi medido.
  const urlsConhecidas = await db.findKnownSourceUrls(searchResults.map((r) => r.url));
  const ineditos = searchResults.filter((r) => !urlsConhecidas.has(r.url));
  if (urlsConhecidas.size > 0) {
    logger.info(`${LOG_PREFIX} ${urlsConhecidas.size} URL(s) já analisadas em scan anterior — ${ineditos.length} inéditas seguem`);
  }

  // E o que a própria SERP já disse ser velho demais.
  //
  // `publishedAt` chega do estágio 1 desde a 8.4 e era usado só pra decidir
  // quando parar de paginar. Aqui ele evita baixar (Jina) e analisar (Filter2)
  // artigo cuja publicação é anterior à janela — o pós-filtro do Filter2 ia
  // rejeitar do mesmo jeito, depois de pago.
  //
  // Duas escolhas conservadoras, porque `parseSerpDate` é aproximado ("1 mês
  // atrás" = 30 dias) e o preço de um falso negativo é notícia perdida:
  //   - sem data legível, MANTÉM;
  //   - 1 dia de folga sobre a janela, pra imprecisão do parser não cortar a
  //     borda. Quem decide de verdade continua sendo o Filter2, lendo a data da
  //     OCORRÊNCIA no corpo do texto.
  const limiteSerp = diasAtrasISO(pipelineConfig.scanPeriodDays + 1);
  const velhos = ineditos.filter((r) => r.publishedAt && r.publishedAt < limiteSerp);
  const dentroDaJanela = ineditos.filter((r) => !(r.publishedAt && r.publishedAt < limiteSerp));
  if (velhos.length > 0) {
    logger.info(`${LOG_PREFIX} ${velhos.length} URL(s) publicadas antes de ${limiteSerp} — cortadas antes do Jina`);
    await db.insertRejectedUrls(velhos.map((r) => ({
      url: r.url, title: r.title || '', stage: 'serp_data',
      reason: `publicada em ${r.publishedAt} (janela começa ${limiteSerp})`,
      location_id: locationId,
    })));
  }

  if (queryCount > 0) {
    // Bright Data cobra $0.0015 por REQUISIÇÃO (não por query); Brave, $0.005
    // por query, sem paginação interna. `requestCount` vem do provider e conta
    // páginas e retries de verdade — a estimativa `queryCount × ceil(max/20)`
    // que estava aqui errava nos dois sentidos.
    const isBrightData = config.searchBackend === 'brightdata';
    const costPerRequest = isBrightData ? 0.0015 : 0.005;
    await pagar({
      source: 'auto_scan',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave' | 'brightdata',
      cost_usd: requestCount * costPerRequest,
      // `jaVistas`/`ineditas` medem quanto a peneira economizou. Vão aqui porque
      // `operation_logs` tem colunas fixas e este `details` é JSONB livre.
      details: {
        queryCount, totalRequests: requestCount,
        resultsCount: searchResults.length, sources,
        jaVistas: urlsConhecidas.size, ineditas: ineditos.length,
        velhasPelaSerp: velhos.length, analisaveis: dentroDaJanela.length,
        commit: (process.env.RENDER_GIT_COMMIT || 'local').substring(0, 7),
      },
    });
  }

  const rejectedUrls: RejectedUrl[] = [];

  // STAGE 2: Filter0
  const afterFilter0 = runFilter0(dentroDaJanela, pipelineConfig.filter0RegexEnabled, rejectedUrls, LOG_PREFIX);

  // Save rejected from filter0
  const filter0Rejected = rejectedUrls.filter(r => r.stage === 'filter0');
  if (filter0Rejected.length > 0) {
    await db.insertRejectedUrls(filter0Rejected.map(r => ({
      url: r.url, title: '', stage: 'filter0_regex',
      reason: 'URL bloqueada (regex)', location_id: locationId,
    })));
  }

  // STAGE 3: Filter1
  const filter1Result = await runFilter1(afterFilter0, rejectedUrls, LOG_PREFIX);
  const afterFilter1 = filter1Result.passed;

  // Save rejected from filter1
  const filter1Rejected = rejectedUrls.filter(r => r.stage === 'filter1');
  if (filter1Rejected.length > 0) {
    await db.insertRejectedUrls(filter1Rejected.map(r => ({
      url: r.url, title: '', stage: 'filter1_gpt',
      reason: 'Não criminal', location_id: locationId,
    })));
  }

  await pagar({
    source: 'auto_scan', provider: 'openai',
    cost_usd: filter1Result.tokensUsed * 0.00000015, // gpt-4o-mini: $0.15/1M input tokens
    details: { stage: 'filter1_batch', snippetCount: afterFilter0.length, tokensUsed: filter1Result.tokensUsed },
  });

  if (afterFilter1.length === 0) {
    logger.info(`${LOG_PREFIX} No URLs passed filters, stopping`);
    const duration = Date.now() - startTime;
    await db.insertOperationLog({
      location_id: locationId, stage: 'complete',
      urls_processed: searchResults.length, news_found: 0,
      cost_usd: custoDoRun, duration_ms: duration,
    });
    return buildResult(location, searchResults.length, afterFilter0.length, 0, 0, 0, 0, 0, duration);
  }

  // STAGE 4: Content Fetch
  const validContents = await runContentFetch(afterFilter1, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX);

  const jinaTokensTotal = validContents.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);
  await pagar({
    source: 'auto_scan', provider: 'jina',
    cost_usd: jinaTokensTotal * 0.00000005, // Jina: $50/1B tokens = $0.00000005/token
    details: { stage: 'fetch', count: validContents.length, tokensUsed: jinaTokensTotal },
  });

  // STAGE 5: Filter2 + Embedding (com filtro de cidade/estado)
  const locationPostFilter = parentState ? {
    estado: parentState.name,
    cidades: [location.name],
    periodoDias: pipelineConfig.scanPeriodDays,
  } : undefined;

  const filter2Result = await runFilter2WithEmbedding(
    validContents,
    { maxContentChars: pipelineConfig.filter2MaxContentChars, minConfidence: pipelineConfig.filter2ConfidenceMin },
    rejectedUrls, LOG_PREFIX,
    locationPostFilter,
  );
  const extractions = filter2Result.extractions;

  // Save rejected from filter2
  const filter2Rejected = rejectedUrls.filter(r => r.stage === 'filter2');
  if (filter2Rejected.length > 0) {
    await db.insertRejectedUrls(filter2Rejected.map(r => ({
      url: r.url, title: '', stage: r.stage.startsWith('filter2') ? r.stage : 'filter2_gpt',
      reason: r.reason || 'Não criminal (análise)', location_id: locationId,
    })));
  }

  const f2tokens = filter2Result.tokensUsed;
  await pagar({
    source: 'auto_scan', provider: 'openai',
    cost_usd: f2tokens.filter2 * 0.00000015 + f2tokens.embedding * 0.00000002, // gpt-4o-mini + embedding-3-small
    details: { stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length, tokensUsed: f2tokens },
  });

  // STAGE 5.5: Intra-batch dedup em CAMADAS
  //
  // Era `runIntraBatchDedup` (só cosine). Trocado em 02/08 pelo algoritmo em
  // camadas da 8.3, depois de ele provar na busca manual: mesmas 32 extrações,
  // mesmo threshold 0,70 — o antigo entregava 16, o novo entrega 21.
  //
  // É o conserto do achado #3 da auditoria: 26% das linhas de `news` estavam em
  // grupos suspeitos (cidade+tipo+data), com o padrão claro do mesmo evento
  // gravado duas vezes, `bairro` preenchido numa linha e nulo na outra. Só
  // cosine funde crimes DIFERENTES de datas diferentes e deixa passar o mesmo
  // evento visto por dois veículos; a trava geo-temporal resolve as duas coisas
  // antes de qualquer conta de similaridade.
  const dedupIntra = await runIntraBatchDedupLayered(extractions, LOG_PREFIX, {
    similarityThreshold: pipelineConfig.dedupSimilarityThreshold,
    gptConfirmEnabled: pipelineConfig.dedupGptConfirmEnabled,
  });
  const { consolidated, intraMerged } = dedupIntra;

  if (dedupIntra.tokensUsed > 0) {
    await pagar({
      source: 'auto_scan', provider: 'openai',
      cost_usd: dedupIntra.tokensUsed * 0.00000015,
      details: { stage: 'dedup_intra_gpt', tokensUsed: dedupIntra.tokensUsed, intraMerged },
    });
  }

  // STAGE 6: Dedup contra DB + Save
  let newsSaved = 0;
  // 🚨 O push NAO sai daqui de dentro. Ver o bloco depois do laco.
  const paraNotificar: PushNewsData[] = [];
  let duplicatesFound = 0;
  const dedupLayerStats = { layer1: 0, layer2: 0, layer3: 0 };
  // `deduplicateNews` já devolve os tokens da camada 3 e eles eram DESCARTADOS.
  let dedupTokens = 0;

  for (const news of consolidated) {
    try {
      const dedupResult = await deduplicateNews(news, news.sourceUrl, pipelineConfig.dedupSimilarityThreshold, news.extraSourceUrls);
      dedupTokens += dedupResult.tokensUsed;

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
        cidade: news.cidade, estado: news.estado || parentState?.name || null,
        bairro: news.bairro, rua: news.rua,
        data_ocorrencia: news.data_ocorrencia,
        hora_publicacao: news.hora_publicacao,
        titulo: news.titulo, resumo: news.resumo, corpo: news.corpo,
        embedding: news.embedding, confianca: news.confianca,
      });

      await db.insertNewsSource(newsId, news.sourceUrl);
      for (const extraUrl of news.extraSourceUrls) {
        await db.insertNewsSource(newsId, extraUrl);
      }

      // Invalida executive_cache da cidade se a nova notícia é estatística —
      // o resumo executivo usa as estatísticas como input, então precisa regerar.
      if (news.natureza === 'estatistica') {
        await db.invalidateExecutiveCacheByCity(news.cidade);
      }

      paraNotificar.push({
        id: newsId, tipo_crime: news.tipo_crime, titulo: news.titulo ?? null,
        cidade: news.cidade, bairro: news.bairro || null, resumo: news.resumo,
        categoria_grupo: news.categoria_grupo, natureza: news.natureza,
      });

      newsSaved++;
    } catch (err) {
      logger.error(`Failed to save news: ${(err as Error).message}`);
    }
  }

  // 🚨 UM push por aparelho para a rodada inteira, e nao um por noticia.
  // Antes isto vivia dentro do laco acima: em 17/08 uma rodada de 4 noticias da
  // mesma cidade virava 4 vibracoes seguidas no bolso do cliente. O recorte por
  // preferencia continua individual — quem agrupa e o `sendPushForBatch`.
  if (paraNotificar.length > 0) {
    try {
      const pushResult = await sendPushForBatch(paraNotificar);
      if (pushResult.sent) {
        logger.info(`${LOG_PREFIX} Push: ${paraNotificar.length} noticia(s) → ${pushResult.successCount}/${pushResult.deviceCount} aparelhos`);
      } else {
        logger.warn(`${LOG_PREFIX} Push nao enviado: ${pushResult.reason}`);
      }
    } catch (pushErr) {
      logger.error(`${LOG_PREFIX} Push failed: ${(pushErr as Error).message}`);
    }
  }

  logger.info(`${LOG_PREFIX} Dedup stats: ${extractions.length} extracted, ${intraMerged} intra-merged, ${consolidated.length} checked vs DB, ${duplicatesFound} dupes, ${newsSaved} new | Layer1(geo): ${dedupLayerStats.layer1}, Layer2(embed): ${dedupLayerStats.layer2}, Layer3(gpt): ${dedupLayerStats.layer3}`);

  // Cobrado por TOKEN de verdade, e só quando a camada 3 rodou.
  //
  // Era `duplicatesFound * 0.001`: um número inventado, cobrado por CADA
  // duplicata de QUALQUER camada — inclusive a camada 1, que é geo-temporal, em
  // memória, e não gasta um token sequer. Um scan que deduplicasse tudo de graça
  // aparecia no relatório como o mais caro do dia.
  if (dedupTokens > 0) {
    await pagar({
      source: 'auto_scan', provider: 'openai',
      cost_usd: dedupTokens * 0.00000015,
      details: { stage: 'dedup_gpt', duplicates: duplicatesFound, tokensUsed: dedupTokens, layerStats: dedupLayerStats },
    });
  }

  // STAGE 7: Finalize
  await db.updateLocationLastCheck(locationId, new Date());

  const duration = Date.now() - startTime;

  await db.insertOperationLog({
    location_id: locationId, stage: 'complete',
    urls_processed: searchResults.length, news_found: newsSaved,
    cost_usd: custoDoRun, duration_ms: duration,
  });

  logger.info(`${LOG_PREFIX} Completed: ${newsSaved} new, ${duplicatesFound} dupes, cost $${custoDoRun.toFixed(4)}, ${duration}ms`);

  return buildResult(location, searchResults.length, afterFilter0.length, afterFilter1.length, extractions.length, newsSaved, duplicatesFound, custoDoRun, duration);
}

// ============================================
// Multi-Source URL Collector (auto-scan specific)
// ============================================

interface CollectResult {
  allResults: SearchResult[];
  queryCount: number;
  sources: string[];
  /** Requisições HTTP que a paginação de fato gastou — inclui retries. */
  requestCount: number;
}

async function collectUrls(
  location: MonitoredLocation,
  cfg: {
    searchMaxResults: number;
    scanPeriodDays: number;
    multiQueryEnabled: boolean;
    queriesPerScan: number;
    googleNewsRSSEnabled: boolean;
  },
  stateName?: string,
): Promise<CollectResult> {
  const allResults: SearchResult[] = [];
  const sources: string[] = [];
  let queryCount = 0;
  let requestCount = 0;

  // Índice do rodízio de assuntos. Era `Date.now()/60000` — um número novo a
  // cada MINUTO, para um scan que roda de hora em hora: o rodízio saltava
  // posições e a escolha virava sorteio, então um assunto podia não ser
  // perguntado por dias enquanto outro repetia.
  //
  // Dividindo pelo intervalo de scan da própria location, o índice anda
  // exatamente 1 por execução — que é o que faz o rodízio cobrir a lista
  // inteira, em ordem, ao longo do dia.
  const minutosPorScan = Math.max(1, location.scan_frequency_minutes || 60);
  const scanIndex = Math.floor(Date.now() / (minutosPorScan * 60_000));

  // 1. Search provider (Brave/Perplexity)
  const queries = await buildQueries(location, {
    multiQueryEnabled: cfg.multiQueryEnabled,
    queriesPerScan: cfg.queriesPerScan,
    scanIndex,
  });

  // `d1` estava HARDCODED aqui enquanto o `scan_period_days` (default 4, criado
  // justamente pra "recuperar sab/dom na segunda") so era lido la embaixo, no
  // pos-filtro do Filter2. Ate 01/08 isso era inofensivo — o Google ignora o
  // `qdr`. Depois que a paginacao passou a cortar pela janela (`inicioDaJanela`),
  // o `d1` virou trava de verdade: a coleta parava em 24h e o fim de semana se
  // perdia. Agora a coleta e o pos-filtro olham para o MESMO periodo.
  const dateRestrict = `d${cfg.scanPeriodDays}`;

  for (const query of queries) {
    try {
      const opts = {
        maxResults: cfg.searchMaxResults,
        dateRestrict,
        location: { city: location.name, state: stateName, country: 'BR' },
      };

      // `searchWithMeta` devolve quantas requisições HTTP a paginação de fato
      // gastou — o único número honesto pro custo, e o que a busca manual já
      // usa desde a 8.1. `search()` descarta isso, e a estimativa por teto
      // errava nos dois sentidos: pra cima em cidade pequena (a paginação para
      // sozinha ao sair da janela) e pra baixo quando o retry de corpo vazio
      // gasta uma request extra. Provider sem `searchWithMeta` conta 1.
      let results: SearchResult[];
      if (searchProvider.searchWithMeta) {
        const r = await rateLimiter.schedule(config.searchBackend, () =>
          searchProvider.searchWithMeta!(query, opts)
        );
        results = r.results;
        requestCount += r.requestCount;
      } else {
        results = await rateLimiter.schedule(config.searchBackend, () =>
          searchProvider.search(query, opts)
        );
        requestCount += 1;
      }

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

  return { allResults, queryCount, sources, requestCount };
}

// ============================================
// Helpers
// ============================================

// `calculateCost` foi removida em 02/08 (achado #4 da auditoria). Era uma
// segunda fórmula de custo, com taxas fixas escritas à mão, alimentando o
// `operation_logs` enquanto o `budget_tracking` media tokens de verdade — dois
// números que discordavam por construção. Agora existe um só: `custoDoRun`, que
// é a soma do que foi de fato gravado no `budget_tracking` durante o run.

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
