// O Filter1 fala com a OpenAI pelo client COMPARTILHADO (`services/openaiClient`),
// nao pelo pacote `openai` direto — centralizado para o timeout de 60s valer nos
// seis lugares que chamavam a API. Mockar o pacote nao intercepta mais nada, e a
// suite passava a exercitar o client de verdade.
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

import { filter1GPTBatch } from '../../src/services/filters/filter1GPTBatch';

const emLote = (results: unknown[]) => ({
  choices: [{ message: { content: JSON.stringify({ results }) } }],
});

const respostaUnica = (texto: string) => ({
  choices: [{ message: { content: texto } }],
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe('o filtro decide quais trechos sao seguranca publica', () => {
  it('devolve a decisao de cada trecho, na ordem em que entraram', async () => {
    mockCreate.mockResolvedValue(emLote([true, false, true]));

    const { results } = await filter1GPTBatch([
      'Roubo a banco em São Paulo',
      'Receita de bolo de chocolate',
      'Homicídio na zona sul',
    ]);

    expect(results).toEqual([true, false, true]);
  });

  it('pergunta UMA vez pelo lote inteiro, nao uma vez por trecho', async () => {
    // O lote e a economia central deste estagio: 5 trechos, 1 chamada.
    mockCreate.mockResolvedValue(emLote([true, true, true, true, true]));

    await filter1GPTBatch(['s1', 's2', 's3', 's4', 's5']);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('reporta quantos tokens gastou, porque este estagio e pago', async () => {
    mockCreate.mockResolvedValue({
      ...emLote([true]),
      usage: { total_tokens: 321 },
    });

    const { tokensUsed } = await filter1GPTBatch(['s1']);
    expect(tokensUsed).toBe(321);
  });

  it('nao chama a API quando nao ha nada para decidir', async () => {
    const { results } = await filter1GPTBatch([]);

    expect(results).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('trecho sozinho usa o caminho curto, que pergunta em portugues', () => {
  it('aceita SIM como aprovacao', async () => {
    mockCreate.mockResolvedValue(respostaUnica('SIM'));

    const { results } = await filter1GPTBatch(['Assalto à mão armada']);

    expect(results).toEqual([true]);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('qualquer coisa que nao seja SIM/YES reprova', async () => {
    mockCreate.mockResolvedValue(respostaUnica('NÃO'));

    const { results } = await filter1GPTBatch(['Previsão do tempo para amanhã']);

    expect(results).toEqual([false]);
  });
});

describe('quando o GPT responde torto, o filtro corrige em vez de desistir', () => {
  it('completa com aprovado quando vem resposta a menos', async () => {
    // Deixa o Filter2 decidir: descartar o lote inteiro jogaria fora coleta paga.
    mockCreate.mockResolvedValue(emLote([true, false])); // esperava 3

    const { results } = await filter1GPTBatch(['s1', 's2', 's3']);

    expect(results).toEqual([true, false, true]);
  });

  it('descarta o excedente quando vem resposta a mais', async () => {
    mockCreate.mockResolvedValue(emLote([true, false, true, true])); // esperava 2

    const { results } = await filter1GPTBatch(['s1', 's2']);

    expect(results).toEqual([true, false]);
  });

  it('trata qualquer valor que nao seja booleano verdadeiro como reprovado', async () => {
    mockCreate.mockResolvedValue(emLote([true, 'sim', 1, false]));

    const { results } = await filter1GPTBatch(['s1', 's2', 's3', 's4']);

    expect(results).toEqual([true, false, false, false]);
  });

  it('tenta de novo antes de aprovar tudo, quando a resposta nao e JSON', async () => {
    mockCreate.mockResolvedValue(respostaUnica('isso nao e json'));

    const { results } = await filter1GPTBatch(['s1', 's2']);

    // Duas tentativas; so entao aprova tudo e deixa o Filter2 filtrar.
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(results).toEqual([true, true]);
  });
});

describe('🚨 quando a OpenAI cai, o filtro NAO aprova tudo', () => {
  it('lanca erro em vez de deixar o lote passar', async () => {
    // ARQUITETURA §2, regra 8. Aprovar tudo mandaria o lote inteiro para Jina e
    // Filter2, que sao os estagios caros — a conta explode justamente no momento
    // em que o sistema esta cego. Lancar devolve o job para a fila do BullMQ com
    // backoff, e o Sentry ja avisou. Quando a OpenAI voltar, o job continua.
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    await expect(filter1GPTBatch(['s1', 's2', 's3'])).rejects.toThrow('OpenAI falhou');
  });

  it('tenta duas vezes antes de desistir', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    await expect(filter1GPTBatch(['s1', 's2'])).rejects.toThrow();
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('trecho sozinho tambem lanca — nao some em silencio', async () => {
    // Ate 04/09 este caminho tinha UMA tentativa e devolvia `false` no catch: a
    // noticia sumia sem alerta e sem retry, e um scan que achou um item so
    // perdia justamente esse. Igualado ao caminho do lote a pedido do Joao.
    mockCreate.mockRejectedValue(new Error('API rate limit'));

    await expect(filter1GPTBatch(['unico trecho'])).rejects.toThrow('OpenAI falhou');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
