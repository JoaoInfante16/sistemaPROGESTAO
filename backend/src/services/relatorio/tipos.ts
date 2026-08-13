// ============================================
// O relatório em papel — o contrato
// ============================================
// Este arquivo existe pra ter **uma** forma do relatório, alimentada por dois
// produtores diferentes:
//
//   1. o app, que já contou tudo em memória com o recorte que o usuário mexeu
//      na tela (período, categoria, +antigas, +região);
//   2. o backend, que consulta o banco quando ninguém mandou contagem nenhuma
//      (é o caminho do painel admin).
//
// 🚨 **Um renderizador só.** Até 12/08 o relatório compartilhado era uma página
// Next.js dentro do painel admin, e o app mandava `cidade: cidades.first` — o
// texto do compartilhamento dizia "Florianópolis, São José e Palhoça" e a
// página entregava Florianópolis sozinha. Duas verdades sobre o mesmo
// documento é o defeito que esta fase inteira passou consertando.

import { CrimePoint } from '../../utils/types';

/**
 * O que o usuário tinha filtrado quando mandou gerar. Vai escrito na capa.
 *
 * 🚨 **Quase tudo aqui é opcional, e não por preguiça.** Duas telas geram
 * relatório e elas não têm os mesmos controles: a consulta manual tem
 * `+antigas`, `+região` e categorias; o **monitoramento só tem período**.
 * Enquanto os três campos eram obrigatórios, o auto-scan precisaria inventar
 * valores — e a capa imprimiria *"Municípios vizinhos: fora da contagem"* num
 * documento onde esse conceito nem existe. Ruído que parece informação é pior
 * que campo ausente: quem lê conclui que alguém decidiu excluir a região.
 *
 * A regra do render é literal: **o que não veio, não é impresso.**
 */
export interface RecorteDeclarado {
  /** Janela efetiva em dias — o re-fatiamento da tela, não o pedido da busca. */
  dias: number;
  /**
   * De onde saiu o documento. A distinção importa pra quem lê e não dá pra
   * inferir dos números: varredura 24/7 desde que a cidade entrou no
   * monitoramento não é a mesma coisa que uma consulta pontual disparada agora.
   */
  origem?: 'monitoramento' | 'consulta';
  /** Incluiu matérias anteriores ao período pedido. Só a consulta manual tem. */
  antigas?: boolean;
  /** Incluiu ocorrências de município vizinho. Só a consulta manual tem. */
  regiao?: boolean;
  /** Categorias marcadas. **Vazio quer dizer todas** — a mesma regra do app. */
  categorias?: string[];
  /** Até onde o "+ antigas" podia alcançar (config `manual_search_horizon_days`). */
  horizonteDias?: number;
  /** Municípios vizinhos presentes, pra dizer QUAIS são e não só quantos. */
  municipiosVizinhos?: string[];
}

export interface IndicadorExecutivo {
  valor: number;
  unidade: string | null;
  tipo: 'percentual' | 'absoluto' | 'monetario';
  sentido: 'positivo' | 'negativo' | 'neutro';
  label: string;
  contexto: string | null;
  fonte: string | null;
}

export interface FonteAnalisada {
  name: string;
  count: number;
}

/** Tudo que o papel precisa. Nada de opcional escondido: o que falta, falta. */
export interface RelatorioRenderizavel {
  cidades: string[];
  estado: string;
  /** YYYY-MM-DD */
  dateFrom: string;
  dateTo: string;
  /** ISO */
  geradoEm: string;

  recorte: RecorteDeclarado | null;

  total: number;
  /** Quantas das contadas são de município vizinho. */
  totalRegiao: number;
  /** Ocorrências sem bairro na matéria — o que fica fora do ranking. */
  semBairro: number;
  totalEstatisticas: number;

  byCategory: Array<{ categoria: string; count: number }>;
  byCrimeType: Array<{ tipo_crime: string; count: number }>;
  topBairros: Array<{ bairro: string; count: number }>;
  /** Série **diária crua**. O balde (dia/semana/mês) é escolhido no render. */
  serie: Array<{ date: string; count: number }>;

  mapPoints: CrimePoint[];

  executive: {
    indicadores: IndicadorExecutivo[];
    resumo_complementar: string | null;
    fontes: string[];
  };

  sourcesOficial: FonteAnalisada[];
  sourcesMedia: FonteAnalisada[];
}

/**
 * O que a TELA contou.
 *
 * É o mesmo conjunto de números que o app já tem em memória quando a pessoa
 * aperta o botão — ele conta no cliente porque re-fatiar é de graça, o dado já
 * veio na busca. Mandar as contagens prontas é o que faz papel e tela baterem
 * **por construção**, e não por duas implementações do mesmo recorte.
 */
export interface ContagensDaTela {
  total: number;
  totalRegiao: number;
  semBairro: number;
  totalEstatisticas: number;
  byCategory: Array<{ categoria: string; count: number }>;
  byCrimeType: Array<{ tipo_crime: string; count: number }>;
  topBairros: Array<{ bairro: string; count: number }>;
  serie: Array<{ date: string; count: number }>;
  sourcesOficial: FonteAnalisada[];
  sourcesMedia: FonteAnalisada[];
}
