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
    cacheJinaContentTtl: 86400, // 24h
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

import { CachedContentFetcher } from '../../src/services/content/CachedContentFetcher';
import { ContentFetcher, FetchedContent } from '../../src/services/content/ContentFetcher';

// Mock do fetcher real
function createMockFetcher(): ContentFetcher {
  return {
    fetch: jest.fn().mockResolvedValue({
      url: 'https://example.com/news',
      title: 'Crime em São Paulo',
      content: 'Conteúdo completo da notícia...',
      wordCount: 5,
    } as FetchedContent),
  };
}

describe('CachedContentFetcher', () => {
  beforeEach(() => {
    mockRedisGet.mockReset();
    mockRedisSetex.mockReset();
    mockRedisIncr.mockReset().mockResolvedValue(1);
  });

  describe('cache HIT', () => {
    it('should return cached content without calling real fetcher', async () => {
      const cached: FetchedContent = {
        url: 'https://example.com/news',
        title: 'Cached Title',
        content: 'Cached content',
        wordCount: 2,
      };
      mockRedisGet.mockResolvedValue(JSON.stringify(cached));

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      const result = await cachedFetcher.fetch('https://example.com/news');

      expect(result).toEqual(cached);
      expect(mockFetcher.fetch).not.toHaveBeenCalled();
      expect(mockRedisIncr).toHaveBeenCalledWith('cache:content:hits');
    });
  });

  describe('cache MISS', () => {
    it('should call real fetcher and cache result', async () => {
      mockRedisGet.mockResolvedValue(null); // MISS
      mockRedisSetex.mockResolvedValue('OK');

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      const result = await cachedFetcher.fetch('https://example.com/news');

      expect(mockFetcher.fetch).toHaveBeenCalledWith('https://example.com/news');
      expect(result.title).toBe('Crime em São Paulo');
      expect(mockRedisSetex).toHaveBeenCalledWith(
        expect.stringMatching(/^content:/),
        86400,
        JSON.stringify(result)
      );
      expect(mockRedisIncr).toHaveBeenCalledWith('cache:content:misses');
    });
  });

  describe('cache key consistency', () => {
    it('should generate same key for same URL', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      await cachedFetcher.fetch('https://example.com/same-url');
      const key1 = mockRedisGet.mock.calls[0][0];

      mockRedisGet.mockReset().mockResolvedValue(null);
      await cachedFetcher.fetch('https://example.com/same-url');
      const key2 = mockRedisGet.mock.calls[0][0];

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different URLs', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockResolvedValue('OK');

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      await cachedFetcher.fetch('https://example.com/url-a');
      const key1 = mockRedisGet.mock.calls[0][0];

      mockRedisGet.mockReset().mockResolvedValue(null);
      await cachedFetcher.fetch('https://example.com/url-b');
      const key2 = mockRedisGet.mock.calls[0][0];

      expect(key1).not.toBe(key2);
    });
  });

  describe('graceful degradation', () => {
    it('should fetch from real provider when Redis read fails', async () => {
      mockRedisGet.mockRejectedValue(new Error('Redis down'));
      mockRedisSetex.mockResolvedValue('OK');

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      const result = await cachedFetcher.fetch('https://example.com/news');

      expect(result.title).toBe('Crime em São Paulo');
      expect(mockFetcher.fetch).toHaveBeenCalled();
    });

    it('should return result even when Redis write fails', async () => {
      mockRedisGet.mockResolvedValue(null);
      mockRedisSetex.mockRejectedValue(new Error('Redis write failed'));

      const mockFetcher = createMockFetcher();
      const cachedFetcher = new CachedContentFetcher(mockFetcher);

      const result = await cachedFetcher.fetch('https://example.com/news');

      expect(result.title).toBe('Crime em São Paulo');
    });
  });
});
