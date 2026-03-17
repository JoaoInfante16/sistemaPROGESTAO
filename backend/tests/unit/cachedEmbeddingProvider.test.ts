// Mock Redis
const mockRedisGet = jest.fn();
const mockRedisSetex = jest.fn();
const mockRedisIncr = jest.fn().mockResolvedValue(1);

jest.mock('../../src/config/redis', () => ({
  redis: {
    get: mockRedisGet,
    setex: mockRedisSetex,
    incr: mockRedisIncr,
  },
}));

jest.mock('../../src/config', () => ({
  config: {
    cacheEmbeddingTtl: 2592000, // 30 dias
  },
}));

jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { CachedEmbeddingProvider } from '../../src/services/embedding/CachedEmbeddingProvider';
import { EmbeddingProvider, EmbeddingResult } from '../../src/services/embedding/EmbeddingProvider';

function createMockProvider(): EmbeddingProvider {
  return {
    generate: jest.fn().mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      tokensUsed: 10,
    } as EmbeddingResult),
    generateBatch: jest.fn().mockImplementation(async (texts: string[]) => {
      return texts.map((_, i) => ({
        embedding: [0.1 * (i + 1), 0.2 * (i + 1), 0.3 * (i + 1)],
        tokensUsed: 10,
      }));
    }),
  };
}

describe('CachedEmbeddingProvider', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSetex.mockReset();
    mockRedisIncr.mockReset().mockResolvedValue(1);
  });

  describe('generate - cache HIT', () => {
    it('should return cached embedding without calling real provider', async () => {
      const cached: EmbeddingResult = { embedding: [0.5, 0.6, 0.7], tokensUsed: 5 };
      mockRedisGet.mockResolvedValue(JSON.stringify(cached));

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const result = await cachedProvider.generate('test text');

      expect(result).toEqual(cached);
      expect(mockProvider.generate).not.toHaveBeenCalled();
    });
  });

  describe('generate - cache MISS', () => {
    it('should call real provider and cache result', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const result = await cachedProvider.generate('test text');

      expect(mockProvider.generate).toHaveBeenCalledWith('test text');
      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringMatching(/^embedding:/),
        2592000,
        JSON.stringify(result)
      );
    });
  });

  describe('generate - deterministic cache key', () => {
    it('should produce same key for same text', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      await cachedProvider.generate('same text');
      const key1 = mockRedisGet.mock.calls[0][0];

      mockRedisGet.mockReset().mockResolvedValue(null);
      await cachedProvider.generate('same text');
      const key2 = mockRedisGet.mock.calls[0][0];

      expect(key1).toBe(key2);
    });
  });

  describe('generateBatch - mixed cache', () => {
    it('should only generate embeddings for uncached texts', async () => {
      const cached: EmbeddingResult = { embedding: [0.9, 0.8, 0.7], tokensUsed: 5 };

      // Primeiro texto: cache HIT, segundo e terceiro: MISS
      mockRedisGet
        .mockResolvedValueOnce(JSON.stringify(cached)) // text1 - HIT
        .mockResolvedValueOnce(null) // text2 - MISS
        .mockResolvedValueOnce(null); // text3 - MISS
      mockRedisSetex.mockResolvedValue('OK');

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const results = await cachedProvider.generateBatch(['text1', 'text2', 'text3']);

      expect(results).toHaveLength(3);
      // text1 veio do cache
      expect(results[0]).toEqual(cached);
      // text2 e text3 foram gerados via batch real
      expect(mockProvider.generateBatch).toHaveBeenCalledWith(['text2', 'text3']);
    });

    it('should not call real provider when all texts are cached', async () => {
      const cached: EmbeddingResult = { embedding: [0.5, 0.5, 0.5], tokensUsed: 5 };
      mockRedisGet.mockResolvedValue(JSON.stringify(cached));

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const results = await cachedProvider.generateBatch(['text1', 'text2']);

      expect(results).toHaveLength(2);
      expect(mockProvider.generateBatch).not.toHaveBeenCalled();
    });

    it('should call real provider for all texts when none are cached', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      await cachedProvider.generateBatch(['text1', 'text2', 'text3']);

      expect(mockProvider.generateBatch).toHaveBeenCalledWith(['text1', 'text2', 'text3']);
    });
  });

  describe('graceful degradation', () => {
    it('should generate embedding when Redis read fails', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis down'));
      mockRedisSetex.mockResolvedValue('OK');

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const result = await cachedProvider.generate('test');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(mockProvider.generate).toHaveBeenCalled();
    });

    it('should return result even when Redis write fails', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockRejectedValue(new Error('Redis write failed'));

      const mockProvider = createMockProvider();
      const cachedProvider = new CachedEmbeddingProvider(mockProvider);

      const result = await cachedProvider.generate('test');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });
});
