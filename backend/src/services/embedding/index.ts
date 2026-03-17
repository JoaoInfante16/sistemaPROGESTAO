import { EmbeddingProvider } from './EmbeddingProvider';
import { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
import { CachedEmbeddingProvider } from './CachedEmbeddingProvider';

export function createEmbeddingProvider(): EmbeddingProvider {
  const provider = new OpenAIEmbeddingProvider();

  // Wrap com cache (TTL configurável via CACHE_EMBEDDING_TTL)
  return new CachedEmbeddingProvider(provider);
}

export * from './EmbeddingProvider';
export { OpenAIEmbeddingProvider } from './OpenAIEmbeddingProvider';
export { CachedEmbeddingProvider } from './CachedEmbeddingProvider';
