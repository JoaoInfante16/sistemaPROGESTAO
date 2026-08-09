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
import { AchadoProgresso } from '../../database/queries';
import { logger } from '../../middleware/logger';
import { rateLimiter } from '../../services/rateLimiter';
import { configManager } from '../../services/configManager';
import { sendPushToUser } from '../../services/notifications/pushService';
import { buildManualSearchQueries } from '../../services/search/queryTemplates';
import { getMetroRegionForCities } from '../../services/location/metroRegion';
import { geocodePoint } from '../../services/geocoding/nominatim';
import { queueName } from '../queueNames';
import {
  runFilter0,
  runFilter1,
  runContentFetch,
  runFilter2WithEmbedding,
  deduplicateResults,
  diasAtrasISO,
  searchProvider,
  RejectedUrl,
} from '../pipeline/pipelineCore';
import { runIntraBatchDedupLayered } from '../pipeline/intraBatchDedupLayered';
import { SearchResult, SearchOptions } from '../../services/search/SearchProvider';
import { newsMaxPorQuery, analiseMaxPorBusca } from '../../services/search/manualSearchCaps';

export const manualSearchQueue = new Queue(queueName('manual-search-queue'), { connection: redis });

// Tetos de coleta e de analise vem de manualSearchCaps.ts — sao funcoes
// continuas do periodo, sem faixas. Ficam la, e nao aqui, porque este modulo
// cria uma Queue do BullMQ no import.

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
  /**
   * Assuntos escolhidos na tela (03/08). Cada um vira uma query e um teto novo
   * no indice. Ausente = a lista do painel (`search_subjects`).
   */
  assuntos?: string[];
  /**
   * ⚠️ FORMATO ANTIGO — nao usar em codigo novo. Fica porque o Redis e
   * compartilhado e um job enfileirado antes deste deploy chega aqui com o campo
   * velho; sem isto, ele rodaria a lista inteira em vez do tipo que o usuario
   * escolheu. Normalizado logo na entrada de `processManualSearch`.
   */
  tipoCrime?: string;
}

// ============================================
// Progresso ao vivo dentro do estagio (8.5)
// ============================================
// Ate aqui o progresso era 7 degraus. Dentro do estagio 4 nada se mexia por
// dezenas de segundos — numa busca de 180 dias, por MINUTOS. E exatamente ai que
// parece travado, e e o que faz o usuario matar o app.
//
// A escrita e ESTRANGULADA: sem isso, uma busca de 300 artigos geraria 300
// escritas no Supabase por estagio. O app faz polling a cada 3s, entao escrever
// mais que isso nao aparece pra ninguem.
const PROGRESSO_INTERVALO_MS = 2000;
const ACHADOS_VISIVEIS = 5;

function criarReporter(searchId: string, logPrefix: string) {
  let ultimaEscrita = 0;
  let emVoo: Promise<void> = Promise.resolve();
  const achados: AchadoProgresso[] = [];

  function reportar(
    base: { stage: string; stage_num: number; total_stages: number; details?: string },
    feitos: number,
    total: number,
    achado?: AchadoProgresso,
  ): void {
    if (achado) {
      achados.unshift(achado);
      if (achados.length > ACHADOS_VISIVEIS) achados.pop();
    }

    const agora = Date.now();
    // Sempre deixa passar o ultimo item: e o que fecha a barra em 100%.
    if (agora - ultimaEscrita < PROGRESSO_INTERVALO_MS && feitos < total) return;
    ultimaEscrita = agora;

    // Fire-and-forget: progresso nunca segura a pipeline nem a derruba.
    emVoo = db
      .updateSearchProgress(searchId, { ...base, feitos, total, achados: [...achados] })
      .catch((err) => {
        logger.warn(`${logPrefix} progresso falhou: ${(err as Error).message}`);
      });
  }

  /**
   * Espera a ultima escrita aterrissar. O worker chama isto ao TROCAR de estagio.
   *
   * Sem isso ha uma corrida real: a escrita do estagio 4, disparada sem await,
   * pode chegar ao banco DEPOIS da do estagio 5 e sobrescreve-la — o app veria o
   * progresso andar pra tras. Custa alguns milissegundos, tres vezes por busca.
   */
  async function aguardar(): Promise<void> {
    await emVoo;
  }

  return { reportar, aguardar };
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
  const { searchId, estado, cidades, periodoDias } = job.data;
  const startTime = Date.now();
  const LOG_PREFIX = `[ManualSearch] ${searchId}`;

  // Normaliza o formato antigo (`tipoCrime`, uma string) no novo (`assuntos`,
  // lista). Job enfileirado antes do deploy de 03/08 chega com o campo velho —
  // o Redis e compartilhado e a fila nao esvazia no deploy.
  const assuntos: string[] | undefined = job.data.assuntos?.length
    ? job.data.assuntos
    : job.data.tipoCrime
      ? [job.data.tipoCrime]
      : undefined;

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
    // Uma base so, escalada pelo periodo — ver analiseMaxPorBusca. `0` = ABERTO,
    // que e o default: analisa tudo que passou no Filter1.
    //
    // Chave NOVA (`manual_search_analysis_cap`), e nao a `_30d` de antes: aquela
    // significa "teto de COLETA do stage 1" na `main`, que roda em producao com
    // o MESMO banco. Detalhes no configManager.
    const base30d = await configManager.getNumber('manual_search_analysis_cap');
    const maxArticlesToAnalyze = analiseMaxPorBusca(periodoDias, base30d);
    const pipelineConfig = {
      // Chave PRÓPRIA da busca manual (default 10). A `content_fetch_concurrency`
      // (5) é lida também pelo scanPipeline e mora no banco compartilhado —
      // subir aquela mexeria no auto-scan e na produção junto.
      contentFetchConcurrency: await configManager.getNumber('manual_search_fetch_concurrency'),
      filter2ConfidenceMin: await configManager.getNumber('filter2_confidence_min'),
      filter2MaxContentChars: await configManager.getNumber('filter2_max_content_chars'),
      filter0RegexEnabled: await configManager.getBoolean('filter0_regex_enabled'),
      dedupSimilarityThreshold: await configManager.getNumber('dedup_similarity_threshold'),
      // Camada 3 do dedup. Default false: so vale a pena se a faixa duvidosa
      // estiver errando muito, e ai custa GPT por par.
      dedupGptConfirmEnabled: await configManager.getBoolean('dedup_gpt_confirm_enabled'),
      // Ate onde "fora do periodo" ainda vale a pena. Quem protege o orcamento e
      // o teto de analise, nao o horizonte — por isso ele pode ser generoso.
      horizonteDias: await configManager.getNumber('manual_search_horizon_days'),
    };

    // STAGE 1: Collect URLs
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 1`); return; }
    await db.updateSearchProgress(searchId, { stage: 'searching', stage_num: 1, total_stages: 7, details: `Pesquisando ${cidades.length} cidades` });

    const webEnabled = await configManager.getBoolean('manual_search_web_enabled');
    const { searchResults, sourceTypeMap, requestCount } = await collectManualSearchUrls(
      { estado, cidades, periodoDias, assuntos },
      LOG_PREFIX,
      webEnabled,
    );

    // Bright Data $0.0015/request; Brave $0.005/query (sem paginacao interna).
    //
    // Ate a 8.4 isto era ESTIMATIVA por teto: queries x paginas maximas. Com o
    // teto de coleta escalando com o periodo (7 paginas em 30 dias, 22 em um ano)
    // e a paginacao parando sozinha ao sair da janela, a estimativa passou a errar
    // muito — pra cima em cidade pequena, e pra baixo quando o retry de corpo
    // vazio gasta uma request extra. Agora vem do `requestCount` do proprio
    // provider: numero real, incluindo paginas especulativas e retries.
    const isBrightData = config.searchBackend === 'brightdata';
    const costPerRequest = isBrightData ? 0.0015 : 0.005;
    // Uma chamada só: as queries são as mesmas para todas as cidades (só muda o
    // nome no fim). A lista vem da tela desde 03/08, ou do painel se a tela não
    // mandou nada.
    const queriesDaBusca = await buildManualSearchQueries(cidades[0], assuntos);
    await db.trackCost({
      source: 'manual_search',
      provider: config.searchBackend as 'google' | 'perplexity' | 'brave' | 'brightdata',
      cost_usd: requestCount * costPerRequest,
      // `commit` identifica QUAL codigo processou o job. O /health so identifica
      // o servico web; se um segundo processo (outro servico do Render, um `npm
      // run dev` local esquecido) estiver ligado no mesmo Redis, e o worker dele
      // que pega o job — e so isto aqui denuncia.
      details: {
        searchId, cidadesCount: cidades.length,
        totalRequests: requestCount,
        tetoEstimado: cidades.length * (queriesDaBusca.length * Math.ceil(newsMaxPorQuery(periodoDias) / 10) + (webEnabled ? Math.ceil(MANUAL_WEB_MAX_RESULTS / 10) : 0)),
        resultsCount: searchResults.length,
        periodoDias,
        queries: queriesDaBusca,
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
    const filter1Result = await runFilter1(afterFilter0, rejectedUrls, LOG_PREFIX, assuntos);
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
    const totalCap = maxArticlesToAnalyze * cidades.length;

    // ORDENAR ANTES DE CORTAR. O teto cai aqui, mas a classificacao em baldes so
    // acontece no Filter2 — sem ordenar, materia velha consome a cota e mata uma
    // do periodo pedido. So importa com horizonte longo, que e o que a 8.4 abre.
    //
    // Sem data conhecida NAO e penalizado: nao saber nao e motivo pra descer na
    // fila. Dentro de cada grupo a ordem original e preservada (sort estavel), e
    // ela ja vem util — com `sbd:1` a SERP chega ordenada da mais nova pra mais
    // velha.
    //
    // O ramo WEB desempata por ULTIMO, e isso e correcao de um defeito real
    // (02/08). A ordem de coleta empilha o web antes do news, entao com teto
    // ligado o web ocupava as primeiras vagas da analise. Medido em Salvador/30d
    // com teto 40: o web consumiu ~29 das 40 vagas e entregou **1 de 23**
    // resultados; o news entregou 22 com as vagas que sobraram. O indice
    // organico e complemento — nao pode passar na frente do alicerce.
    const inicioJanela = diasAtrasISO(periodoDias);
    const prioridade = (r: { url: string; publishedAt?: string }): number => {
      const foraDaJanela = r.publishedAt && r.publishedAt < inicioJanela ? 1 : 0;
      const ehWeb = sourceTypeMap.get(r.url) === 'web' ? 1 : 0;
      return foraDaJanela * 2 + ehWeb;
    };
    const ordenado = [...afterFilter1].sort((a, b) => prioridade(a) - prioridade(b));

    // `slice(0, Infinity)` devolve tudo — sem teto, nada e cortado e o bloco
    // de rejeicao abaixo nao roda.
    const toAnalyze = ordenado.slice(0, totalCap);
    if (!Number.isFinite(totalCap)) {
      logger.info(`${LOG_PREFIX} teto de analise ABERTO — analisando os ${ordenado.length} artigos que passaram no Filter1 (~$${(ordenado.length * 0.0025).toFixed(2)})`);
    } else if (ordenado.length > totalCap) {
      for (const dropped of ordenado.slice(totalCap)) {
        rejectedUrls.push({ url: dropped.url, stage: 'cap', reason: `acima do teto de ${totalCap} artigos` });
      }
      const cortadosDentroDaJanela = ordenado.slice(totalCap).filter((r) => prioridade(r) === 0).length;
      logger.info(`${LOG_PREFIX} teto de analise: ${afterFilter1.length} → ${totalCap} artigos (${afterFilter1.length - totalCap} cortados, ${cortadosDentroDaJanela} deles dentro da janela)`);
    }

    // STAGE 4: Content Fetch
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 4`); return; }
    const progresso = criarReporter(searchId, LOG_PREFIX);
    const baseFetch = { stage: 'fetching', stage_num: 4, total_stages: 7, details: `${toAnalyze.length} artigos` };
    await db.updateSearchProgress(searchId, { ...baseFetch, feitos: 0, total: toAnalyze.length });
    const validContents = await runContentFetch(
      toAnalyze, pipelineConfig.contentFetchConcurrency, rejectedUrls, LOG_PREFIX,
      (feitos, total) => progresso.reportar(baseFetch, feitos, total),
    );
    await progresso.aguardar();

    const jinaTokensTotal = validContents.reduce((sum, c) => sum + (c.tokensUsed || 0), 0);
    await db.trackCost({
      source: 'manual_search', provider: 'jina',
      cost_usd: jinaTokensTotal * 0.00000005,
      details: { searchId, stage: 'fetch', count: validContents.length, tokensUsed: jinaTokensTotal },
    });

    // Regiao metropolitana — uma chamada de GPT por busca, cacheada 30 dias no
    // Redis. Falha aqui devolve lista vazia e a busca segue como antes da 8.2.
    const cidadesRegiao = await getMetroRegionForCities(cidades, estado);
    if (cidadesRegiao.length > 0) {
      logger.info(`${LOG_PREFIX} regiao metropolitana: ${cidadesRegiao.length} municipios (${cidadesRegiao.slice(0, 6).join(', ')}${cidadesRegiao.length > 6 ? '...' : ''})`);
    }

    // STAGE 5: Filter2 + Embedding (com filtro de cidade/estado e data)
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 5`); return; }
    const baseAnalise = { stage: 'analyzing', stage_num: 5, total_stages: 7, details: `${validContents.length} conteudos` };
    await db.updateSearchProgress(searchId, { ...baseAnalise, feitos: 0, total: validContents.length });
    const filter2Result = await runFilter2WithEmbedding(
      validContents,
      { maxContentChars: pipelineConfig.filter2MaxContentChars, minConfidence: pipelineConfig.filter2ConfidenceMin, assuntos },
      rejectedUrls, LOG_PREFIX,
      // `classificar` so aqui: o auto-scan chama a MESMA funcao sem esta opcao e
      // segue descartando igual a sempre.
      { periodoDias, estado, cidades, classificar: true, cidadesRegiao, horizonteDias: pipelineConfig.horizonteDias },
      sourceTypeMap,
      (feitos, total, achado) => progresso.reportar(baseAnalise, feitos, total, achado),
    );
    await progresso.aguardar();
    const extractions = filter2Result.extractions;

    const f2tokens = filter2Result.tokensUsed;
    await db.trackCost({
      source: 'manual_search', provider: 'openai',
      cost_usd: f2tokens.filter2 * 0.00000015 + f2tokens.embedding * 0.00000002,
      details: { searchId, stage: 'filter2+embedding', analyzed: validContents.length, extracted: extractions.length, tokensUsed: f2tokens },
    });

    // STAGE 6: Dedup intra-batch EM CAMADAS (8.3)
    //
    // Funcao NOVA, em arquivo proprio. A `runIntraBatchDedup` do pipelineCore
    // segue intacta e e a que o auto-scan usa — ordem do Joao em 02/08.
    //
    // A 8.2 precisou deduplicar por balde separado porque o algoritmo antigo
    // elegia o lider do cluster por confianca: uma noticia principal podia se
    // fundir com uma de cidade vizinha e SUMIR do principal. Aqui isso nao
    // acontece por dois motivos — a trava geo-temporal exige mesma cidade, e os
    // sinalizadores do cluster sao inclusivos (basta um membro ser do periodo
    // pedido pro cluster inteiro ser). Entao os baldes voltam a ser deduplicados
    // juntos, o que tambem elimina a materia repetida entre principal e extras.
    if (await isCancelled(searchId)) { logger.info(`${LOG_PREFIX} cancelled before stage 6`); return; }
    await db.updateSearchProgress(searchId, { stage: 'dedup', stage_num: 6, total_stages: 7, details: `Consolidando ${extractions.length} resultados` });

    const dedup = await runIntraBatchDedupLayered(extractions, LOG_PREFIX, {
      similarityThreshold: pipelineConfig.dedupSimilarityThreshold,
      gptConfirmEnabled: pipelineConfig.dedupGptConfirmEnabled,
    });
    const consolidated = dedup.consolidated;

    if (dedup.tokensUsed > 0) {
      await db.trackCost({
        source: 'manual_search', provider: 'openai',
        cost_usd: dedup.tokensUsed * 0.00000015,
        details: { searchId, stage: 'dedup_gpt_confirm', tokensUsed: dedup.tokensUsed },
      });
    }

    // Build final results with sources array
    const finalResults = consolidated.map(news => ({
      tipo_crime: news.tipo_crime,
      natureza: news.natureza,
      categoria_grupo: news.categoria_grupo,
      cidade: news.cidade,
      // `estado` vinha do Filter2 e era descartado aqui. Sem ele o app nao tem
      // como mostrar a UF no card de cidade vizinha.
      estado: news.estado ?? null,
      bairro: news.bairro ?? null,
      rua: news.rua ?? null,
      data_ocorrencia: news.data_ocorrencia,
      // Mesmo cuidado do `estado` logo acima: campo que o Filter2 extrai e o
      // mapeamento final esquece some sem erro nenhum — o app so recebe null.
      titulo: news.titulo ?? null,
      hora_publicacao: news.hora_publicacao ?? null,
      resumo: news.resumo,
      confianca: news.confianca,
      source_url: news.sourceUrl,
      source_type: news.sourceType,
      sources: news.sources,
      // Ausentes quando falsos — resultado principal continua com o shape de antes.
      ...(news.fora_do_periodo ? { fora_do_periodo: true } : {}),
      ...(news.cidade_vizinha ? { cidade_vizinha: true } : {}),
    }));

    // `total_results` conta SO o principal: alimenta o push, o historico e o
    // contador da tela. Extra e bonus, nao pode inflar o numero que o cliente le.
    const totalPrincipal = finalResults.filter((r) => !r.fora_do_periodo && !r.cidade_vizinha).length;
    const totalExtras = finalResults.length - totalPrincipal;

    logger.info(`${LOG_PREFIX} total rejeitadas: ${rejectedUrls.length} | motivos: ${JSON.stringify(rejectedUrls.map(r => `${r.stage}:${r.reason}`))}`);

    // Persistir os motivos de rejeição (o auto-scan já fazia; a busca manual só
    // logava e perdia). Sem isto, descobrir POR QUE uma busca rendeu pouco exige
    // re-rodar o pipeline pagando Jina + GPT — foi o que aconteceu com
    // Goiânia/30d em 03/08 (74 conteúdos → 27 extrações, motivo desconhecido).
    //
    // Best-effort: falha aqui não pode derrubar uma busca que já deu certo.
    try {
      await db.insertRejectedUrls(
        rejectedUrls.map((r) => ({
          url: r.url,
          title: '',
          stage: r.stage,
          reason: r.reason || '',
          search_id: searchId,
        }))
      );
    } catch (rejErr) {
      logger.warn(`${LOG_PREFIX} Falha ao persistir rejeicoes: ${(rejErr as Error).message}`);
    }

    // STAGE 7: Save
    //
    // `details` com o numero final: e o unico estagio que nao escrevia nenhum,
    // e sem ele a etapa "juntar as repetidas" da tela de espera nao consegue
    // mostrar quanto o dedup cortou (`47 -> 31`). O numero ja esta na mao.
    await db.updateSearchProgress(searchId, { stage: 'saving', stage_num: 7, total_stages: 7, details: `${totalPrincipal} ocorrencias` });

    if (finalResults.length > 0) {
      await db.insertSearchResults(searchId, finalResults, 0);
    }

    await db.updateSearchStatus(searchId, 'completed', totalPrincipal);

    const duration = Date.now() - startTime;
    logger.info(`${LOG_PREFIX} completed: ${totalPrincipal} results${totalExtras ? ` (+${totalExtras} extras)` : ''} in ${duration}ms`);

    // Push notification
    try {
      const cidadesLabel = cidades.length <= 2 ? cidades.join(' e ') : `${cidades.length} cidades`;
      logger.info(`${LOG_PREFIX} Sending push to user ${job.data.userId}`);
      const pushResult = await sendPushToUser(
        job.data.userId,
        `Busca concluída — ${totalPrincipal} resultado${totalPrincipal !== 1 ? 's' : ''}`,
        // Com ate 20 assuntos escolhidos, listar todos estouraria a linha do
        // push. Um so cabe e diz mais que "3 assuntos"; acima disso, a contagem.
        `${cidadesLabel} (${estado}) · ${assuntosLabel(assuntos)} · ${periodoDias} dias`,
        { search_id: searchId, type: 'manual_search_completed' }
      );
      logger.info(`${LOG_PREFIX} Push result: sent=${pushResult.sent}, devices=${pushResult.deviceCount}, reason=${pushResult.reason || 'ok'}`);
    } catch (pushErr) {
      logger.warn(`${LOG_PREFIX} Push failed: ${(pushErr as Error).message}`);
    }

    // Aquece o geocode DEPOIS de entregar. Ver aquecerGeocode.
    await aquecerGeocode(finalResults, estado, LOG_PREFIX);
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

/**
 * Geocodifica os resultados pra o relatorio abrir pronto.
 *
 * ⚠️ POR QUE ISTO EXISTE (medido em 03/08): o mapa do relatorio da busca manual
 * **nunca carregava**. `buildMapPoints` geocodifica num `for` sequencial, o
 * Nominatim exige 1,1s entre chamadas (politica deles, nao da pra paralelizar)
 * e cada ponto custa ate 3 chamadas no fallback rua->bairro->cidade. Uma busca
 * de 77 resultados levava de 85s a 254s contra um timeout de **15s** no app —
 * e o `catch` do app so apagava o loading, entao o mapa ficava vazio SEM erro.
 *
 * QUANDO isto roda importa tanto quanto o QUE ele faz: **depois** de gravar os
 * resultados, marcar a busca como concluida e mandar o push. O usuario ja tem
 * o que pediu; o aquecimento acontece enquanto ele navega, e quando ele abrir o
 * relatorio os pontos ja estao no Redis (TTL de 90 dias). Colocar isto antes
 * acrescentaria ~85s a uma busca que o usuario esta olhando.
 *
 * Best-effort de ponta a ponta: falhar aqui nao pode derrubar uma busca que ja
 * deu certo e ja foi entregue. No pior caso o relatorio geocodifica sob demanda,
 * como fazia antes.
 */
async function aquecerGeocode(
  resultados: Array<Record<string, unknown>>,
  estado: string,
  logPrefix: string,
): Promise<void> {
  const inicio = Date.now();
  let feitos = 0;

  try {
    for (const r of resultados) {
      const cidade = (r.cidade as string) || '';
      if (!cidade) continue;
      // `estado` do item quando existe (item de cidade vizinha pode divergir),
      // senao o da busca.
      const uf = (r.estado as string) || estado;
      await geocodePoint(r.rua as string | null, r.bairro as string | null, cidade, uf);
      feitos++;
    }
    logger.info(`${logPrefix} geocode aquecido: ${feitos} pontos em ${Math.round((Date.now() - inicio) / 1000)}s`);
  } catch (err) {
    logger.warn(`${logPrefix} aquecimento do geocode falhou em ${feitos}/${resultados.length}: ${(err as Error).message}`);
  }
}

/** Rotulo curto dos assuntos, pro corpo do push. */
function assuntosLabel(assuntos?: string[]): string {
  if (!assuntos || assuntos.length === 0) return 'todos os assuntos';
  if (assuntos.length === 1) return assuntos[0];
  return `${assuntos.length} assuntos`;
}

// ============================================
// URL Collection (manual search specific)
// ============================================

async function collectManualSearchUrls(
  params: { estado: string; cidades: string[]; periodoDias: number; assuntos?: string[] },
  logPrefix: string,
  webEnabled: boolean,
): Promise<{ searchResults: SearchResult[]; sourceTypeMap: Map<string, string>; requestCount: number }> {
  const { estado, cidades, periodoDias, assuntos } = params;
  const sourceTypeMap = new Map<string, string>();
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();
  const newsMax = newsMaxPorQuery(periodoDias);
  let requestCount = 0;

  // `searchWithMeta` devolve quantas requisicoes HTTP a paginacao de fato gastou
  // — e o unico numero honesto pro custo. `search()` descarta isso. Provider que
  // nao implementa cai no caminho antigo e conta 1 por query.
  const buscar = async (query: string, opts: SearchOptions): Promise<SearchResult[]> => {
    if (searchProvider.searchWithMeta) {
      const r = await searchProvider.searchWithMeta(query, opts);
      requestCount += r.requestCount;
      return r.results;
    }
    requestCount += 1;
    return searchProvider.search(query, opts);
  };

  // Sem arredondar para faixa: uma busca de 45 dias virava `d60` e paginava 15
  // dias a mais do que o pedido. O periodo e livre, o dateRestrict acompanha.
  const dateRestrict = `d${periodoDias}`;

  // 1 + 2 em PARALELO por cidade: Web Top100 (volume) + News paginado (qualidade)
  const cityPromises = cidades.map(async (cidade) => {
    const cityResults: Array<SearchResult & { source: string }> = [];

    // Queries curtas e SEM o estado — ver o cabecalho de queryTemplates.ts para
    // as medicoes. Resumo: `polícia São José` trouxe materia de 44 minutos atras;
    // `polícia São José SC` parou em 3 semanas. E a query longa que se usava aqui
    // (`notícias policiais ocorrências crime <cidade> <estado>`) rendia 4 de 10
    // dentro da janela contra 10 de 10 da curta.
    const queries = await buildManualSearchQueries(cidade, assuntos);
    const webQuery = queries[0];

    logger.info(`${logPrefix} [${cidade}] ${queries.length} query(s) news${webEnabled ? ' + web' : ''} | ${dateRestrict} | ${JSON.stringify(queries)}`);

    const [webResults, newsResults] = await Promise.allSettled([
      // Web (organic) — mesmo texto do ramo news, mas no indice web do Google:
      // pega portais e sites que nao aparecem no indice de noticias.
      //
      // ⚠️ Este comentario dizia "DESLIGADO por default" — estava DESATUALIZADO.
      // Verificado no banco em 02/08: a chave `manual_search_web_enabled` nem
      // existe la, entao vale o default do configManager, que e `true`. O ramo
      // web esta LIGADO. Foi religado ao migrar do scraper de dataset pra SERP
      // API (medido: 24-27 resultados em 4-19s). O historico abaixo e do periodo
      // em que ficou desligado:
      //
      // Motivo de ter sido desligado: o tempo de coleta do scraper explodiu apos 21/07 — snapshots da
      // propria conta saltaram de 17-70s para 660-978s, com variancia enorme
      // (mesma cidade, 10 min de diferenca: 22s vs 667s). Assinatura de scraper
      // apanhando pra passar no SearchGuard do Google. Nao e incidente com data
      // pra acabar; e o novo normal do indice organico. O ramo news (tbm=nws) nao
      // sofre disso e entrega ~30 em 50s de forma estavel.
      // Religar quando/se o cenario mudar — a medicao esta em AUDITORIA_2026-07-30.
      webEnabled
        ? rateLimiter.schedule(config.searchBackend, () =>
            buscar(webQuery, {
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
              buscar(q, {
                maxResults: newsMax,
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
        const acumulado: SearchResult[] = [];
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
        // `source` fica de fora (vive no sourceTypeMap); `publishedAt` viaja
        // junto — e o que permite priorizar a janela antes do teto de analise.
        allResults.push({ url: r.url, title: r.title, snippet: r.snippet, ...(r.publishedAt ? { publishedAt: r.publishedAt } : {}) });
      }
    }
  }

  logger.info(`${logPrefix} Total: ${allResults.length} URLs from ${cidades.length} cidades (parallel) em ${requestCount} requests (~$${(requestCount * 0.0015).toFixed(4)})`);

  // Dedup URLs
  const searchResults = deduplicateResults(allResults);
  logger.info(`${logPrefix} total after dedup: ${searchResults.length} URLs`);

  return { searchResults, sourceTypeMap, requestCount };
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
