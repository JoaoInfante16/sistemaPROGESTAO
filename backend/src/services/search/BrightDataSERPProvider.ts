// ============================================
// Bright Data SERP Provider — Dual Mode
// ============================================
// NEWS mode (auto-scan): API sincrona, tbm=nws, qdr:d, ~10 resultados/req
// WEB mode (busca manual): Dataset API Top 100, web generico, after:, 1 req = ate 100 resultados
// Docs: https://docs.brightdata.com/scraping-automation/serp-api

import * as Sentry from '@sentry/node';
import { SearchProvider, SearchResult, SearchOptions, SearchResponse } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

// API sincrona (News mode)
const SYNC_API_URL = 'https://api.brightdata.com/request';

// Dataset API (Web Top 100 mode)
const DATASET_ID = 'gd_mfz5x93lmsjjjylob';
const TRIGGER_URL = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&include_errors=true`;
const PROGRESS_URL = 'https://api.brightdata.com/datasets/v3/progress';
const SNAPSHOT_URL = 'https://api.brightdata.com/datasets/v3/snapshot';

const MAX_POLL_ATTEMPTS = 60; // 60 x 3s = 3 min max
const POLL_INTERVAL_MS = 3000;

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

    if (mode === 'web') {
      // Retry 1x se falhar
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await this.searchWebTop100(query, options);
        } catch (err) {
          logger.warn(`[BrightData] Web Top100 attempt ${attempt} failed: ${(err as Error).message}`);
          if (attempt === 2) {
            Sentry.captureException(err, { tags: { provider: 'brightdata', mode: 'web_top100' } });
            throw err;
          }
          logger.info('[BrightData] Retrying Top100...');
        }
      }
    }

    return await this.searchNewsPaginated(query, options);
  }

  // ============================================
  // NEWS MODE: API sincrona, tbm=nws (auto-scan)
  // ============================================

  private async searchNewsPaginated(query: string, options: SearchOptions): Promise<SearchResponse> {
    const totalWanted = options.maxResults || 20;
    const allResults: SearchResult[] = [];
    let requestsMade = 0;
    // Google deprecou `num` (set/2025) e retorna ~10 resultados/pagina.
    // Paginacao correta: `start` em incrementos de 10 (doc Bright Data SERP API).
    const perPage = 10;
    const maxPages = Math.ceil(totalWanted / perPage);

    for (let page = 0; page < maxPages; page++) {
      const start = page * perPage;
      const googleUrl = this.buildNewsUrl(query, {
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

      const rawText = await response.text();
      let data: SERPResponse;
      try {
        data = JSON.parse(rawText) as SERPResponse;
      } catch {
        // Non-JSON na pagina 1 = provider quebrado (ex: brd_json ausente/zona
        // errada devolvendo HTML) → alertar, senao a busca falha em silencio.
        logger.warn(`[BrightData:News] Page ${page + 1} non-JSON: ${rawText.substring(0, 120).replace(/\n/g, ' ')}`);
        if (page === 0) {
          Sentry.captureException(new Error('[BrightData:News] resposta non-JSON na pagina 1 — 0 resultados'), {
            tags: { provider: 'brightdata', mode: 'news' },
            extra: { query: query.substring(0, 100), preview: rawText.substring(0, 300) },
          });
        }
        break;
      }

      const pageResults = this.parseNewsResults(data);
      logger.info(`[BrightData:News] Page ${page + 1} → ${pageResults.length} results`);

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
  // WEB MODE: Dataset API Top 100 (busca manual)
  // ============================================

  private async searchWebTop100(query: string, options: SearchOptions): Promise<SearchResponse> {
    const totalWanted = options.maxResults || 50;
    const endPage = Math.min(Math.ceil(totalWanted / 10), 10);

    // Construir query com after:/before: pra filtro de data
    const { after, before } = this.buildDateRange(options.dateRestrict);
    let fullQuery = query;
    if (after) fullQuery += ` after:${after}`;
    if (before) fullQuery += ` before:${before}`;

    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '';
    logger.info(`[BrightData:Web] ${loc} Top100 query: "${fullQuery.substring(0, 80)}..." pages 1-${endPage}`);

    // 1. Trigger
    const payload = [{
      url: 'https://www.google.com/',
      keyword: fullQuery,
      language: 'pt-BR',
      country: 'BR',
      start_page: 1,
      end_page: endPage,
    }];

    const triggerRes = await fetch(TRIGGER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!triggerRes.ok) {
      const err = await triggerRes.text();
      throw new Error(`Trigger failed (${triggerRes.status}): ${err.substring(0, 200)}`);
    }

    const triggerData = await triggerRes.json() as { snapshot_id?: string };
    if (!triggerData.snapshot_id) {
      throw new Error(`No snapshot_id: ${JSON.stringify(triggerData).substring(0, 200)}`);
    }

    logger.info(`[BrightData:Web] Snapshot: ${triggerData.snapshot_id}`);

    // 2. Poll
    let ready = false;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const res = await fetch(`${PROGRESS_URL}/${triggerData.snapshot_id}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });

      if (!res.ok) continue;

      const progress = await res.json() as { status?: string };
      logger.debug(`[BrightData:Web] Poll ${i + 1}/${MAX_POLL_ATTEMPTS}: status=${progress.status}`);
      if (progress.status === 'ready') {
        logger.info(`[BrightData:Web] Ready after ${(i + 1) * 3}s`);
        ready = true;
        break;
      }
      if (progress.status === 'failed' || progress.status === 'cancelled') {
        throw new Error(`Snapshot ${progress.status}`);
      }
    }

    if (!ready) {
      logger.warn(`[BrightData:Web] Timeout after ${MAX_POLL_ATTEMPTS * 3}s — falling back`);
      throw new Error(`Snapshot timeout after ${MAX_POLL_ATTEMPTS * 3}s`);
    }

    // 3. Download
    const snapRes = await fetch(`${SNAPSHOT_URL}/${triggerData.snapshot_id}?format=json`, {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });

    if (!snapRes.ok) {
      const err = await snapRes.text();
      throw new Error(`Download failed (${snapRes.status}): ${err.substring(0, 200)}`);
    }

    const snapData = await snapRes.json() as DatasetResult[];
    const allResults: SearchResult[] = [];

    for (const result of snapData) {
      if (result.organic && Array.isArray(result.organic)) {
        for (const item of result.organic) {
          if (item.link) {
            allResults.push({
              url: item.link,
              title: item.title || '',
              snippet: item.description || item.title || '',
            });
          }
        }
      }
    }

    // Dedup
    const seen = new Set<string>();
    const unique = allResults.filter(r => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    const results = unique.slice(0, totalWanted);
    this.lastRequestCount = 1;

    logger.info(`[BrightData:Web] ${loc} → ${results.length} results (1 req, ${allResults.length} raw, ${endPage} pages)`);
    return { results, requestCount: 1 };
  }

  // ============================================
  // Helpers
  // ============================================

  private buildNewsUrl(query: string, opts: {
    start: number;
    dateRestrict?: string;
  }): string {
    // brd_json=1 OBRIGATORIO: sem ele o /request com format=raw devolve o HTML
    // bruto da SERP e o JSON.parse falha ("non-JSON") → 0 resultados silenciosos.
    // `num` deprecado pelo Google — paginacao so via `start` (10/pagina).
    const params = new URLSearchParams({
      q: query, tbm: 'nws',
      start: String(opts.start),
      gl: 'br', hl: 'pt-BR',
      brd_json: '1',
    });

    const tbs = this.mapDateRestrict(opts.dateRestrict);
    if (tbs) params.set('tbs', tbs);

    // uule removido: Google exige encoding canonico (base64), texto puro era
    // ignorado. gl=br + cidade no texto da query ja cobrem a segmentacao.

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

  /** Converte dateRestrict (d30, d60) em after/before YYYY-MM-DD pra query */
  private buildDateRange(dateRestrict?: string): { after?: string; before?: string } {
    if (!dateRestrict) return {};
    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (isNaN(days)) return {};
      const now = new Date();
      const from = new Date();
      from.setDate(now.getDate() - days);
      return {
        after: from.toISOString().split('T')[0],
        before: now.toISOString().split('T')[0],
      };
    }
    return {};
  }

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

interface DatasetResult {
  keyword?: string;
  organic?: SERPItem[];
  news?: SERPItem[];
}
