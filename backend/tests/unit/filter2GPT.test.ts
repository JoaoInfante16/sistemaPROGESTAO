// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    _mockCreate: mockCreate,
  };
});

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

const getMockCreate = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const openai = require('openai');
  return openai._mockCreate as jest.Mock;
};

function makeValidExtraction(overrides = {}) {
  return {
    e_crime: true,
    tipo_crime: 'roubo',
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
      expect(result!.tipo_crime).toBe('roubo');
      expect(result!.cidade).toBe('São Paulo');
      expect(result!.confianca).toBe(0.95);
    });

    it('should accept all valid crime types', async () => {
      const crimeTypes = ['roubo', 'furto', 'homicídio', 'latrocínio', 'tráfico', 'assalto', 'outro'];

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
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify(makeValidExtraction({ tipo_crime: 'sequestro' })) },
        }],
      });

      expect(await filter2GPT('content')).toBeNull();
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

    it('should truncate content to 4000 chars', async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ e_crime: false }) } }],
      });

      const longContent = 'A'.repeat(10000);
      await filter2GPT(longContent);

      const calledPrompt = mockCreate.mock.calls[0][0].messages[0].content as string;
      // O conteúdo no prompt deve ter no máximo 4000 chars da notícia + template
      // Template tem ~300 chars, total máximo ~4300 + margem
      expect(calledPrompt.length).toBeLessThan(4600);
    });
  });
});
