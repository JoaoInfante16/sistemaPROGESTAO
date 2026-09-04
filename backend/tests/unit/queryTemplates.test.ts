// Este arquivo testava `QUERY_TEMPLATES` e `selectTemplates` — cinco templates
// fixos, com rodizio entre eles. Esse conceito morreu quando o usuario passou a
// escolher os ASSUNTOS da busca no painel (03/08). O que sobreviveu e continua
// aqui: o rodizio (agora sobre assuntos), o modo `keywords` por cidade, e a
// diferenca entre auto-scan (parcial, de hora em hora) e busca manual (a lista
// inteira, sob demanda).

const mockGet = jest.fn();
jest.mock('../../src/services/configManager', () => ({
  configManager: { get: mockGet },
}));

import {
  ASSUNTOS_PADRAO,
  parseAssuntos,
  getAssuntos,
  buildQueries,
  buildManualSearchQueries,
} from '../../src/services/search/queryTemplates';
import { MonitoredLocation } from '../../src/utils/types';

const cidade: MonitoredLocation = {
  id: 'loc-1',
  type: 'city',
  name: 'São Paulo',
  parent_id: 'state-sp',
  active: true,
  mode: 'any',
  keywords: null,
  scan_frequency_minutes: 60,
  last_check: null,
  created_at: new Date(),
};

const cidadeComPalavrasProprias: MonitoredLocation = {
  ...cidade,
  mode: 'keywords',
  keywords: ['sequestro', 'extorsão'],
};

/** Lista previsivel, para o rodizio poder ser conferido por indice. */
const CINCO = ['assunto A', 'assunto B', 'assunto C', 'assunto D', 'assunto E'];

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(CINCO.join('\n'));
});

describe('a lista de assuntos aceita o que o usuario digita', () => {
  it('separa por quebra de linha ou por virgula — os dois', () => {
    expect(parseAssuntos('roubo\nfurto,tráfico')).toEqual(['roubo', 'furto', 'tráfico']);
  });

  it('ignora espaco sobrando e linha vazia', () => {
    expect(parseAssuntos('  roubo  ,\n\n  furto ')).toEqual(['roubo', 'furto']);
  });

  it('descarta assunto repetido, mesmo com caixa diferente', () => {
    // Repetido custaria uma query inteira para devolver a mesma SERP.
    expect(parseAssuntos('Roubo\nroubo\nROUBO')).toEqual(['Roubo']);
  });

  it('devolve lista vazia quando o campo esta vazio', () => {
    expect(parseAssuntos('')).toEqual([]);
  });
});

describe('o sistema nunca fica sem assunto nenhum', () => {
  it('usa a lista de fabrica quando o painel responde vazio', async () => {
    mockGet.mockResolvedValue('');
    expect(await getAssuntos()).toEqual(ASSUNTOS_PADRAO);
  });

  it('usa a lista de fabrica quando o painel responde lixo', async () => {
    mockGet.mockResolvedValue('   ,,,  \n\n ');
    expect(await getAssuntos()).toEqual(ASSUNTOS_PADRAO);
  });
});

describe('auto-scan: cobre a lista aos poucos, nao paga tudo de uma vez', () => {
  it('cada query carrega o nome da cidade', async () => {
    const queries = await buildQueries(cidade, {
      multiQueryEnabled: true,
      queriesPerScan: 3,
      scanIndex: 0,
    });
    for (const q of queries) expect(q).toContain('São Paulo');
  });

  it('roda um assunto so quando multi-query esta desligado', async () => {
    const queries = await buildQueries(cidade, {
      multiQueryEnabled: false,
      queriesPerScan: 3,
      scanIndex: 0,
    });
    expect(queries).toEqual(['assunto A São Paulo']);
  });

  it('anda na lista a cada scan, e volta ao inicio no fim', async () => {
    const scan = (i: number) =>
      buildQueries(cidade, { multiQueryEnabled: true, queriesPerScan: 2, scanIndex: i });

    expect(await scan(0)).toEqual(['assunto A São Paulo', 'assunto B São Paulo']);
    expect(await scan(1)).toEqual(['assunto C São Paulo', 'assunto D São Paulo']);
    // 5 assuntos, 2 por scan: o terceiro scan pega o ultimo e da a volta.
    expect(await scan(2)).toEqual(['assunto E São Paulo', 'assunto A São Paulo']);
  });

  it('nunca pede mais assuntos do que existem na lista', async () => {
    const queries = await buildQueries(cidade, {
      multiQueryEnabled: true,
      queriesPerScan: 99,
      scanIndex: 0,
    });
    expect(queries).toHaveLength(CINCO.length);
  });

  it('palavra propria da cidade substitui a lista geral', async () => {
    // E uma escolha por cidade, mais especifica que a lista do painel.
    const queries = await buildQueries(cidadeComPalavrasProprias, {
      multiQueryEnabled: true,
      queriesPerScan: 3,
      scanIndex: 0,
    });
    expect(queries).toEqual(['sequestro extorsão São Paulo']);
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('busca manual: roda a lista inteira, porque e sob demanda', () => {
  it('sem escolha na tela, usa a lista do painel INTEIRA', async () => {
    const queries = await buildManualSearchQueries('Niterói');
    expect(queries).toHaveLength(CINCO.length);
    expect(queries[0]).toBe('assunto A Niterói');
  });

  it('a escolha da tela manda, e substitui a lista do painel', async () => {
    // O usuario escolhe quais perguntas fazer e paga o tempo da propria escolha.
    const queries = await buildManualSearchQueries('Niterói', ['tráfico', 'homicídio']);
    expect(queries).toEqual(['tráfico Niterói', 'homicídio Niterói']);
  });

  it('escolha vazia cai na lista do painel, nao devolve nada vazio', async () => {
    const queries = await buildManualSearchQueries('Niterói', []);
    expect(queries).toHaveLength(CINCO.length);
  });
});
