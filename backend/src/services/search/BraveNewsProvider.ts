// ============================================
// Brave News Search Provider
// ============================================
// API de busca de NOTICIAS (nao web search generico).
// 50 resultados/query, $0.005/query, date range customizado.
// Docs: https://api.search.brave.com/app/documentation/news-search

import { SearchProvider, SearchResult, SearchOptions } from './SearchProvider';
import { config } from '../../config';
import { logger } from '../../middleware/logger';

const BRAVE_NEWS_URL = 'https://api.search.brave.com/res/v1/news/search';

export class BraveNewsProvider implements SearchProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = config.braveApiKey;
    if (!this.apiKey) {
      logger.warn('[BraveNews] BRAVE_API_KEY not set — searches will fail');
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const totalWanted = options.maxResults || 50;
    const freshness = this.mapDateRestrict(options.dateRestrict);
    const allResults: SearchResult[] = [];

    // Brave max 50 por request — paginar se precisa de mais
    const pages = Math.ceil(totalWanted / 50);

    for (let page = 0; page < pages; page++) {
      const count = Math.min(50, totalWanted - allResults.length);
      const params = new URLSearchParams({
        q: query,
        count: String(count),
        country: 'BR',
        safesearch: 'off',
        ui_lang: 'pt-BR',
        text_decorations: 'false',
      });

      if (page > 0) params.set('offset', String(page));
      if (freshness) params.set('freshness', freshness);

      const url = `${BRAVE_NEWS_URL}?${params.toString()}`;

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
        'X-Loc-Country': options.location?.country || 'BR',
      };

      // Localização — melhora relevância dos resultados
      if (options.location?.city) headers['X-Loc-City'] = options.location.city;
      if (options.location?.state) headers['X-Loc-State'] = options.location.state;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Brave News API error (${response.status}): ${errorBody.substring(0, 200)}`);
      }

      const data = (await response.json()) as BraveNewsResponse;
      const pageResults = (data.results || []).map((r) => ({
        url: r.url,
        title: r.title || '',
        snippet: r.description || r.title || '',
      }));

      allResults.push(...pageResults);

      // Se retornou menos que pedido, não tem mais páginas
      if (pageResults.length < count) break;
    }

    const loc = options.location ? `[${options.location.city || '?'}/${options.location.state || '?'}]` : '[sem loc]';
    logger.info(`[BraveNews] ${loc} "${query.substring(0, 50)}..." → ${allResults.length} results`);
    return allResults;
  }

  /**
   * Maps dateRestrict format (d7, d30, d90) to Brave freshness param.
   * Brave aceita: pd (24h), pw (7d), pm (31d), py (1y), ou YYYY-MM-DDtoYYYY-MM-DD
   */
  private mapDateRestrict(dateRestrict?: string): string | undefined {
    if (!dateRestrict) return 'pw'; // default: ultima semana

    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (isNaN(days)) return 'pw';

      if (days <= 1) return 'pd';
      if (days <= 7) return 'pw';
      if (days <= 31) return 'pm';
      if (days <= 365) return 'py';

      // Range customizado pra periodos grandes
      return this.buildDateRange(days);
    }

    return 'pw';
  }

  /**
   * Constroi range customizado YYYY-MM-DDtoYYYY-MM-DD
   */
  private buildDateRange(days: number): string {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    return `${fmt(from)}to${fmt(to)}`;
  }
}

// ============================================
// Brave API Response Types
// ============================================

interface BraveNewsResult {
  url: string;
  title: string;
  description?: string;
  age?: string;
  page_age?: string;
  meta_url?: {
    hostname: string;
    favicon: string;
  };
}

interface BraveNewsResponse {
  type: string;
  results?: BraveNewsResult[];
  query?: {
    original: string;
  };
}
