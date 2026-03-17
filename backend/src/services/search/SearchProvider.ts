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
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
