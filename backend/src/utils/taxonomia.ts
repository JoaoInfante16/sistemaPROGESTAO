// ============================================
// Catalogo de assuntos — a taxonomia como fonte das queries
// ============================================
// Ate 03/08 a lista de assuntos pesquisados (`search_subjects`, 5 itens) e a
// taxonomia de classificacao (`TIPO_CRIME_GRUPO`, 16 tipos) eram dois mundos
// separados: 9 dos 16 tipos NUNCA viravam pergunta ao Google e so entravam de
// carona nas 5 queries existentes. Este arquivo casa os dois.
//
// Cada entrada e um ASSUNTO — uma pergunta que vale a pena fazer ao indice — e
// aponta pro `tipo_crime` que o Filter2 vai atribuir. A relacao e N:1 de
// proposito: "greve" e "manifestacao" sao perguntas diferentes que classificam
// no mesmo `manifestacao`, e "violencia domestica" e "agressao" no mesmo
// `lesao_corporal`. Perguntar as duas rende materia diferente; classificar nos
// dois seria taxonomia inflada sem ganho pro cliente.
//
// POR QUE ISTO IMPORTA: o indice do Google tem teto de ~60-70 itens POR QUERY e
// nao ha parametro que mude isso (medido em 01-02/08 — ver o topo de
// queryTemplates.ts). Pedir mais pagina do mesmo assunto nao traz nada;
// perguntar outro assunto traz. Cada assunto e um teto novo.
//
// ⚠️ Os termos sao CURTOS por medicao, nao por estilo: `polícia Porto Alegre`
// deu 10/10 na janela e a versao longa deu 4/10. Nenhum termo aqui leva estado,
// pelo mesmo motivo — quem desambigua cidade homonima e o pos-filtro do Filter2.
//
// Quem consome:
//   - `buildManualSearchQueries` (busca manual, roda os assuntos escolhidos)
//   - `GET /settings/taxonomia` (o app monta a tela de templates)
//   - o default de `search_subjects` (auto-scan) continua em configManager

import { TipoCrime, CategoriaGrupo } from './types';

export interface AssuntoCatalogo {
  /** O que vai pro Google, sem a cidade. Curto, sem estado. */
  termo: string;
  /** Como o app mostra o chip. */
  label: string;
  tipo: TipoCrime;
  categoria: CategoriaGrupo;
  /**
   * Faz parte do conjunto minimo — os 5 assuntos que o sistema pesquisa desde
   * 02/08. E o preset rapido da tela: cobre o grosso da ocorrencia policial sem
   * multiplicar o tempo da busca.
   */
  essencial?: boolean;
}

export const ASSUNTOS_CATALOGO: AssuntoCatalogo[] = [
  // ── patrimonial ──
  { termo: 'roubo furto', label: 'Roubo e furto', tipo: 'roubo_furto', categoria: 'patrimonial', essencial: true },
  { termo: 'vandalismo', label: 'Vandalismo', tipo: 'vandalismo', categoria: 'patrimonial' },
  { termo: 'invasão', label: 'Invasão', tipo: 'invasao', categoria: 'patrimonial' },
  { termo: 'receptação', label: 'Receptação', tipo: 'receptacao', categoria: 'patrimonial' },

  // ── seguranca ──
  { termo: 'homicídio', label: 'Homicídio', tipo: 'homicidio', categoria: 'seguranca', essencial: true },
  { termo: 'latrocínio', label: 'Latrocínio', tipo: 'latrocinio', categoria: 'seguranca' },
  { termo: 'violência doméstica', label: 'Violência doméstica', tipo: 'lesao_corporal', categoria: 'seguranca', essencial: true },
  { termo: 'agressão', label: 'Agressão', tipo: 'lesao_corporal', categoria: 'seguranca' },

  // ── operacional ──
  { termo: 'polícia', label: 'Operação policial', tipo: 'operacao_policial', categoria: 'operacional', essencial: true },
  { termo: 'tráfico drogas', label: 'Tráfico de drogas', tipo: 'trafico', categoria: 'operacional', essencial: true },
  { termo: 'manifestação', label: 'Manifestação', tipo: 'manifestacao', categoria: 'operacional' },
  { termo: 'greve', label: 'Greve', tipo: 'manifestacao', categoria: 'operacional' },
  { termo: 'bloqueio rodovia', label: 'Bloqueio de via', tipo: 'bloqueio_via', categoria: 'operacional' },

  // ── fraude ──
  { termo: 'estelionato', label: 'Estelionato', tipo: 'estelionato', categoria: 'fraude' },
  { termo: 'golpe', label: 'Golpe', tipo: 'estelionato', categoria: 'fraude' },

  // ── institucional ──
  { termo: 'crime ambiental', label: 'Crime ambiental', tipo: 'crime_ambiental', categoria: 'institucional' },
  { termo: 'trabalho escravo', label: 'Trabalho escravo', tipo: 'trabalho_irregular', categoria: 'institucional' },
];

/**
 * Cores por categoria. **Esta e a fonte unica** — o app usa a cor que vem daqui
 * e so cai na copia local quando a taxonomia nao carregou (rede fora).
 *
 * Ate 08/08 esta constante dizia "espelham category_colors.dart", e era uma
 * copia que apodreceu: o Dart trocou de paleta e o backend nao, entao Fraude
 * saia violeta Tailwind na tela de busca e violeta validado no feed, no mesmo
 * APK. Espelho de dado nao se mantem sozinho — por isso agora tem um dono.
 *
 * Os hexes sao MEDIDOS, nao escolhidos a olho. Sobre o navy #060D18:
 *   banda de luminosidade OKLCH 0.48–0.67 · croma >= 0.10
 *   dE deuteranopia 8.0 · dE visao normal 19.3 · contraste >= 3:1
 *
 * Os valores antigos (red/orange/blue/violet/slate-500 do Tailwind) reprovavam
 * em 4 das 5 checagens — o pior: operacional x fraude com dE 1.3 sob
 * deuteranopia, ou seja a MESMA cor pra ~8% dos homens, no mapa e no donut e
 * nos chips ao mesmo tempo.
 *
 * ⚠️ Antes de mexer em qualquer hex, revalidar com o script `validate_palette.js`
 * da skill `dataviz`. A adjacencia e conferida na ordem de CATEGORIA_ORDEM:
 * trocar a ordem tambem exige revalidar, porque num empilhado so vizinhos se
 * encostam. Azul e violeta nao coexistem — foi por isso que institucional
 * virou verde-escuro em vez de cinza.
 */
export const CATEGORIA_CORES: Record<CategoriaGrupo, string> = {
  seguranca: '#DA4358',
  patrimonial: '#B39026',
  operacional: '#1F98AB',
  fraude: '#8F62CB',
  institucional: '#4E8F45',
};

export const CATEGORIA_LABELS: Record<CategoriaGrupo, string> = {
  seguranca: 'Segurança',
  patrimonial: 'Patrimonial',
  operacional: 'Operacional',
  fraude: 'Fraude',
  institucional: 'Institucional',
};

/** Ordem de exibicao — a mesma do app (`categoryOrder`). */
export const CATEGORIA_ORDEM: CategoriaGrupo[] = [
  'seguranca',
  'patrimonial',
  'operacional',
  'fraude',
  'institucional',
];

/** Os termos do conjunto minimo, na ordem do catalogo. */
export const ASSUNTOS_ESSENCIAIS: string[] = ASSUNTOS_CATALOGO
  .filter((a) => a.essencial)
  .map((a) => a.termo);

/** Todos os termos do catalogo. */
export const ASSUNTOS_TODOS: string[] = ASSUNTOS_CATALOGO.map((a) => a.termo);
