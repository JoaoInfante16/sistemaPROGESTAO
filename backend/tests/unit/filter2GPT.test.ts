// O Filter2 fala com a OpenAI pelo client COMPARTILHADO (`services/openaiClient`),
// nao pelo pacote `openai` direto — centralizado para o timeout de 60s valer nos
// seis lugares que chamavam a API. Mockar o pacote nao intercepta mais nada.
const mockCreate = jest.fn();
jest.mock('../../src/services/openaiClient', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
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

import { filter2GPT } from '../../src/services/filters/filter2GPT';

const getMockCreate = () => mockCreate;

function makeValidExtraction(overrides = {}) {
  return {
    e_crime: true,
    // A taxonomia perdeu os acentos e agrupou: `roubo` e `furto` viraram
    // `roubo_furto`, e cada tipo passou a carregar uma categoria derivada.
    tipo_crime: 'roubo_furto',
    cidade: 'São Paulo',
    bairro: 'Centro',
    rua: 'Rua Augusta',
    data_ocorrencia: '2026-02-07',
    resumo: 'Assalto a banco na região central de São Paulo.',
    confianca: 0.95,
    ...overrides,
  };
}

describe('filter2GPT', () => {
  beforeEach(() => {
    getMockCreate().mockReset();
  });

  describe('valid extractions', () => {
    it('should return extraction for valid crime news', async () => {
      const extraction = makeValidExtraction();
      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(extraction) } }],
      });

      const result = await filter2GPT('Conteúdo de notícia de crime...');

      expect(result).not.toBeNull();
      expect(result!.tipo_crime).toBe('roubo_furto');
      expect(result!.cidade).toBe('São Paulo');
      expect(result!.confianca).toBe(0.95);
    });

    it('should accept all valid crime types', async () => {
      // A taxonomia real de hoje, sem acento, com os cinco grupos representados.
      const crimeTypes = [
        'roubo_furto', 'vandalismo', 'invasao', 'receptacao',      // patrimonial
        'homicidio', 'latrocinio', 'lesao_corporal',               // seguranca
        'trafico', 'operacao_policial', 'greve', 'bloqueio_via', 'manifestacao', // operacional
        'estelionato',                                             // fraude
        'crime_ambiental', 'trabalho_irregular', 'estatistica', 'outros', // institucional
      ];

      for (const tipo of crimeTypes) {
        getMockCreate().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify(makeValidExtraction({ tipo_crime: tipo })) } }],
        });

        const result = await filter2GPT('content');
        expect(result).not.toBeNull();
        expect(result!.tipo_crime).toBe(tipo);
      }
    });

    it('should handle optional fields (bairro, rua) as undefined', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify(makeValidExtraction({ bairro: null, rua: null })),
          },
        }],
      });

      const result = await filter2GPT('content');
      expect(result).not.toBeNull();
      expect(result!.bairro).toBeUndefined();
      expect(result!.rua).toBeUndefined();
    });
  });

  describe('validation - rejects invalid data', () => {
    it('should return null when e_crime is false', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ e_crime: false }) } }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null when confianca < 0.7', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ confianca: 0.5 })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null when confianca > 1.0', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ confianca: 1.5 })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null for invalid tipo_crime', async () => {
      // 'sequestro' NAO serve mais como exemplo de invalido: virou alias de
      // `outros`, junto com tortura, extorsao, feminicidio e outros — a
      // taxonomia prefere reclassificar a descartar a noticia.
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ tipo_crime: 'pesca_ilegal' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('tipo fora da taxonomia mas conhecido vira `outros` em vez de sumir', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ tipo_crime: 'sequestro' })) },
        }],
      });

      const result = await filter2GPT('content');
      expect(result!.tipo_crime).toBe('outros');
      expect(result!.categoria_grupo).toBe('institucional');
    });

    it('should return null when cidade is empty', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ cidade: '' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null when resumo is empty', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ resumo: '' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null for invalid date format', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ data_ocorrencia: '07/02/2026' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null when confianca is a string', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ confianca: '0.95' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return null for invalid JSON response', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{ message: { content: 'this is not json' } }],
      });

      expect(await filter2GPT('content')).toBeNull();
    });

    it('should return null when API throws', async () => {
      getMockCreate().mockRejectedValue(new Error('API error'));

      expect(await filter2GPT('content')).toBeNull();
    });

    it('corta o conteudo antes de mandar, para nao pagar por texto infinito', async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ e_crime: false }) } }],
      });

      // O teto era 4000 e hoje e `filter2_max_content_chars` (8000 por default).
      // O que importa nao e o numero: e que o texto de entrada seja CORTADO, e
      // que a conta nao dependa do tamanho do artigo que o portal publicou.
      const TETO = 8000;
      const enorme = 'A'.repeat(50_000);
      await filter2GPT(enorme);

      const prompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      const trechoDaNoticia = (prompt.match(/A+/g) ?? []).sort((a, b) => b.length - a.length)[0] ?? '';

      expect(trechoDaNoticia.length).toBeGreaterThan(0);
      expect(trechoDaNoticia.length).toBeLessThanOrEqual(TETO);
      expect(prompt.length).toBeLessThan(enorme.length);
    });
  });
});
