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
 * Cores por categoria. Espelham `mobile-app/lib/core/utils/category_colors.dart`
 * — servidas aqui pro app poder pintar chip de assunto que ele nao conhecia no
 * dia do build, sem precisar de APK novo quando a taxonomia crescer.
 */
export const CATEGORIA_CORES: Record<CategoriaGrupo, string> = {
  seguranca: '#EF4444',
  patrimonial: '#F97316',
  operacional: '#3B82F6',
  fraude: '#8B5CF6',
  institucional: '#64748B',
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
