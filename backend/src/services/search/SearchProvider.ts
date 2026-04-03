// ============================================
// Search Provider - Interface
// ============================================
// Abstração para trocar Google Search por SerpAPI ou outro
// sem refatorar o resto do código.

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

export interface SearchOptions {
  maxResults?: number;
  dateRestrict?: string; // ex: "d7" (últimos 7 dias)
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface SearchResponse {
  results: SearchResult[];
  requestCount: number; // quantas HTTP requests foram feitas (para cost tracking)
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  /** Se o provider suporta, retorna metadata com requestCount pra paginacao */
  searchWithMeta?(query: string, options?: SearchOptions): Promise<SearchResponse>;
}
