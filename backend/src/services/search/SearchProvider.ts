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
  searchMode?: 'news' | 'web'; // news = tbm=nws (auto-scan), web = Top100 generico (busca manual)
  /**
   * Quantas paginas pedir de uma vez (os offsets `start` sao independentes).
   * DEFAULT 1 = paginacao serial, o comportamento de sempre.
   *
   * E opt-in de proposito: o auto-scan usa o mesmo provider e pagina 2 paginas
   * (search_max_results=15). Se o lote fosse ligado por padrao, ele passaria a
   * pedir sempre as duas em vez de as vezes parar na primeira — mudanca de
   * custo e de comportamento no CRON. Quem opta e so a busca manual.
   */
  pageConcurrency?: number;
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
