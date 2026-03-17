// ============================================
// Query Templates - Variações de busca por crime
// ============================================
// 5 templates rotacionados: cada scan usa N templates
// (configurável via search_queries_per_scan).
// Round-robin baseado em scanIndex para distribuir uniformemente.

import { MonitoredLocation } from '../../utils/types';

export interface QueryTemplate {
  id: number;
  name: string;
  /** Gera a query string para uma location. */
  build: (location: MonitoredLocation) => string;
}

/**
 * Templates de busca - cobrem diferentes ângulos de crime.
 * Se a location tem keywords customizadas, elas são usadas no template 1 (genérico).
 */
export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 0,
    name: 'generico',
    build: (loc) => {
      const hasKeywords = loc.mode === 'keywords' && loc.keywords && loc.keywords.length > 0;
      const terms = hasKeywords
        ? loc.keywords!.join(' OR ')
        : 'crime polícia ocorrência';
      return `${terms} ${loc.name} site:.br`;
    },
  },
  {
    id: 1,
    name: 'crimes_graves',
    build: (loc) => `homicídio OR latrocínio OR tráfico ${loc.name} site:.br`,
  },
  {
    id: 2,
    name: 'crimes_patrimoniais',
    build: (loc) => `roubo OR furto OR assalto ${loc.name} site:.br`,
  },
  {
    id: 3,
    name: 'acoes_policiais',
    build: (loc) => `operação policial OR apreensão OR prisão ${loc.name} site:.br`,
  },
  {
    id: 4,
    name: 'registros_oficiais',
    build: (loc) => `boletim ocorrência OR delegacia ${loc.name} site:.br`,
  },
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
 * Se multi_query desabilitado, retorna apenas o template genérico (como antes).
 */
export function buildQueries(
  location: MonitoredLocation,
  options: { multiQueryEnabled: boolean; queriesPerScan: number; scanIndex: number }
): string[] {
  if (!options.multiQueryEnabled) {
    // Fallback: query única (comportamento original)
    return [QUERY_TEMPLATES[0].build(location)];
  }

  const templates = selectTemplates(options.scanIndex, options.queriesPerScan);
  return templates.map((t) => t.build(location));
}
