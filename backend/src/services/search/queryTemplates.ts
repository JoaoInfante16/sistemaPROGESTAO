// ============================================
// Query Templates — Google (indice de noticias, tbm=nws)
// ============================================
// Reescritos em 2026-08-01. A versao anterior era feita pra **Perplexity**
// (busca semantica): frases longas em linguagem natural, do tipo "prisoes em
// flagrante ou preventivas em X nas ultimas 48 horas, citando fontes oficiais...".
// O backend virou Bright Data/Google e ninguem reescreveu. Medido no dia:
// **os templates 1-4 devolviam ZERO** no indice de noticias.
//
// Duas regras que sairam da medicao, ambas contraintuitivas:
//
// 1. QUERY CURTA GANHA DE QUERY LONGA. Porto Alegre, pagina 1, `sbd:1`:
//    `notícias policiais ocorrências crime Porto Alegre Rio Grande do Sul` -> 4/10 na janela
//    `polícia Porto Alegre`                                               -> 10/10, a mais recente de 17h atras
//
// 2. NAO COLOCAR O ESTADO NA QUERY — nem por extenso, nem a sigla. Ele empurra
//    o resultado pra conteudo institucional (concurso, corrida da PC, boletim
//    de secretaria) e afasta a ocorrencia local:
//    `polícia São José`    -> mais recente ha 44 MINUTOS
//    `polícia São José SC` -> mais recente ha 3 SEMANAS
//
//    A desambiguacao de cidade homonima (Sao Jose/SC vs Sao Jose/SP) NAO se faz
//    aqui — quem faz e o pos-filtro do Filter2, que le cidade E estado do corpo
//    do artigo. Botar o estado na query nao desambigua, so degrada.
//
// 3. Templates diferentes trazem materia diferente: `polícia` trouxe 10 itens
//    que o template base nao trazia; `homicídio` trouxe 9. Multi-query vale.

import { MonitoredLocation } from '../../utils/types';

export interface QueryTemplate {
  id: number;
  name: string;
  /** Gera a query string para uma location. */
  build: (location: MonitoredLocation) => string;
}

/**
 * Templates curtos, por keyword. O 0 e o mais generico e o que rende mais
 * volume; os outros aprofundam categorias que o generico nao cobre bem.
 */
export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 0,
    name: 'policia',
    build: (loc) => {
      const hasKeywords = loc.mode === 'keywords' && loc.keywords && loc.keywords.length > 0;
      if (hasKeywords) return `${loc.keywords!.join(' ')} ${loc.name}`;
      return `polícia ${loc.name}`;
    },
  },
  { id: 1, name: 'homicidios', build: (loc) => `homicídio morte tiros ${loc.name}` },
  { id: 2, name: 'patrimonial', build: (loc) => `roubo furto assalto ${loc.name}` },
  { id: 3, name: 'trafico_armas', build: (loc) => `tráfico drogas apreensão armas ${loc.name}` },
  { id: 4, name: 'violencia_domestica', build: (loc) => `violência doméstica feminicídio ${loc.name}` },
];

/**
 * Seleciona N templates para um scan usando round-robin.
 * @param scanIndex Índice do scan (incrementa a cada scan da location)
 * @param queriesPerScan Quantas queries rodar neste scan (1-5)
 */
export function selectTemplates(scanIndex: number, queriesPerScan: number): QueryTemplate[] {
  const count = Math.max(1, Math.min(queriesPerScan, QUERY_TEMPLATES.length));
  const startIndex = (scanIndex * count) % QUERY_TEMPLATES.length;
  const selected: QueryTemplate[] = [];

  for (let i = 0; i < count; i++) {
    const idx = (startIndex + i) % QUERY_TEMPLATES.length;
    selected.push(QUERY_TEMPLATES[idx]);
  }

  return selected;
}

/**
 * Gera queries a partir de templates selecionados para uma location.
 * Se multi_query desabilitado, retorna apenas o template 0.
 */
export function buildQueries(
  location: MonitoredLocation,
  options: { multiQueryEnabled: boolean; queriesPerScan: number; scanIndex: number }
): string[] {
  if (!options.multiQueryEnabled) {
    return [QUERY_TEMPLATES[0].build(location)];
  }

  const templates = selectTemplates(options.scanIndex, options.queriesPerScan);
  return templates.map((t) => t.build(location));
}

/**
 * Queries da busca manual. Sem estado, pelo motivo medido no topo do arquivo.
 *
 * Com tipo de crime escolhido, uma query focada basta — o usuario ja restringiu
 * o assunto. Sem tipo, roda os 3 primeiros templates, que foi o que rendeu mais
 * materia unica dentro da janela na medicao.
 */
export function buildManualSearchQueries(cidade: string, tipoCrime?: string): string[] {
  if (tipoCrime) return [`${tipoCrime} ${cidade}`];
  const loc = { name: cidade, mode: 'any' } as MonitoredLocation;
  return QUERY_TEMPLATES.slice(0, 3).map((t) => t.build(loc));
}
