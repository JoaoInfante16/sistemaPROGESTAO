import { SearchProvider, SearchResult, SearchOptions } from './SearchProvider';
import { config } from '../../config';

export class GoogleSearchProvider implements SearchProvider {
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    this.apiKey = config.googleApiKey;
    this.searchEngineId = config.googleSearchEngineId;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const url = 'https://www.googleapis.com/customsearch/v1';

    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.searchEngineId,
      q: query,
      num: String(options.maxResults || 10),
      dateRestrict: options.dateRestrict || 'd7',
      cr: 'countryBR',
    });

    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Search API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      items?: Array<{ link: string; title: string; snippet: string }>;
    };

    return (
      data.items?.map((item) => ({
        url: item.link,
        title: item.title,
        snippet: item.snippet,
      })) || []
    );
  }
}
