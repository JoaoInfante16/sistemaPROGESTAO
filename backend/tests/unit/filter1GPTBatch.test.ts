// Mock OpenAI ANTES de importar o módulo
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

// Mock config
jest.mock('../../src/config', () => ({
  config: {
    openaiApiKey: 'test-key',
    openaiModel: 'gpt-4o-mini',
  },
}));

// Mock logger
jest.mock('../../src/middleware/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { filter1GPTBatch } from '../../src/services/filters/filter1GPTBatch';

// Acessar o mock diretamente
const getMockCreate = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const openai = require('openai');
  return openai._mockCreate as jest.Mock;
};

describe('filter1GPTBatch', () => {
  beforeEach(() => {
    getMockCreate().mockReset();
  });

  describe('batch processing', () => {
    it('should return correct boolean array for valid batch response', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify({ results: [true, false, true] }) },
        }],
      });

      const result = await filter1GPTBatch([
        'Roubo a banco em São Paulo',
        'Receita de bolo de chocolate',
        'Homicídio na zona sul',
      ]);

      expect(result).toEqual([true, false, true]);
    });

    it('should make only ONE API call for multiple snippets', async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify({ results: [true, true, true, true, true] }) },
        }],
      });

      await filter1GPTBatch([
        'snippet 1', 'snippet 2', 'snippet 3', 'snippet 4', 'snippet 5',
      ]);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('single snippet optimization', () => {
    it('should use single-item prompt for 1 snippet', async () => {
      const mockCreate = getMockCreate();
      mockCreate.mockResolvedValue({
        choices: [{
          message: { content: 'SIM' },
        }],
      });

      const result = await filter1GPTBatch(['Assalto à mão armada']);
      expect(result).toEqual([true]);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should return [false] for single non-crime snippet', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: 'NÃO' },
        }],
      });

      const result = await filter1GPTBatch(['Previsão do tempo para amanhã']);
      expect(result).toEqual([false]);
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty input', async () => {
      const result = await filter1GPTBatch([]);
      expect(result).toEqual([]);
      expect(getMockCreate()).not.toHaveBeenCalled();
    });
  });

  describe('fallback behavior', () => {
    it('should return all true when response has wrong length', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify({ results: [true, false] }) }, // Esperava 3
        }],
      });

      const result = await filter1GPTBatch(['s1', 's2', 's3']);
      expect(result).toEqual([true, true, true]); // Fallback: todos true
    });

    it('should return all true when response is invalid JSON', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: 'not json at all' },
        }],
      });

      const result = await filter1GPTBatch(['s1', 's2']);
      expect(result).toEqual([true, true]);
    });

    it('should return all true when API throws error', async () => {
      getMockCreate().mockRejectedValue(new Error('API rate limit'));

      const result = await filter1GPTBatch(['s1', 's2', 's3']);
      expect(result).toEqual([true, true, true]);
    });

    it('should treat non-boolean values as false', async () => {
      getMockCreate().mockResolvedValue({
        choices: [{
          message: { content: JSON.stringify({ results: [true, 'sim', 1, false] }) },
        }],
      });

      const result = await filter1GPTBatch(['s1', 's2', 's3', 's4']);
      // 'sim' e 1 não são === true, então devem ser false
      expect(result).toEqual([true, false, false, false]);
    });
  });
});
