// Mock database queries
const mockFindGeoTemporalCandidates = jest.fn();
const mockInsertNewsSource = jest.fn();

jest.mock('../../src/database/queries', () => ({
  db: {
    findGeoTemporalCandidates: mockFindGeoTemporalCandidates,
    insertNewsSource: mockInsertNewsSource,
  },
}));

// O dedup fala com a OpenAI pelo client COMPARTILHADO (`services/openaiClient`),
// nao pelo pacote `openai` direto — foi centralizado para o timeout de 60s valer
// nos seis lugares que chamavam a API. Mockar o pacote nao intercepta mais nada.
const mockCreate = jest.fn();
jest.mock('../../src/services/openaiClient', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
}));

// `pipelineCore` monta o embeddingProvider com cache em Redis no momento do
// import. Sem este mock a suite abre conexao de verdade e pendura sem falhar.
const mockGenerateEmbedding = jest.fn();
jest.mock('../../src/jobs/pipeline/pipelineCore', () => ({
  buildEmbeddingText: jest.fn(() => 'texto do evento para embedding'),
  embeddingProvider: { generate: mockGenerateEmbedding },
}));

jest.mock('../../src/config', () => ({
  config: {
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-4o-mini',
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

import { deduplicateNews } from '../../src/services/deduplication';

const getMockCreate = () => mockCreate;

/**
 * Embedding fake normalizado, do TAMANHO REAL (1536).
 *
 * 🚨 O tamanho nao e detalhe: a camada 2 descarta candidato cujo vetor nao tenha
 * 1536 posicoes, porque cosseno entre vetores de tamanhos diferentes devolveria
 * numero sem significado. Este helper gerava 10 dimensoes — com isso, TODO
 * candidato era descartado e `deduplicateNews` respondia "nao e duplicata"
 * sempre. Os testes que esperavam `false` passavam sem exercitar nada.
 */
const DIMENSOES_OPENAI = 1536;

function makeEmbedding(seed: number): number[] {
  const vec = Array.from({ length: DIMENSOES_OPENAI }, (_, i) => Math.sin(seed + i));
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / mag);
}

function makeNewsData(overrides = {}) {
  return {
    e_crime: true as const,
    // A taxonomia virou `roubo_furto` (+ `natureza` e `categoria_grupo`) quando
    // as categorias entraram. `roubo` sobrevive so como alias na entrada do GPT.
    tipo_crime: 'roubo_furto' as const,
    natureza: 'ocorrencia' as const,
    categoria_grupo: 'patrimonial' as const,
    cidade: 'São Paulo',
    bairro: 'Centro',
    rua: 'Rua Augusta',
    data_ocorrencia: '2026-02-07',
    resumo: 'Assalto a banco na região central.',
    confianca: 0.95,
    embedding: makeEmbedding(1),
    ...overrides,
  };
}

describe('deduplicateNews', () => {
  beforeEach(() => {
    mockFindGeoTemporalCandidates.mockReset();
    mockInsertNewsSource.mockReset();
    getMockCreate().mockReset();
  });

  describe('Layer 1 - Geo-Temporal', () => {
    it('should return NOT duplicate when no candidates found', async () => {
      mockFindGeoTemporalCandidates.mockResolvedValue([]);

      const result = await deduplicateNews(makeNewsData(), 'https://example.com/article');

      expect(result.isDuplicate).toBe(false);
      // GPT should NOT be called
      expect(getMockCreate()).not.toHaveBeenCalled();
    });
  });

  describe('Layer 2 - Embedding Similarity', () => {
    it('should return NOT duplicate when similarity is low', async () => {
      // Embedding muito diferente (ortogonal)
      mockFindGeoTemporalCandidates.mockResolvedValue([{
        id: 'existing-id',
        resumo: 'Resumo totalmente diferente',
        embedding: makeEmbedding(100), // Seed bem diferente
      }]);

      const result = await deduplicateNews(makeNewsData(), 'https://example.com/article');

      expect(result.isDuplicate).toBe(false);
      // GPT should NOT be called (low similarity, no need)
      expect(getMockCreate()).not.toHaveBeenCalled();
    });
  });

  describe('Layer 3 - GPT Confirmation', () => {
    it('should return duplicate when GPT confirms', async () => {
      // Embedding quase idêntico (mesmo seed)
      const embedding = makeEmbedding(1);
      mockFindGeoTemporalCandidates.mockResolvedValue([{
        id: 'existing-id',
        resumo: 'Assalto ao banco na região central de SP.',
        embedding, // Mesmo embedding = cosine 1.0
      }]);
      mockInsertNewsSource.mockResolvedValue(undefined);

      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: 'YES' } }],
      });

      const result = await deduplicateNews(
        makeNewsData({ embedding }),
        'https://example.com/article'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('existing-id');
      // Source should be added to existing news
      expect(mockInsertNewsSource).toHaveBeenCalledWith('existing-id', 'https://example.com/article');
    });

    it('should return NOT duplicate when GPT denies', async () => {
      const embedding = makeEmbedding(1);
      mockFindGeoTemporalCandidates.mockResolvedValue([{
        id: 'existing-id',
        resumo: 'Outro crime completamente diferente no mesmo local.',
        embedding,
      }]);

      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: 'NO' } }],
      });

      const result = await deduplicateNews(
        makeNewsData({ embedding }),
        'https://example.com/article'
      );

      expect(result.isDuplicate).toBe(false);
      expect(mockInsertNewsSource).not.toHaveBeenCalled();
    });

    it('should return NOT duplicate when GPT throws error (safe default)', async () => {
      const embedding = makeEmbedding(1);
      mockFindGeoTemporalCandidates.mockResolvedValue([{
        id: 'existing-id',
        resumo: 'Resumo similar.',
        embedding,
      }]);

      getMockCreate().mockRejectedValue(new Error('API error'));

      const result = await deduplicateNews(
        makeNewsData({ embedding }),
        'https://example.com/article'
      );

      expect(result.isDuplicate).toBe(false); // Safe default: don't lose news
    });
  });

  describe('Multiple candidates', () => {
    it('should pick the candidate with highest similarity', async () => {
      const newsEmbedding = makeEmbedding(1);

      mockFindGeoTemporalCandidates.mockResolvedValue([
        { id: 'low-sim', resumo: 'Diferente', embedding: makeEmbedding(50) },
        { id: 'high-sim', resumo: 'Quase igual', embedding: newsEmbedding }, // Cosine 1.0
        { id: 'mid-sim', resumo: 'Mais ou menos', embedding: makeEmbedding(2) },
      ]);
      mockInsertNewsSource.mockResolvedValue(undefined);

      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: 'YES' } }],
      });

      const result = await deduplicateNews(
        makeNewsData({ embedding: newsEmbedding }),
        'https://example.com/article'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.existingId).toBe('high-sim');
    });
  });
});
