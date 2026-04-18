// ============================================
// Analytics Queries - FASE 2 (Dashboard de Risco)
// ============================================
// Queries de agregação para relatórios de criminalidade.
// Separado de queries.ts para manter organização.

import { supabase } from '../config/database';
import { logger } from '../middleware/logger';
import { CategoriaGrupo, TipoCrime } from '../utils/types';

// Raw pra montar CrimePoint no endpoint (antes do geocode).
export interface MapPointRaw {
  id: string;
  tipo_crime: TipoCrime;
  categoria: CategoriaGrupo;
  bairro: string | null;
  rua: string | null;
  data: string;
}

// Pega notícias individuais do período pra alimentar mapa (radar de pontos).
// Só ocorrências (natureza='ocorrencia'); estatísticas não vão pro mapa.
export async function getMapPointsRaw(
  cidade: string,
  dateFrom: string,
  dateTo: string,
): Promise<MapPointRaw[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, tipo_crime, categoria_grupo, bairro, rua, data_ocorrencia, natureza')
    .eq('cidade', cidade)
    .eq('active', true)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo);

  if (error) throw new Error(`Map points query failed: ${error.message}`);

  return (data || [])
    .filter((r) => (r.natureza as string) !== 'estatistica')
    .map((r) => ({
      id: r.id as string,
      tipo_crime: r.tipo_crime as TipoCrime,
      categoria: (r.categoria_grupo as CategoriaGrupo) || 'institucional',
      bairro: (r.bairro as string | null) || null,
      rua: (r.rua as string | null) || null,
      data: r.data_ocorrencia as string,
    }));
}

// Mesma ideia pra busca manual — lê dos search_results.
export async function getSearchMapPointsRaw(searchId: string): Promise<MapPointRaw[]> {
  const { data: resultRows, error } = await supabase
    .from('search_results')
    .select('results')
    .eq('search_id', searchId)
    .order('offset_num');

  if (error) throw new Error(`Search results query failed: ${error.message}`);

  const points: MapPointRaw[] = [];
  for (const row of resultRows || []) {
    const items = (row.results as Array<Record<string, unknown>> | null) || [];
    for (const r of items) {
      if ((r.natureza as string) === 'estatistica') continue;
      points.push({
        id: (r.id as string) || (r.url as string) || `${points.length}`,
        tipo_crime: r.tipo_crime as TipoCrime,
        categoria: (r.categoria_grupo as CategoriaGrupo) || 'institucional',
        bairro: (r.bairro as string | null) || null,
        rua: (r.rua as string | null) || null,
        data: r.data_ocorrencia as string,
      });
    }
  }
  return points;
}

// ============================================
// Crime Summary
// ============================================

interface CrimeSummaryResult {
  totalCrimes: number;
  byCrimeType: Array<{ tipo_crime: string; count: number; percentage: number }>;
  byCategory: Array<{ category: string; count: number; percentage: number }>;
  topBairros: Array<{ bairro: string; count: number }>;
  estatisticas: Array<{ resumo: string; data_ocorrencia: string; created_at: string; source_url: string | null }>;
}

export async function getCrimeSummary(
  cidade: string,
  dateFrom: string,
  dateTo: string
): Promise<CrimeSummaryResult> {
  const { data, error } = await supabase
    .from('news')
    .select('tipo_crime, categoria_grupo, bairro, natureza, resumo, data_ocorrencia, created_at, news_sources(url)')
    .eq('cidade', cidade)
    .eq('active', true)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo);

  if (error) throw new Error(`Crime summary query failed: ${error.message}`);

  const rows = data || [];

  const typeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const bairroMap = new Map<string, number>();
  const estatisticas: Array<{ resumo: string; data_ocorrencia: string; created_at: string; source_url: string | null }> = [];
  let totalOcorrencias = 0;

  for (const row of rows) {
    // Estatisticas sao contabilizadas a parte (nao inflar totalCrimes/bairros/tipos de ocorrencias)
    if ((row.natureza as string) === 'estatistica') {
      const sources = (row.news_sources as Array<{ url: string }>) || [];
      const firstSource = sources.length > 0 ? sources[0].url : null;
      estatisticas.push({
        resumo: row.resumo as string,
        data_ocorrencia: row.data_ocorrencia as string,
        created_at: row.created_at as string,
        source_url: firstSource,
      });
      continue;
    }

    totalOcorrencias++;

    const tipo = row.tipo_crime as string;
    typeMap.set(tipo, (typeMap.get(tipo) || 0) + 1);

    // Usa categoria_grupo da tabela (fonte unica). Fallback so pra noticias antigas sem coluna populada.
    const cat = (row.categoria_grupo as string | null) || 'institucional';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);

    const bairro = row.bairro as string | null;
    if (bairro) {
      bairroMap.set(bairro, (bairroMap.get(bairro) || 0) + 1);
    }
  }

  const byCrimeType = Array.from(typeMap.entries())
    .map(([tipo_crime, count]) => ({
      tipo_crime,
      count,
      percentage: totalOcorrencias > 0 ? Math.round((count / totalOcorrencias) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: totalOcorrencias > 0 ? Math.round((count / totalOcorrencias) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topBairros = Array.from(bairroMap.entries())
    .map(([bairro, count]) => ({ bairro, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalCrimes: totalOcorrencias,
    byCrimeType,
    byCategory,
    topBairros,
    estatisticas: estatisticas.slice(0, 10),
  };
}

// ============================================
// Crime Trend (time series)
// ============================================

interface TrendDataPoint {
  period: string;
  label: string;
  total: number;
  breakdown: Record<string, number>;
}

export async function getCrimeTrend(
  cidade: string,
  dateFrom: string,
  dateTo: string,
  groupBy: 'day' | 'week' | 'month' = 'week'
): Promise<{ dataPoints: TrendDataPoint[] }> {
  const { data, error } = await supabase
    .from('news')
    .select('tipo_crime, data_ocorrencia')
    .eq('cidade', cidade)
    .eq('active', true)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo)
    .order('data_ocorrencia', { ascending: true });

  if (error) throw new Error(`Crime trend query failed: ${error.message}`);

  const rows = data || [];
  const periodMap = new Map<string, { total: number; breakdown: Record<string, number>; label: string }>();

  for (const row of rows) {
    const date = new Date(row.data_ocorrencia as string);
    const { key, label } = getPeriodKey(date, groupBy);
    const tipo = row.tipo_crime as string;

    if (!periodMap.has(key)) {
      periodMap.set(key, { total: 0, breakdown: {}, label });
    }

    const period = periodMap.get(key)!;
    period.total++;
    period.breakdown[tipo] = (period.breakdown[tipo] || 0) + 1;
  }

  const dataPoints = Array.from(periodMap.entries())
    .map(([period, data]) => ({
      period,
      label: data.label,
      total: data.total,
      breakdown: data.breakdown,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  return { dataPoints };
}

function getPeriodKey(date: Date, groupBy: 'day' | 'week' | 'month'): { key: string; label: string } {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  switch (groupBy) {
    case 'day':
      return { key: `${yyyy}-${mm}-${dd}`, label: `${dd}/${mm}` };
    case 'week': {
      // ISO week calculation
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return {
        key: `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`,
        label: `Sem ${weekNo}`,
      };
    }
    case 'month':
      return { key: `${yyyy}-${mm}`, label: `${mm}/${yyyy}` };
  }
}

// ============================================
// Search Results Analytics (from manual search)
// ============================================

interface SearchReportData {
  searchParams: Record<string, unknown>;
  totalResults: number;
  byCrimeType: Array<{ tipo_crime: string; count: number; percentage: number }>;
  byCategory: Array<{ category: string; count: number; percentage: number }>;
  topBairros: Array<{ bairro: string; count: number }>;
  byDate: Array<{ date: string; count: number }>;
  sources: Array<{ url: string; name: string; type: 'oficial' | 'midia' }>;
  estatisticas: Array<{ resumo: string; data_ocorrencia: string; source_url: string | null }>;
  results: Array<Record<string, unknown>>;
}

export async function getSearchResultsAnalytics(searchId: string): Promise<SearchReportData> {
  // Get search cache for params
  const { data: cache, error: cacheErr } = await supabase
    .from('search_cache')
    .select('params, total_results')
    .eq('search_id', searchId)
    .single();

  if (cacheErr || !cache) throw new Error(`Search cache not found: ${searchId}`);

  // Get results
  const { data: resultRows, error: resErr } = await supabase
    .from('search_results')
    .select('results')
    .eq('search_id', searchId)
    .order('offset_num');

  if (resErr) throw new Error(`Search results query failed: ${resErr.message}`);

  // Flatten all results from all offsets
  const allResults: Array<Record<string, unknown>> = [];
  for (const row of resultRows || []) {
    const items = row.results as Array<Record<string, unknown>> | null;
    if (items) allResults.push(...items);
  }

  // Aggregate (estatisticas nao entram nos totais de ocorrencia — sao indicadores separados)
  const typeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const bairroMap = new Map<string, number>();
  const dateMap = new Map<string, number>();
  const sources: Array<{ url: string; name: string; type: 'oficial' | 'midia' }> = [];
  const estatisticas: Array<{ resumo: string; data_ocorrencia: string; source_url: string | null }> = [];
  let totalOcorrencias = 0;

  for (const r of allResults) {
    // Sources contam sempre (inclusive das estatisticas, que tambem tem fonte)
    const url = r.source_url as string | null;
    if (url) {
      const hostname = extractDomain(url);
      const sourceType = (r.source_type as string) === 'ssp' || isOfficialSource(url) ? 'oficial' as const : 'midia' as const;
      sources.push({ url, name: hostname, type: sourceType });
    }

    // Estatisticas: não entram em ocorrência; são coletadas separadas pro Executive + seção própria
    if ((r.natureza as string) === 'estatistica') {
      estatisticas.push({
        resumo: (r.resumo as string) || '',
        data_ocorrencia: (r.data_ocorrencia as string) || '',
        source_url: (r.source_url as string | null) ?? null,
      });
      continue;
    }

    totalOcorrencias++;

    const tipo = r.tipo_crime as string;
    if (tipo) typeMap.set(tipo, (typeMap.get(tipo) || 0) + 1);

    // Categoria (fonte única: categoria_grupo populado pelo pipeline; fallback institucional)
    const cat = (r.categoria_grupo as string | null) || 'institucional';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);

    const bairro = r.bairro as string | null;
    if (bairro) bairroMap.set(bairro, (bairroMap.get(bairro) || 0) + 1);

    const date = r.data_ocorrencia as string | null;
    if (date) dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }

  const total = totalOcorrencias;

  return {
    searchParams: cache.params as Record<string, unknown>,
    totalResults: total,
    byCrimeType: Array.from(typeMap.entries())
      .map(([tipo_crime, count]) => ({
        tipo_crime,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
    byCategory: Array.from(categoryMap.entries())
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count),
    topBairros: Array.from(bairroMap.entries())
      .map(([bairro, count]) => ({ bairro, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    byDate: Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    sources: deduplicateSources(sources),
    estatisticas: estatisticas.slice(0, 20),
    results: allResults,
  };
}

/**
 * Classifica uma fonte como oficial (SSP/gov) ou midia jornalistica.
 */
export function isOfficialSource(url: string): boolean {
  return /\.gov\.br|\.ssp\.|\.seguranca\.|\.sesp\.|\.sspds\.|\.sejusp\.|\.segup\./i.test(url);
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function deduplicateSources<T extends { url: string }>(sources: T[]): T[] {
  const seen = new Set<string>();
  return sources.filter(s => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

// ============================================
// News Sources Aggregation
// ============================================

export async function getNewsSources(
  cidade: string,
  dateFrom: string,
  dateTo: string
): Promise<Array<{ name: string; count: number; urls: string[]; type: 'oficial' | 'midia' }>> {
  // Get news IDs for this city/period
  const { data: newsRows, error: newsErr } = await supabase
    .from('news')
    .select('id')
    .eq('cidade', cidade)
    .eq('active', true)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo);

  if (newsErr) throw new Error(`News sources query failed: ${newsErr.message}`);
  if (!newsRows || newsRows.length === 0) return [];

  const newsIds = newsRows.map(r => r.id);

  // Get sources for these news
  const { data: sourceRows, error: srcErr } = await supabase
    .from('news_sources')
    .select('source_name, url')
    .in('news_id', newsIds);

  if (srcErr) throw new Error(`Sources query failed: ${srcErr.message}`);

  // Aggregate by source_name
  const sourceMap = new Map<string, { count: number; urls: string[] }>();
  for (const row of sourceRows || []) {
    const name = (row.source_name as string) || extractDomain(row.url as string);
    if (!sourceMap.has(name)) {
      sourceMap.set(name, { count: 0, urls: [] });
    }
    const entry = sourceMap.get(name)!;
    entry.count++;
    if (entry.urls.length < 5) {
      entry.urls.push(row.url as string);
    }
  }

  return Array.from(sourceMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      urls: data.urls,
      type: data.urls.some(u => isOfficialSource(u)) ? 'oficial' as const : 'midia' as const,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================
// Reports CRUD
// ============================================

interface CreateReportParams {
  search_id?: string;
  cidade: string;
  estado: string;
  date_from: string;
  date_to: string;
  report_data: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
}

export async function createReport(params: CreateReportParams): Promise<string> {
  const { data, error } = await supabase
    .from('reports')
    .insert({
      search_id: params.search_id || null,
      cidade: params.cidade,
      estado: params.estado,
      date_from: params.date_from,
      date_to: params.date_to,
      report_data: params.report_data,
      sources: params.sources,
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[Analytics] Create report failed:', error);
    throw new Error(`Failed to create report: ${error?.message}`);
  }

  return data.id;
}

export async function getReport(reportId: string): Promise<{
  id: string;
  cidade: string;
  estado: string;
  date_from: string;
  date_to: string;
  report_data: Record<string, unknown>;
  sources: Array<Record<string, unknown>>;
  created_at: string;
  expires_at: string;
} | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (error || !data) return null;

  // Check expiration
  if (new Date(data.expires_at) < new Date()) return null;

  return data as {
    id: string;
    cidade: string;
    estado: string;
    date_from: string;
    date_to: string;
    report_data: Record<string, unknown>;
    sources: Array<Record<string, unknown>>;
    created_at: string;
    expires_at: string;
  };
}

// ============================================
// Cities Overview (Dashboard)
// ============================================

export interface CityOverviewItem {
  id: string;
  name: string;
  type: 'city' | 'group';
  parentState: string | null;
  cityCount?: number;
  stateCount?: number;
  cityNames?: string[];
  totalCrimes: number;
  totalCrimes30d: number;
  trendPercent: number;
  topCrimeType: string | null;
  topCrimePercent: number;
  unreadCount: number;
  lastNewsAt: string | null;
}

export async function getCitiesOverview(userId?: string): Promise<CityOverviewItem[]> {
  const now = new Date();
  const d30ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Get all active monitored cities with parent state
  const { data: locations } = await supabase
    .from('monitored_locations')
    .select('id, name, parent_id, type')
    .eq('active', true)
    .eq('type', 'city');

  if (!locations || locations.length === 0) return [];

  // Get state names for parent_id mapping
  const { data: states } = await supabase
    .from('monitored_locations')
    .select('id, name')
    .eq('type', 'state');

  const stateMap = new Map<string, string>();
  for (const s of states || []) stateMap.set(s.id, s.name);

  const cityNames = locations.map((l) => l.name);

  // 2. Count ALL news per city (total acumulado)
  const { data: newsAll } = await supabase
    .from('news')
    .select('cidade, tipo_crime, created_at')
    .eq('active', true)
    .in('cidade', cityNames);

  // 3. Count news per city (last 30 days, for recent stats)
  const { data: news30d } = await supabase
    .from('news')
    .select('cidade')
    .eq('active', true)
    .gte('data_ocorrencia', d30ago)
    .in('cidade', cityNames);

  // 4. Unread count per city (user-specific)
  let readIds = new Set<string>();
  if (userId) {
    const { data: readItems } = await supabase
      .from('user_news_read')
      .select('news_id')
      .eq('user_id', userId);
    readIds = new Set((readItems || []).map((r: { news_id: string }) => r.news_id));
  }

  // 5. Get all news IDs from last 30d for unread calculation
  const { data: recentNewsIds } = await supabase
    .from('news')
    .select('id, cidade')
    .eq('active', true)
    .gte('data_ocorrencia', d30ago)
    .in('cidade', cityNames);

  // Aggregate per city
  const cityStats = new Map<string, {
    countTotal: number;
    count30d: number;
    crimeTypes: Map<string, number>;
    unread: number;
    lastNewsAt: string | null;
  }>();

  // Initialize
  for (const loc of locations) {
    cityStats.set(loc.name, {
      countTotal: 0,
      count30d: 0,
      crimeTypes: new Map(),
      unread: 0,
      lastNewsAt: null,
    });
  }

  // Count ALL news + crime types + last news (total acumulado)
  for (const n of newsAll || []) {
    const s = cityStats.get(n.cidade);
    if (!s) continue;
    s.countTotal++;
    s.crimeTypes.set(n.tipo_crime, (s.crimeTypes.get(n.tipo_crime) || 0) + 1);
    if (!s.lastNewsAt || n.created_at > s.lastNewsAt) {
      s.lastNewsAt = n.created_at;
    }
  }

  // Count last 30d (for recent reference)
  for (const n of news30d || []) {
    const s = cityStats.get(n.cidade);
    if (s) s.count30d++;
  }

  // Count unread
  for (const n of recentNewsIds || []) {
    const s = cityStats.get(n.cidade);
    if (s && !readIds.has(n.id)) s.unread++;
  }

  // Build city items
  const items: CityOverviewItem[] = locations.map((loc) => {
    const s = cityStats.get(loc.name)!;
    const trend = 0; // trend removed — will be in overview detail

    let topCrime: string | null = null;
    let topCrimeCount = 0;
    for (const [type, count] of s.crimeTypes) {
      if (count > topCrimeCount) {
        topCrime = type;
        topCrimeCount = count;
      }
    }

    return {
      id: loc.id,
      name: loc.name,
      type: 'city' as const,
      parentState: stateMap.get(loc.parent_id) || null,
      totalCrimes: s.countTotal,
      totalCrimes30d: s.count30d,
      trendPercent: parseFloat(trend.toFixed(1)),
      topCrimeType: topCrime,
      topCrimePercent: s.countTotal > 0 ? parseFloat(((topCrimeCount / s.countTotal) * 100).toFixed(1)) : 0,
      unreadCount: s.unread,
      lastNewsAt: s.lastNewsAt,
    };
  });

  // 6. Build group aggregates
  const { data: groups } = await supabase
    .from('city_groups')
    .select('id, name, active')
    .eq('active', true);

  if (groups && groups.length > 0) {
    const { data: members } = await supabase
      .from('city_group_members')
      .select('group_id, monitored_locations(name, parent_id)');

    const membersByGroup = new Map<string, string[]>();
    const statesByGroup = new Map<string, Set<string>>();
    for (const m of members || []) {
      const loc = m.monitored_locations as unknown as { name: string; parent_id: string | null } | null;
      if (!loc) continue;
      const list = membersByGroup.get(m.group_id) || [];
      list.push(loc.name);
      membersByGroup.set(m.group_id, list);

      if (loc.parent_id) {
        const stateName = stateMap.get(loc.parent_id);
        if (stateName) {
          const set = statesByGroup.get(m.group_id) || new Set<string>();
          set.add(stateName);
          statesByGroup.set(m.group_id, set);
        }
      }
    }

    for (const g of groups) {
      const groupCities = membersByGroup.get(g.id) || [];
      if (groupCities.length === 0) continue;

      let totalAll = 0, total30d = 0, unread = 0;
      let lastAt: string | null = null;
      const crimeAgg = new Map<string, number>();

      for (const cn of groupCities) {
        const s = cityStats.get(cn);
        if (!s) continue;
        totalAll += s.countTotal;
        total30d += s.count30d;
        unread += s.unread;
        if (s.lastNewsAt && (!lastAt || s.lastNewsAt > lastAt)) lastAt = s.lastNewsAt;
        for (const [type, count] of s.crimeTypes) {
          crimeAgg.set(type, (crimeAgg.get(type) || 0) + count);
        }
      }

      let topCrime: string | null = null;
      let topCount = 0;
      for (const [type, count] of crimeAgg) {
        if (count > topCount) { topCrime = type; topCount = count; }
      }

      const trend = total30d > 0 ? 0 : 0; // trend removed for now

      const groupStates = statesByGroup.get(g.id) || new Set<string>();
      const groupStateList = Array.from(groupStates);
      const groupParentState = groupStateList.length === 1 ? groupStateList[0] : null;

      items.push({
        id: g.id,
        name: g.name,
        type: 'group',
        parentState: groupParentState,
        cityCount: groupCities.length,
        stateCount: groupStateList.length,
        cityNames: groupCities,
        totalCrimes: totalAll,
        totalCrimes30d: total30d,
        trendPercent: parseFloat(trend.toFixed(1)),
        topCrimeType: topCrime,
        topCrimePercent: totalAll > 0 ? parseFloat(((topCount / totalAll) * 100).toFixed(1)) : 0,
        unreadCount: unread,
        lastNewsAt: lastAt,
      });
    }
  }

  // Remove individual cities that belong to a group (avoid duplicates)
  const citiesInGroups = new Set<string>();
  for (const item of items) {
    if (item.type === 'group' && item.cityNames) {
      for (const cn of item.cityNames) citiesInGroups.add(cn);
    }
  }
  const filtered = items.filter(
    (item) => item.type === 'group' || !citiesInGroups.has(item.name)
  );

  // Sort: groups first, then by unread desc, then by totalCrimes desc
  filtered.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'group' ? -1 : 1;
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    return b.totalCrimes30d - a.totalCrimes30d;
  });

  return filtered;
}
