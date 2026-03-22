import { SearchProvider, SearchResult, SearchOptions } from './SearchProvider';
import { config } from '../../config';

export class PerplexitySearchProvider implements SearchProvider {
  private apiKey: string;

  constructor() {
    this.apiKey = config.perplexityApiKey;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Strip "site:.br" from query — Perplexity uses country param instead
    const cleanQuery = query.replace(/\s*site:\.br\s*/gi, ' ').trim();

    const recencyFilter = this.mapDateRestrict(options.dateRestrict);

    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: cleanQuery,
        max_results: options.maxResults || 10,
        country: 'BR',
        search_language_filter: ['pt'],
        ...(recencyFilter && { search_recency_filter: recencyFilter }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Perplexity Search API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      results?: Array<{ url: string; title: string; snippet: string }>;
    };

    return (
      data.results?.map((r) => ({
        url: r.url,
        title: r.title,
        snippet: r.snippet,
      })) || []
    );
  }

  /**
   * Maps Google CSE dateRestrict format (d7, w1, m1) to Perplexity recency filter.
   */
  private mapDateRestrict(dateRestrict?: string): string | undefined {
    if (!dateRestrict) return 'week';
    if (dateRestrict.startsWith('d')) {
      const days = parseInt(dateRestrict.slice(1), 10);
      if (days <= 1) return 'day';
      if (days <= 7) return 'week';
      if (days <= 90) return 'month'; // Perplexity não tem "trimestre", month é o mais próximo
      return 'year';
    }
    if (dateRestrict.startsWith('w')) return 'week';
    if (dateRestrict.startsWith('m')) return 'month';
    return 'week';
  }
}
