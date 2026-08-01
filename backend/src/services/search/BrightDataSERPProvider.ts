// ============================================
// Bright Data SERP Provider — Dual Mode
// ============================================
// Os dois modos usam a MESMA SERP API sincrona (via zone), mudando so o indice:
//   NEWS mode: tbm=nws   — indice de noticias. Estavel, e o alicerce do sistema.
//   WEB  mode: organico  — portais locais, prefeitura, comunicados de policia.
//              Conteudo que NAO aparece no indice de noticias.
//
// O modo web ja usou o scraper de dataset ("Google SERP - 100 Results"). Abandonado
// em 2026-08-01: o tempo de coleta dele saltou de 17-70s (ate 21/07) para 660-978s,
// travando a busca manual. A SERP API entrega o MESMO indice organico em 7-12s por
// pagina — 60 a 100x mais rapido. Quando falha, falha em segundos, nao em minutos.
// Medicoes em workdesk/AUDITORIA_2026-07-30.md.
//
// Docs: https://docs.brightdata.com/scraping-automation/serp-api

import * as Sentry from '@sentry/node';
import { SearchProvider, SearchResult, SearchOptions, SearchResponse } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';
import { parseSerpDate, inicioDaJanela } from './serpDateParser';

const SYNC_API_URL = 'https://api.brightdata.com/request';

// Medido: 5-20s por pagina. Sem isto uma pagina pendurada trava o stage 1 da
// busca manual PARA SEMPRE — nao ha nada acima que corte.
const SERP_TIMEOUT_MS = 60_000;

export class BrightDataSERPProvider implements SearchProvider {
  private apiKey: string;
  private zone: string;
  public lastRequestCount = 0;

  constructor() {
    this.apiKey = config.brightdataApiKey;
    this.zone = config.brightdataZone;
    if (!this.apiKey) {
      logger.warn('[BrightData] BRIGHTDATA_API_KEY not set — searches will fail');
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const response = await this.searchWithMeta(query, options);
    return response.results;
  }

  async searchWithMeta(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    return await this.searchSerpPaginated(query, options, options.searchMode || 'news');
  }

  // ============================================
  // SERP sincrona via zone, paginada — serve os dois indices
  // ============================================

  private async searchSerpPaginated(
    query: string,
    options: SearchOptions,
    mode: 'news' | 'web',
  ): Promise<SearchResponse> {
    const totalWanted = options.maxResults || 20;
    const allResults: SearchResult[] = [];
    let requestsMade = 0;

    // Google deprecou `num` (set/2025) e devolve ~10 resultados/pagina.
    // Paginacao correta: `start` em incrementos de 10 (fix de 22/07 no staging).
    // Com incremento de 20 o codigo pulava as posicoes 10-19 de cada pagina —
    // medido em 2026-07-30: Florianopolis tem 31 noticias no mes, e a paginacao
    // errada entregava so 20 delas.
    const perPage = 10;
    const maxPages = Math.ceil(totalWanted / perPage);

    // Com `sbd:1` os resultados vem em ordem decrescente de data, entao da pra
    // parar de pedir pagina assim que a mais nova dela ja e mais velha que a
    // janela pedida. Antes se puxava um numero fixo de paginas e se jogava fora
    // no Filter2 — em Porto Alegre isso significou baixar 19 artigos pelo Jina
    // pra aproveitar 1.
    const janela = inicioDaJanela(options.dateRestrict);

    for (let page = 0; page < maxPages; page++) {
      const start = page * perPage;
      const googleUrl = this.buildSerpUrl(query, {
        start, mode,
        dateRestrict: options.dateRestrict,
      });

      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ zone: this.zone, url: googleUrl, format: 'raw' }),
        signal: AbortSignal.timeout(SERP_TIMEOUT_MS),
      });

      requestsMade++;

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`SERP error (${response.status}): ${err.substring(0, 300)}`);
      }

      // A Bright Data sinaliza falha de auth/proxy com HTTP 200, corpo VAZIO e o
      // erro so nos headers (ex: ip_blacklisted). Sem esta checagem o pipeline
      // trata como "nao achou nada" e a busca conclui com 0 resultados, sem erro
      // nenhum — foi o que mascarou o bug ate 2026-07-30. Falhar alto e melhor:
      // o BullMQ reprocessa e o Sentry registra.
      const brdErrCode = response.headers.get('x-brd-err-code');
      if (brdErrCode) {
        const brdErrMsg = response.headers.get('x-brd-err-msg') || '';
        throw new Error(`Bright Data recusou (${brdErrCode}): ${brdErrMsg.substring(0, 300)}`);
      }

      const rawText = await response.text();
      const TAG = mode === 'web' ? '[BrightData:Web]' : '[BrightData:News]';
      let data: SERPResponse;
      try {
        data = JSON.parse(rawText) as SERPResponse;
      } catch {
        // Corpo vazio ou HTML com HTTP 200 = provider quebrado (brd_json ausente,
        // zona errada, rate limit), NAO "nao achou nada". Sem isto a busca conclui
        // com 0 resultados sem erro nenhum — foi o que mascarou o bug de 22/07.
        logger.error(`${TAG} Page ${page + 1} resposta nao-JSON (${rawText.length} bytes): "${rawText.substring(0, 120)}"`);
        if (page === 0) {
          Sentry.captureException(new Error(`${TAG} resposta non-JSON na pagina 1 — 0 resultados`), {
            tags: { provider: 'brightdata', mode },
            extra: { query: query.substring(0, 100), preview: rawText.substring(0, 300) },
          });
        }
        break;
      }

      const pageResults = this.parseNewsResults(data);
      logger.info(`${TAG} Page ${page + 1} → ${pageResults.length} results`);

      allResults.push(...pageResults);
      if (pageResults.length < 5) break;
      if (allResults.length >= totalWanted) break;

      // Saiu da janela? A proxima pagina so tem coisa ainda mais velha.
      if (janela) {
        const maisNovaDaPagina = this.dataMaisNova(data);
        if (maisNovaDaPagina && maisNovaDaPagina < janela) {
          logger.info(`${TAG} Page ${page + 1} ja e toda anterior a ${janela.toISOString().split('T')[0]} — parando de paginar`);
          break;
        }
      }
    }

    const results = allResults.slice(0, totalWanted);
    this.lastRequestCount = requestsMade;
    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '';
    const TAG_FINAL = mode === 'web' ? '[BrightData:Web]' : '[BrightData:News]';
    logger.info(`${TAG_FINAL} ${loc} "${query.substring(0, 50)}..." → ${results.length} results (${requestsMade} req)`);
    return { results, requestCount: requestsMade };
  }


  // ============================================
  // Helpers
  // ============================================

  private buildSerpUrl(query: string, opts: {
    start: number;
    mode: 'news' | 'web';
    dateRestrict?: string;
  }): string {
    // brd_json=1 OBRIGATORIO: sem ele o /request com format=raw devolve o HTML
    // bruto da SERP, o JSON.parse falha e a busca conclui com 0 resultados em
    // silencio. Foi a causa do bug de 22/07 (fix veio do staging).
    // `num` deprecado pelo Google (set/2025) — paginacao so via `start`, 10/pagina.
    const params = new URLSearchParams({
      q: query,
      start: String(opts.start),
      gl: 'br', hl: 'pt-BR',
      brd_json: '1',
    });

    // tbm=nws restringe ao indice de noticias. No modo web fica de fora, pra
    // pegar o indice organico — portais locais, prefeitura, blog de bairro.
    if (opts.mode === 'news') params.set('tbm', 'nws');

    // `sbd:1` = ordenar por data. Medido em 2026-08-01: e o UNICO componente de
    // `tbs` que o Google obedece no indice de noticias. `qdr:d`, `qdr:w`, `qdr:m`
    // e ate `cdr:1` com range explicito devolveram os MESMOS 10 resultados, na
    // mesma ordem, com materia de marco numa busca de "1 dia". O `qdr` continua
    // sendo enviado so como rede de seguranca (custa nada se voltar a valer);
    // quem de fato garante o periodo e o `sbd:1` + o corte de paginacao acima
    // + o pos-filtro de data do Filter2.
    const qdr = this.mapDateRestrict(opts.dateRestrict);
    params.set('tbs', [qdr, 'sbd:1'].filter(Boolean).join(','));

    // uule NAO entra: o Google exige encoding canonico (base64) e texto puro era
    // ignorado. Medido em 2026-07-30 no indice organico, uule+tbs juntos ainda
    // derrubavam o resultado de ~100 pra 1. gl=br + cidade na query ja segmentam.

    return `https://www.google.com/search?${params.toString()}`;
  }

  private mapDateRestrict(dateRestrict?: string): string | undefined {
    if (!dateRestrict) return 'qdr:d';
    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (isNaN(days)) return 'qdr:w';
      if (days <= 1) return 'qdr:d';
      if (days <= 7) return 'qdr:w';
      if (days <= 30) return 'qdr:m';
      if (days <= 90) return 'qdr:m3';
      if (days <= 365) return 'qdr:y';
      return undefined;
    }
    return 'qdr:w';
  }

  /**
   * Data mais nova da pagina. Com `sbd:1` e o primeiro item, mas nem todo item
   * traz data — entao varre todos e pega o maior. Null se nenhum for legivel
   * (nesse caso a paginacao segue como antes, sem corte).
   */
  private dataMaisNova(data: SERPResponse): Date | null {
    const itens = [...(data.news || []), ...(data.organic || [])];
    let maior: Date | null = null;
    for (const item of itens) {
      const d = parseSerpDate(item.date);
      if (d && (!maior || d > maior)) maior = d;
    }
    return maior;
  }

  // Le `news` (tbm=nws) e cai pra `organic` (modo web). O mesmo parser serve
  // aos dois porque a Bright Data devolve o mesmo shape de item nos dois indices.
  private parseNewsResults(data: SERPResponse): SearchResult[] {
    const results: SearchResult[] = [];

    if (data.news && Array.isArray(data.news)) {
      for (const item of data.news) {
        if (item.link) {
          results.push({
            url: item.link,
            title: item.title || '',
            snippet: item.description || item.snippet || item.title || '',
          });
        }
      }
    }

    if (results.length === 0 && data.organic && Array.isArray(data.organic)) {
      for (const item of data.organic) {
        if (item.link) {
          results.push({
            url: item.link,
            title: item.title || '',
            snippet: item.description || item.snippet || item.title || '',
          });
        }
      }
    }

    return results;
  }
}

// ============================================
// Types
// ============================================

interface SERPItem {
  title?: string;
  link?: string;
  description?: string;
  snippet?: string;
  source?: string;
  date?: string;
}

interface SERPResponse {
  news?: SERPItem[];
  organic?: SERPItem[];
}
