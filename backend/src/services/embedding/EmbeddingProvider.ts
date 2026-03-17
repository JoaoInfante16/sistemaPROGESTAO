// ============================================
// Embedding Provider - Interface
// ============================================
// Abstração para trocar OpenAI por outro serviço de embeddings
// sem refatorar o resto do código.

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

export interface EmbeddingProvider {
  generate(text: string): Promise<EmbeddingResult>;
  generateBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
