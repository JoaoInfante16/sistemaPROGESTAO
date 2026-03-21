// ============================================
// Query Templates - Perplexity Search API
// ============================================
// Otimizados para busca semantica (Perplexity).
// Template 0 = mega query que cobre tudo (default).
// Templates 1-4 = queries focadas para cobertura profunda (multi-query).
// Rotacionados via round-robin a cada scan.

import { MonitoredLocation } from '../../utils/types';

export interface QueryTemplate {
  id: number;
  name: string;
  /** Gera a query string para uma location. */
  build: (location: MonitoredLocation) => string;
}

/**
 * Templates otimizados para Perplexity Search API.
 *
 * Template 0 (mega query) é completo e cobre todos os tipos de crime.
 * Templates 1-4 aprofundam categorias especificas.
 *
 * Se a location tem keywords customizadas, o template 0 as incorpora.
 */
export const QUERY_TEMPLATES: QueryTemplate[] = [
  {
    id: 0,
    name: 'completo',
    build: (loc) => {
      const hasKeywords = loc.mode === 'keywords' && loc.keywords && loc.keywords.length > 0;
      if (hasKeywords) {
        return `Resumo completo de ocorrências policiais relacionadas a ${loc.keywords!.join(', ')} em ${loc.name} nas últimas 24-48h: liste por tipo, com data/hora, bairro, vítimas/suspeitos e fontes oficiais; exclua ficção/novelas; priorize notícias recentes`;
      }
      return `Resumo completo de TODAS ocorrências policiais em ${loc.name} nas últimas 24-48h: liste por tipo (homicídio, prisão, roubo, tráfico, violência doméstica, apreensões), com data/hora, bairro, vítimas/suspeitos e fontes oficiais (PM/PC/SSP); exclua ficção/novelas; priorize notícias recentes de sites como G1, PM oficial`;
    },
  },
  {
    id: 1,
    name: 'prisoes_flagrante',
    build: (loc) =>
      `prisões em flagrante ou preventivas em ${loc.name} nas últimas 48 horas, citando fontes oficiais como Polícia Civil ou PM, com datas, bairros e detalhes dos crimes`,
  },
  {
    id: 2,
    name: 'homicidios_mortes',
    build: (loc) =>
      `homicídios, tentativas de homicídio ou mortes por confronto policial em ${loc.name} nos últimos 3 dias, incluindo vítimas, suspeitos e locais exatos de portais locais confiáveis`,
  },
  {
    id: 3,
    name: 'crimes_patrimoniais',
    build: (loc) =>
      `roubos, furtos, tráfico de drogas e apreensões de armas ou veículos em ${loc.name} hoje e ontem, incluindo bairros e valores, de fontes como SSP ou boletins policiais recentes`,
  },
  {
    id: 4,
    name: 'violencia_domestica',
    build: (loc) =>
      `ocorrências de violência doméstica, lesão corporal, descumprimento de medidas protetivas em ${loc.name} nos últimos 2 dias, focando em prisões e detalhes de sites oficiais`,
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
 * Se multi_query desabilitado, retorna apenas o mega query (template 0).
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
