// ============================================
// Content Fetcher - Interface
// ============================================
// Abstração para trocar Jina AI por Firecrawl ou outro
// sem refatorar o resto do código.

export interface FetchedContent {
  url: string;
  title: string;
  content: string; // Texto limpo extraído
  wordCount: number;
}

export interface ContentFetcher {
  fetch(url: string): Promise<FetchedContent>;
}
