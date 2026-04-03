// ============================================
// Bright Data SERP Provider (Google News)
// ============================================
// Busca no Google News real via Bright Data SERP API.
// 20 resultados/pagina, $0.0015/request, fontes oficiais .gov.br.
// Docs: https://docs.brightdata.com/scraping-automation/serp-api

import { SearchProvider, SearchResult, SearchOptions, SearchResponse } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const BRIGHTDATA_API_URL = 'https://api.brightdata.com/request';

export class BrightDataSERPProvider implements SearchProvider {
  private apiKey: string;
  private zone: string;
  /** Requests feitas na ultima chamada search() — para cost tracking */
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
    const totalWanted = options.maxResults || 20;
    const allResults: SearchResult[] = [];
    let requestsMade = 0;

    // Google News retorna ~10-20 por pagina — paginar com &start=
    const perPage = 20;
    const maxPages = Math.ceil(totalWanted / perPage);

    for (let page = 0; page < maxPages; page++) {
      const start = page * perPage;
      const googleUrl = this.buildGoogleNewsUrl(query, {
        start,
        num: perPage,
        dateRestrict: options.dateRestrict,
        location: options.location,
      });

      const response = await fetch(BRIGHTDATA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          zone: this.zone,
          url: googleUrl,
          format: 'raw',
        }),
      });

      requestsMade++;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Bright Data SERP error (${response.status}): ${errorBody.substring(0, 300)}`);
      }

      const data = await response.json() as BrightDataSERPResponse;
      const pageResults = this.parseResults(data);

      allResults.push(...pageResults);

      // Se retornou menos que 5, nao tem mais paginas
      if (pageResults.length < 5) break;

      // Nao exceder totalWanted
      if (allResults.length >= totalWanted) break;
    }

    const results = allResults.slice(0, totalWanted);
    this.lastRequestCount = requestsMade;

    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '[sem loc]';
    logger.info(`[BrightData] ${loc} "${query.substring(0, 50)}..." → ${results.length} results (${requestsMade} requests, wanted ${totalWanted})`);
    return { results, requestCount: requestsMade };
  }

  private buildGoogleNewsUrl(query: string, opts: {
    start: number;
    num: number;
    dateRestrict?: string;
    location?: SearchOptions['location'];
  }): string {
    const params = new URLSearchParams({
      q: query,
      tbm: 'nws',
      num: String(opts.num),
      start: String(opts.start),
      gl: 'br',
      hl: 'pt-BR',
    });

    const tbs = this.mapDateRestrict(opts.dateRestrict);
    if (tbs) params.set('tbs', tbs);

    return `https://www.google.com/search?${params.toString()}`;
  }

  /**
   * Maps dateRestrict (d1, d7, d30, d90) to Google tbs param.
   * qdr:d = last day, qdr:w = last week, qdr:m = last month, qdr:m3 = last 3 months
   */
  private mapDateRestrict(dateRestrict?: string): string | undefined {
    if (!dateRestrict) return 'qdr:w'; // default: ultima semana

    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (isNaN(days)) return 'qdr:w';

      if (days <= 1) return 'qdr:d';
      if (days <= 7) return 'qdr:w';
      if (days <= 30) return 'qdr:m';
      if (days <= 90) return 'qdr:m3';
      if (days <= 365) return 'qdr:y';

      return undefined; // sem restricao pra periodos muito grandes
    }

    return 'qdr:w';
  }

  /**
   * Parseia a resposta do Bright Data SERP.
   * O formato pode variar — tenta news[], organic[], ou parseia HTML.
   */
  private parseResults(data: BrightDataSERPResponse): SearchResult[] {
    const results: SearchResult[] = [];

    // Formato 1: news[] (Google News SERP)
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

    // Formato 2: organic[] (fallback)
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

    // Formato 3: news_results[] (outro formato possivel)
    if (results.length === 0 && data.news_results && Array.isArray(data.news_results)) {
      for (const item of data.news_results) {
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
// Bright Data SERP Response Types
// ============================================

interface BrightDataNewsItem {
  title?: string;
  link?: string;
  description?: string;
  snippet?: string;
  source?: string;
  date?: string;
}

interface BrightDataSERPResponse {
  news?: BrightDataNewsItem[];
  organic?: BrightDataNewsItem[];
  news_results?: BrightDataNewsItem[];
}
