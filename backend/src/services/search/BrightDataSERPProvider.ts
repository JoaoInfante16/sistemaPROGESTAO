// ============================================
// Bright Data SERP Provider — Dual Mode
// ============================================
// Dois produtos diferentes da Bright Data, a mesma API key:
//   NEWS mode (auto-scan):    SERP API via zone  — tbm=nws, paginada 20/req
//   WEB mode  (busca manual): scraper "100 Results" — ~100 organicos em 1 req
// A zone tem blacklist de IP propria; o scraper nao passa por zone nenhuma.
// Docs: https://docs.brightdata.com/scraping-automation/serp-api

import * as Sentry from '@sentry/node';
import { SearchProvider, SearchResult, SearchOptions, SearchResponse } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

// SERP API via zone (modo news). Sujeita a blacklist de IP da zone.
const SYNC_API_URL = 'https://api.brightdata.com/request';

// Scraper "Google SERP - 100 Results" (modo web). NAO usa zone.
// Endpoint /scrape = SINCRONO (resultado direto na resposta).
// O /trigger era o assincrono, com snapshot + polling — foi o que travou em
// 2026-07-30 (>500s sem concluir, contra 17-70s ate 21/07). Ver AUDITORIA.
const DATASET_ID = 'gd_mfz5x93lmsjjjylob';
const SCRAPE_URL = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${DATASET_ID}&notify=false&include_errors=true`;

// Medido: 23-36s por keyword. Timeout com folga — antes NAO havia nenhum.
const SCRAPE_TIMEOUT_MS = 120_000;

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
    const mode = options.searchMode || 'news';
    if (mode === 'web') return await this.searchWebScrape(query, options);
    return await this.searchSerpPaginated(query, options);
  }

  // ============================================
  // WEB MODE: scraper "100 Results", chamada sincrona
  // ============================================
  // Uma request devolve ~100 resultados organicos em ~25-36s.
  //
  // NAO enviar `uule` junto com `tbs`: medido em 2026-07-30 — sozinhos rendem
  // 97 e 100 resultados, JUNTOS derrubam pra 1. A cidade e o estado ja vao na
  // keyword, e o uule vinha sendo montado como texto simples ("Cidade,Estado,
  // Brazil") quando o Google espera um formato codificado proprio.
  private async searchWebScrape(query: string, options: SearchOptions): Promise<SearchResponse> {
    const totalWanted = options.maxResults || 50;
    const tbs = this.mapDateRestrict(options.dateRestrict);
    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '';

    const input: Record<string, string> = {
      url: 'https://www.google.com/',
      keyword: query,
      language: 'pt-BR',
      country: 'BR',
    };
    if (tbs) input.tbs = tbs;

    const response = await fetch(SCRAPE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: [input] }),
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Scrape error (${response.status}): ${err.substring(0, 300)}`);
    }

    const rawText = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error(`Scrape devolveu resposta nao-JSON (${rawText.length} bytes): "${rawText.substring(0, 120)}"`);
    }

    const rows = (Array.isArray(parsed) ? parsed : [parsed]) as Array<{ organic?: SERPItem[] }>;
    const seen = new Set<string>();
    const results: SearchResult[] = [];

    for (const row of rows) {
      for (const item of row.organic || []) {
        if (!item.link || seen.has(item.link)) continue;
        seen.add(item.link);
        results.push({
          url: item.link,
          title: item.title || '',
          snippet: item.description || item.title || '',
        });
      }
    }

    const sliced = results.slice(0, totalWanted);
    this.lastRequestCount = 1;
    logger.info(`[BrightData:Web] ${loc} "${query.substring(0, 50)}..." → ${sliced.length} results (${results.length} organic brutos, 1 req)`);
    return { results: sliced, requestCount: 1 };
  }

  // ============================================
  // NEWS MODE: SERP sincrona via zone, tbm=nws, paginada (auto-scan)
  // ============================================
  // O modo web NAO passa por aqui — vai pelo scraper (searchWebScrape).

  private async searchSerpPaginated(
    query: string,
    options: SearchOptions,
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

    for (let page = 0; page < maxPages; page++) {
      const start = page * perPage;
      const googleUrl = this.buildSerpUrl(query, {
        start,
        dateRestrict: options.dateRestrict,
      });

      const response = await fetch(SYNC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ zone: this.zone, url: googleUrl, format: 'raw' }),
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
      const TAG = '[BrightData:News]';
      let data: SERPResponse;
      try {
        data = JSON.parse(rawText) as SERPResponse;
      } catch {
        // Corpo vazio ou HTML com HTTP 200 = provider quebrado (brd_json ausente,
        // zona errada, rate limit), NAO "nao achou nada". Sem isto a busca conclui
        // com 0 resultados sem erro nenhum — foi o que mascarou o bug de 22/07.
        logger.error(`${TAG} Page ${page + 1} resposta nao-JSON (${rawText.length} bytes): "${rawText.substring(0, 120)}"`);
        if (page === 0) {
          Sentry.captureException(new Error('[BrightData:News] resposta non-JSON na pagina 1 — 0 resultados'), {
            tags: { provider: 'brightdata', mode: 'news' },
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
    }

    const results = allResults.slice(0, totalWanted);
    this.lastRequestCount = requestsMade;
    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '';
    logger.info(`[BrightData:News] ${loc} "${query.substring(0, 50)}..." → ${results.length} results (${requestsMade} req)`);
    return { results, requestCount: requestsMade };
  }


  // ============================================
  // Helpers
  // ============================================

  private buildSerpUrl(query: string, opts: {
    start: number;
    dateRestrict?: string;
  }): string {
    // brd_json=1 OBRIGATORIO: sem ele o /request com format=raw devolve o HTML
    // bruto da SERP, o JSON.parse falha e a busca conclui com 0 resultados em
    // silencio. Foi a causa do bug de 22/07 (fix veio do staging).
    // `num` deprecado pelo Google (set/2025) — paginacao so via `start`, 10/pagina.
    const params = new URLSearchParams({
      q: query, tbm: 'nws',
      start: String(opts.start),
      gl: 'br', hl: 'pt-BR',
      brd_json: '1',
    });

    // Rede de seguranca: o post-filter de data no pipelineCore rejeita artigo
    // fora do periodo mesmo que o Google ignore o parametro.
    const tbs = this.mapDateRestrict(opts.dateRestrict);
    if (tbs) params.set('tbs', tbs);

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
