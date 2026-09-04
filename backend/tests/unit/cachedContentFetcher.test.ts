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

/**
 * 🚨 O conteudo precisa passar de 100 caracteres.
 *
 * O fetcher so grava no cache se `content.trim().length > 100` — a guarda existe
 * porque o Jina devolve corpo vazio ou quase vazio quando falha, e cachear uma
 * falha por 24h e pior que nao cachear nada: a URL fica envenenada. O fixture
 * antigo tinha 31 caracteres, entao a gravacao NUNCA acontecia e o teste de
 * cache MISS media o nada.
 */
const CONTEUDO_REALISTA =
  'Um homem foi preso em flagrante na tarde desta quinta-feira suspeito de assaltar ' +
  'uma agência bancária no centro da cidade. Segundo a Polícia Militar, ele estava ' +
  'com parte do dinheiro e uma arma de brinquedo.';

// Mock do fetcher real
function createMockFetcher(): ContentFetcher {
  return {
    fetch: jest.fn().mockResolvedValue({
      url: 'https://example.com/news',
      title: 'Crime em São Paulo',
      content: CONTEUDO_REALISTA,
      wordCount: 38,
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

    it('🚨 NAO grava no cache quando o conteudo veio vazio ou curto demais', async () => {
      // O Jina devolve corpo vazio quando falha. Cachear isso por 24h envenena
      // a URL: toda tentativa seguinte le a falha do cache em vez de tentar de
      // novo. A guarda e `> 100` caracteres.
      mockRedisGet.mockResolvedValue(null); // MISS
      const fetcherComRespostaCurta: ContentFetcher = {
        fetch: jest.fn().mockResolvedValue({
          url: 'https://example.com/vazia',
          title: 'Página que não abriu',
          content: 'erro',
          wordCount: 1,
        } as FetchedContent),
      };

      const cachedFetcher = new CachedContentFetcher(fetcherComRespostaCurta);
      const result = await cachedFetcher.fetch('https://example.com/vazia');

      // Devolve o resultado para quem pediu, mas nao guarda.
      expect(result.content).toBe('erro');
      expect(mockRedisSetex).not.toHaveBeenCalled();
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
