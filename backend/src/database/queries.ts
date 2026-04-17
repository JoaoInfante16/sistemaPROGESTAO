import { supabase } from '../config/database';
import { MonitoredLocation } from '../utils/types';
import { logger } from '../middleware/logger';

// ============================================
// Locations
// ============================================

export async function getLocation(locationId: string): Promise<MonitoredLocation> {
  const { data, error } = await supabase
    .from('monitored_locations')
    .select('*')
    .eq('id', locationId)
    .single();

  if (error || !data) {
    throw new Error(`Location not found: ${locationId}`);
  }
  return data as MonitoredLocation;
}

export async function getActiveLocations(): Promise<MonitoredLocation[]> {
  const { data, error } = await supabase
    .from('monitored_locations')
    .select('*')
    .eq('active', true);

  if (error) {
    throw new Error(`Failed to fetch active locations: ${error.message}`);
  }
  return (data || []) as MonitoredLocation[];
}

export async function updateLocationLastCheck(locationId: string, timestamp: Date): Promise<void> {
  const { error } = await supabase
    .from('monitored_locations')
    .update({ last_check: timestamp.toISOString() })
    .eq('id', locationId);

  if (error) {
    throw new Error(`Failed to update last_check: ${error.message}`);
  }
}

// ============================================
// News
// ============================================

interface InsertNewsParams {
  tipo_crime: string;
  natureza?: string;
  categoria_grupo?: string | null;
  cidade: string;
  estado?: string | null;
  bairro?: string;
  rua?: string;
  data_ocorrencia: string;
  resumo: string;
  embedding: number[];
  confianca: number;
}

export async function insertNews(params: InsertNewsParams): Promise<string> {
  const { data, error } = await supabase
    .from('news')
    .insert({
      tipo_crime: params.tipo_crime,
      natureza: params.natureza || 'ocorrencia',
      categoria_grupo: params.categoria_grupo || null,
      cidade: params.cidade,
      estado: params.estado || null,
      bairro: params.bairro || null,
      rua: params.rua || null,
      data_ocorrencia: params.data_ocorrencia,
      resumo: params.resumo,
      embedding: `[${params.embedding.join(',')}]`,
      confianca: params.confianca,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to insert news: ${error?.message}`);
  }
  return data.id as string;
}

export async function insertNewsSource(newsId: string, url: string, sourceName?: string): Promise<void> {
  const { error } = await supabase
    .from('news_sources')
    .insert({
      news_id: newsId,
      url,
      source_name: sourceName || new URL(url).hostname,
    });

  if (error) {
    // URL duplicada é esperada (mesmo artigo encontrado de novo)
    if (error.code === '23505') return;
    throw new Error(`Failed to insert news source: ${error.message}`);
  }
}

// ============================================
// Deduplication - Geo-Temporal Candidates
// ============================================

export interface DedupCandidate {
  id: string;
  resumo: string;
  embedding: number[];
}

export async function findGeoTemporalCandidates(
  cidade: string,
  tipoCrime: string,
  dataOcorrencia: string,
  estado?: string | null,
  bairro?: string | null,
): Promise<DedupCandidate[]> {
  // Buscar candidatos: mesma cidade + (mesmo estado) + (mesmo bairro ou algum NULL) + mesmo tipo + ±1 dia
  // Bairro: tolerante a NULL — se ambos têm bairro e diferem, filtra. Se um for NULL, deixa passar
  // pra camadas 2/3 decidirem (evita falso negativo de eventos com bairro ausente).
  const date = new Date(dataOcorrencia);
  const dateFrom = new Date(date.getTime() - 86400000).toISOString().split('T')[0];
  const dateTo = new Date(date.getTime() + 86400000).toISOString().split('T')[0];

  let query = supabase
    .from('news')
    .select('id, resumo, embedding')
    .eq('cidade', cidade)
    .eq('tipo_crime', tipoCrime)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo)
    .eq('active', true)
    .limit(200);

  if (estado) {
    query = query.eq('estado', estado);
  }

  if (bairro && bairro.trim().length > 0) {
    // Aceita: mesmo bairro OU bairro NULL no DB (tolerante)
    query = query.or(`bairro.eq.${bairro},bairro.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to find dedup candidates: ${error.message}`);
  }

  // pgvector retorna embedding como string "[0.1,0.2,...]" — parsear para number[]
  return (data || []).map((row: any) => ({
    ...row,
    embedding: typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding,
  })) as DedupCandidate[];
}

// ============================================
// Operation Logs
// ============================================

interface InsertLogParams {
  location_id: string;
  stage: string;
  urls_processed: number;
  news_found: number;
  cost_usd: number;
  duration_ms: number;
}

export async function insertOperationLog(params: InsertLogParams): Promise<void> {
  const { error } = await supabase
    .from('operation_logs')
    .insert(params);

  if (error) {
    // Log failure shouldn't break the pipeline
    logger.error('Failed to insert operation log:', error.message);
  }
}

// ============================================
// Budget Tracking
// ============================================

interface TrackCostParams {
  source: 'auto_scan' | 'manual_search';
  provider: 'google' | 'perplexity' | 'brave' | 'brightdata' | 'jina' | 'openai';
  cost_usd: number;
  details?: Record<string, unknown>;
}

export async function trackCost(params: TrackCostParams): Promise<void> {
  const { error } = await supabase
    .from('budget_tracking')
    .insert(params);

  if (error) {
    logger.error('Failed to track cost:', error.message);
  }
}

export async function getCurrentMonthCost(): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('budget_tracking')
    .select('cost_usd')
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    logger.error('Failed to get monthly cost:', error.message);
    return 0; // Safe: assume 0 on error (don't block pipeline)
  }

  return (data || []).reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

// ============================================
// News Feed (mobile app)
// ============================================

interface NewsFeedParams {
  cidade?: string;
  cidades?: string[];
  estado?: string;
  offset: number;
  limit: number;
}

interface NewsFeedItem {
  id: string;
  tipo_crime: string;
  cidade: string;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  data_ocorrencia: string;
  resumo: string;
  confianca: number;
  created_at: string;
  news_sources: Array<{ url: string; source_name: string | null }>;
}

export async function getNewsFeed(params: NewsFeedParams): Promise<{ news: NewsFeedItem[]; hasMore: boolean }> {
  let query = supabase
    .from('news')
    .select('id, tipo_crime, natureza, cidade, estado, bairro, rua, data_ocorrencia, resumo, confianca, created_at, news_sources(url, source_name)')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.cidades && params.cidades.length > 0) {
    query = query.in('cidade', params.cidades);
  } else if (params.cidade) {
    query = query.eq('cidade', params.cidade);
  }
  if (params.estado) {
    query = query.eq('estado', params.estado);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch news feed: ${error.message}`);
  }

  const news = (data || []) as unknown as NewsFeedItem[];
  return { news, hasMore: news.length === params.limit };
}

// ============================================
// Search News (busca manual)
// ============================================

interface SearchNewsParams {
  query: string;
  cidade?: string;
  estado?: string;
  tipoCrime?: string;
  dateFrom?: string;
  dateTo?: string;
  offset: number;
  limit: number;
}

export async function searchNews(params: SearchNewsParams): Promise<{ news: NewsFeedItem[]; hasMore: boolean }> {
  let query = supabase
    .from('news')
    .select('id, tipo_crime, natureza, cidade, estado, bairro, rua, data_ocorrencia, resumo, confianca, created_at, news_sources(url, source_name)')
    .eq('active', true)
    .ilike('resumo', `%${params.query}%`)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.cidade) {
    query = query.eq('cidade', params.cidade);
  }
  if (params.estado) {
    query = query.eq('estado', params.estado);
  }
  if (params.tipoCrime) {
    query = query.ilike('tipo_crime', params.tipoCrime);
  }
  if (params.dateFrom) {
    query = query.gte('data_ocorrencia', params.dateFrom);
  }
  if (params.dateTo) {
    query = query.lte('data_ocorrencia', params.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to search news: ${error.message}`);
  }

  const news = (data || []) as unknown as NewsFeedItem[];
  return { news, hasMore: news.length === params.limit };
}

// ============================================
// City → UF mapping (para badges no feed)
// ============================================

const STATE_NAME_TO_UF: Record<string, string> = {
  'Acre': 'AC', 'Alagoas': 'AL', 'Amapa': 'AP', 'Amazonas': 'AM',
  'Bahia': 'BA', 'Ceara': 'CE', 'Distrito Federal': 'DF', 'Espirito Santo': 'ES',
  'Goias': 'GO', 'Maranhao': 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', 'Para': 'PA', 'Paraiba': 'PB', 'Parana': 'PR',
  'Pernambuco': 'PE', 'Piaui': 'PI', 'Rio de Janeiro': 'RJ', 'Rio Grande do Norte': 'RN',
  'Rio Grande do Sul': 'RS', 'Rondonia': 'RO', 'Roraima': 'RR', 'Santa Catarina': 'SC',
  'Sao Paulo': 'SP', 'Sergipe': 'SE', 'Tocantins': 'TO',
};

function stateNameToUF(name: string): string | null {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return STATE_NAME_TO_UF[normalized] || null;
}

export async function getCityToUFMap(): Promise<Map<string, string>> {
  const { data: states } = await supabase
    .from('monitored_locations')
    .select('id, name')
    .eq('type', 'state');

  const { data: cities } = await supabase
    .from('monitored_locations')
    .select('name, parent_id')
    .eq('type', 'city');

  const stateIdToUF = new Map<string, string>();
  for (const s of (states || []) as Array<{ id: string; name: string }>) {
    const uf = stateNameToUF(s.name);
    if (uf) stateIdToUF.set(s.id, uf);
  }

  const cityToUF = new Map<string, string>();
  for (const c of (cities || []) as Array<{ name: string; parent_id: string }>) {
    const uf = stateIdToUF.get(c.parent_id);
    if (uf) cityToUF.set(c.name, uf);
  }

  return cityToUF;
}

// ============================================
// Locations (public - para dropdown do Flutter)
// ============================================

export async function getPublicLocationsHierarchy(): Promise<Array<{ id: string; name: string; cities: Array<{ id: string; name: string }> }>> {
  const { data: states, error: statesError } = await supabase
    .from('monitored_locations')
    .select('id, name')
    .eq('type', 'state')
    .eq('active', true)
    .order('name');

  if (statesError) {
    throw new Error(`Failed to fetch states: ${statesError.message}`);
  }

  const { data: cities, error: citiesError } = await supabase
    .from('monitored_locations')
    .select('id, name, parent_id')
    .eq('type', 'city')
    .eq('active', true)
    .order('name');

  if (citiesError) {
    throw new Error(`Failed to fetch cities: ${citiesError.message}`);
  }

  return ((states || []) as Array<{ id: string; name: string }>).map((state) => ({
    id: state.id,
    name: state.name,
    cities: ((cities || []) as Array<{ id: string; name: string; parent_id: string }>)
      .filter((c) => c.parent_id === state.id)
      .map((c) => ({ id: c.id, name: c.name })),
  }));
}

// ============================================
// Locations (admin panel - full data)
// ============================================

export async function getLocationsHierarchy(): Promise<Array<MonitoredLocation & { cities: MonitoredLocation[] }>> {
  const { data: states, error: statesError } = await supabase
    .from('monitored_locations')
    .select('*')
    .eq('type', 'state')
    .order('name');

  if (statesError) {
    throw new Error(`Failed to fetch states: ${statesError.message}`);
  }

  const { data: cities, error: citiesError } = await supabase
    .from('monitored_locations')
    .select('*')
    .eq('type', 'city')
    .order('name');

  if (citiesError) {
    throw new Error(`Failed to fetch cities: ${citiesError.message}`);
  }

  return ((states || []) as MonitoredLocation[]).map((state) => ({
    ...state,
    cities: ((cities || []) as MonitoredLocation[]).filter((c) => c.parent_id === state.id),
  }));
}

export async function bulkInsertLocations(
  stateId: string,
  cities: string[],
  mode: 'keywords' | 'any',
  scanFrequencyMinutes: number,
): Promise<void> {
  if (cities.length === 0) return;

  const rows = cities.map((name) => ({
    type: 'city' as const,
    name,
    parent_id: stateId,
    mode,
    scan_frequency_minutes: scanFrequencyMinutes,
    active: true,
  }));

  // Batch em chunks de 200
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await supabase.from('monitored_locations').insert(chunk);
    if (error) throw new Error(`Bulk insert failed: ${error.message}`);
  }
}

interface InsertLocationParams {
  type: 'state' | 'city';
  name: string;
  parent_id?: string | null;
  mode?: 'keywords' | 'any';
  keywords?: string[] | null;
  scan_frequency_minutes?: number;
}

export async function insertLocation(params: InsertLocationParams): Promise<MonitoredLocation> {
  const { data, error } = await supabase
    .from('monitored_locations')
    .insert({
      type: params.type,
      name: params.name,
      parent_id: params.parent_id || null,
      mode: params.mode || 'any',
      keywords: params.keywords || null,
      scan_frequency_minutes: params.scan_frequency_minutes || 60,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to insert location: ${error.message}`);
  }

  return data as MonitoredLocation;
}

interface UpdateLocationParams {
  active?: boolean;
  mode?: 'keywords' | 'any';
  keywords?: string[] | null;
  scan_frequency_minutes?: number;
}

export async function updateLocation(id: string, updates: UpdateLocationParams): Promise<void> {
  const { error } = await supabase
    .from('monitored_locations')
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update location: ${error.message}`);
  }
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase
    .from('monitored_locations')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete location: ${error.message}`);
  }
}

// ============================================
// Users (admin panel)
// ============================================

interface UserWithProfile {
  id: string;
  email: string;
  is_admin: boolean;
  active: boolean;
  must_change_password: boolean;
  password_reset_requested: boolean;
  created_at: string;
}

export async function getAllUsers(): Promise<UserWithProfile[]> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  return (data || []) as UserWithProfile[];
}

export async function createUserProfile(
  userId: string,
  email: string,
  createdBy: string,
  isAdmin = false
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .insert({
      id: userId,
      email,
      is_admin: isAdmin,
      created_by: createdBy,
      must_change_password: true,
    });

  if (error) {
    throw new Error(`Failed to create user profile: ${error.message}`);
  }
}

export async function updateUserProfile(
  id: string,
  updates: { active?: boolean; must_change_password?: boolean; password_reset_requested?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}

export async function deleteUserProfile(id: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete user profile: ${error.message}`);
  }
}

// ============================================
// Dashboard Stats (admin panel)
// ============================================

interface DashboardStats {
  newsThisMonth: number;
  activeCities: number;
  costThisMonth: number;
  pipelineSuccessRate: number;
  scansToday: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const { count: newsCount } = await supabase
    .from('news')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${currentMonth}-01`);

  const { count: cityCount } = await supabase
    .from('monitored_locations')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'city')
    .eq('active', true);

  const { data: budgetData } = await supabase
    .from('budget_tracking')
    .select('cost_usd')
    .gte('created_at', `${currentMonth}-01`);

  const totalCost = (budgetData || []).reduce(
    (sum, b) => sum + parseFloat(String(b.cost_usd)),
    0
  );

  const { data: logs } = await supabase
    .from('operation_logs')
    .select('stage')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const totalLogs = (logs || []).length;
  const completedLogs = (logs || []).filter((l) => l.stage === 'complete').length;
  const successRate = totalLogs > 0 ? Math.round((completedLogs / totalLogs) * 100) : 100;

  const today = new Date().toISOString().slice(0, 10);
  const { count: scansCount } = await supabase
    .from('operation_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`);

  return {
    newsThisMonth: newsCount || 0,
    activeCities: cityCount || 0,
    costThisMonth: parseFloat(totalCost.toFixed(4)),
    pipelineSuccessRate: successRate,
    scansToday: scansCount || 0,
  };
}

// ============================================
// Operation Logs (admin panel)
// ============================================

export async function getRecentLogs(limit: number = 50): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await supabase
    .from('operation_logs')
    .select('*, monitored_locations(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }

  return (data || []) as Array<Record<string, unknown>>;
}

// ============================================
// Rejected URLs (dashboard)
// ============================================

export interface RejectedUrl {
  url: string;
  title?: string;
  stage: string;
  reason?: string;
  location_id: string;
}

export async function insertRejectedUrls(urls: RejectedUrl[]): Promise<void> {
  if (urls.length === 0) return;

  const { error } = await supabase
    .from('pipeline_rejected_urls')
    .insert(urls);

  if (error) {
    logger.error('Failed to insert rejected URLs:', error.message);
  }
}

export async function getRecentRejectedUrls(hours: number = 24): Promise<Array<Record<string, unknown>>> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('pipeline_rejected_urls')
    .select('url, title, stage, reason, location_id, created_at, monitored_locations(name)')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`Failed to fetch rejected URLs: ${error.message}`);
  }

  return (data || []) as Array<Record<string, unknown>>;
}

export async function cleanupOldRejectedUrls(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('pipeline_rejected_urls')
    .delete()
    .lt('created_at', cutoff);

  if (error) {
    logger.error('Failed to cleanup rejected URLs:', error.message);
  }
}

export async function clearRejectedUrls(): Promise<void> {
  const { error } = await supabase
    .from('pipeline_rejected_urls')
    .delete()
    .gte('created_at', '2000-01-01');

  if (error) {
    throw new Error(`Failed to clear rejected URLs: ${error.message}`);
  }
}

// ============================================
// Devices (push notifications)
// ============================================

export async function upsertDevice(
  userId: string,
  token: string,
  platform: 'ios' | 'android'
): Promise<void> {
  // Remover tokens antigos deste user (token pode mudar com novo Firebase project)
  await supabase
    .from('user_devices')
    .delete()
    .eq('user_id', userId)
    .neq('device_token', token);

  const { error } = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: userId,
        device_token: token,
        platform,
        last_seen: new Date().toISOString(),
      },
      { onConflict: 'device_token' }
    );

  if (error) {
    throw new Error(`Failed to upsert device: ${error.message}`);
  }
}

export async function removeUserDevices(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_devices')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to remove devices: ${error.message}`);
  }
}

// Namespace export para usar como db.getLocation(), db.insertNews(), etc.
// ============================================
// User Feed (with read/favorite status)
// ============================================

export async function getUserNewsFeed(userId: string, params: { offset: number; limit: number; cidade?: string; cidades?: string[]; estado?: string }) {
  let query = supabase
    .from('news')
    .select('id, tipo_crime, natureza, cidade, estado, bairro, rua, data_ocorrencia, resumo, resumo_agregado, confianca, created_at, news_sources(url, source_name)')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (params.cidades && params.cidades.length > 0) {
    query = query.in('cidade', params.cidades);
  } else if (params.cidade) {
    query = query.eq('cidade', params.cidade);
  }
  if (params.estado) {
    query = query.eq('estado', params.estado);
  }

  const { data: news, error } = await query;
  if (error) throw new Error(`Failed to fetch user feed: ${error.message}`);

  const newsIds = (news || []).map((n: { id: string }) => n.id);
  if (newsIds.length === 0) return { news: [], hasMore: false };

  // Get read status
  const { data: readItems } = await supabase
    .from('user_news_read')
    .select('news_id')
    .eq('user_id', userId)
    .in('news_id', newsIds);

  const readSet = new Set((readItems || []).map((r: { news_id: string }) => r.news_id));

  // Get favorite status
  const { data: favItems } = await supabase
    .from('user_favorites')
    .select('news_id')
    .eq('user_id', userId)
    .in('news_id', newsIds);

  const favSet = new Set((favItems || []).map((f: { news_id: string }) => f.news_id));

  const items = (news || []) as unknown as NewsFeedItem[];
  const enriched = items.map((n) => ({
    ...n,
    is_unread: !readSet.has(n.id),
    is_favorite: favSet.has(n.id),
  }));

  return { news: enriched, hasMore: items.length === params.limit };
}

export async function markAsRead(userId: string, newsId: string) {
  await supabase
    .from('user_news_read')
    .upsert({ user_id: userId, news_id: newsId }, { onConflict: 'user_id,news_id' });
}

export async function markAllAsRead(userId: string) {
  // Pega todos os news IDs que o user ainda não leu
  const { data: allNews } = await supabase
    .from('news')
    .select('id');

  const { data: readNews } = await supabase
    .from('user_news_read')
    .select('news_id')
    .eq('user_id', userId);

  const readSet = new Set((readNews || []).map((r: { news_id: string }) => r.news_id));
  const unread = (allNews || []).filter((n: { id: string }) => !readSet.has(n.id));

  if (unread.length === 0) return 0;

  const rows = unread.map((n: { id: string }) => ({ user_id: userId, news_id: n.id }));
  await supabase
    .from('user_news_read')
    .upsert(rows, { onConflict: 'user_id,news_id' });

  return unread.length;
}

export async function addFavorite(userId: string, newsId: string) {
  await supabase
    .from('user_favorites')
    .upsert({ user_id: userId, news_id: newsId }, { onConflict: 'user_id,news_id' });
}

export async function removeFavorite(userId: string, newsId: string) {
  await supabase
    .from('user_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('news_id', newsId);
}

export async function getUnreadCount(userId: string): Promise<number> {
  // Step 1: Get IDs of news the user has already read
  const { data: readItems } = await supabase
    .from('user_news_read')
    .select('news_id')
    .eq('user_id', userId);

  const readIds = (readItems || []).map((r: { news_id: string }) => r.news_id);

  // Step 2: Count active news excluding read ones
  let query = supabase
    .from('news')
    .select('id', { count: 'exact', head: true })
    .eq('active', true);

  if (readIds.length > 0) {
    query = query.not('id', 'in', `(${readIds.join(',')})`);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count || 0;
}

// ============================================
// Billing History
// ============================================

export interface BillingRecord {
  id: string;
  month: string;
  total_cost_usd: number;
  total_scans: number;
  breakdown: Record<string, number>;
  closed_at: string;
}

export async function getBillingHistory(limit = 12): Promise<BillingRecord[]> {
  const { data, error } = await supabase
    .from('billing_history')
    .select('*')
    .order('month', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error(`[Billing] Failed to fetch history: ${error.message}`);
    return [];
  }

  return data || [];
}

export async function getUserFavorites(userId: string, params: { offset: number; limit: number }) {
  const { data: favIds, error: favError } = await supabase
    .from('user_favorites')
    .select('news_id')
    .eq('user_id', userId)
    .order('favorited_at', { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);

  if (favError || !favIds || favIds.length === 0) return { news: [], hasMore: false };

  const ids = favIds.map((f: { news_id: string }) => f.news_id);

  const { data: news, error } = await supabase
    .from('news')
    .select('id, tipo_crime, natureza, cidade, bairro, rua, data_ocorrencia, resumo, resumo_agregado, confianca, created_at, news_sources(url, source_name)')
    .in('id', ids);

  if (error) throw new Error(`Failed to fetch favorites: ${error.message}`);

  const enriched = (news || []).map((n: { id: string }) => ({
    ...n,
    is_unread: false,
    is_favorite: true,
  }));

  return { news: enriched, hasMore: favIds.length === params.limit };
}

// ============================================
// Manual Search (search_cache + search_results)
// ============================================

interface CreateSearchCacheParams {
  user_id: string;
  params: Record<string, unknown>;
}

export async function createSearchCache(p: CreateSearchCacheParams): Promise<string> {
  const paramsHash = JSON.stringify(p.params);

  // Tentar inserir
  const { data, error } = await supabase
    .from('search_cache')
    .insert({
      user_id: p.user_id,
      params: p.params,
      params_hash: paramsHash,
      status: 'processing',
    })
    .select('search_id')
    .single();

  if (error && error.message.includes('duplicate key')) {
    // Busca com mesmos params já existe — deletar antiga e recriar
    await supabase
      .from('search_cache')
      .delete()
      .eq('params_hash', paramsHash);

    const { data: retryData, error: retryError } = await supabase
      .from('search_cache')
      .insert({
        user_id: p.user_id,
        params: p.params,
        params_hash: paramsHash,
        status: 'processing',
      })
      .select('search_id')
      .single();

    if (retryError) throw new Error(`Failed to create search cache: ${retryError.message}`);
    return (retryData as { search_id: string }).search_id;
  }

  if (error) throw new Error(`Failed to create search cache: ${error.message}`);
  return (data as { search_id: string }).search_id;
}

export async function updateSearchStatus(
  searchId: string,
  status: 'completed' | 'failed' | 'cancelled',
  totalResults?: number
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (totalResults !== undefined) update.total_results = totalResults;
  const { error } = await supabase
    .from('search_cache')
    .update(update)
    .eq('search_id', searchId);

  if (error) throw new Error(`Failed to update search status: ${error.message}`);
}

export async function insertSearchResults(
  searchId: string,
  results: unknown[],
  offsetNum: number
): Promise<void> {
  const { error } = await supabase
    .from('search_results')
    .insert({
      search_id: searchId,
      offset_num: offsetNum,
      results,
    });

  if (error) throw new Error(`Failed to insert search results: ${error.message}`);
}

export async function updateSearchProgress(
  searchId: string,
  progress: { stage: string; stage_num: number; total_stages: number; details?: string }
): Promise<void> {
  const { error } = await supabase
    .from('search_cache')
    .update({ progress })
    .eq('search_id', searchId);

  // Non-fatal: progress update failure should never abort the pipeline
  if (error) logger.warn(`[SearchProgress] Failed to update: ${error.message}`);
}

export async function getSearchStatus(searchId: string): Promise<{
  status: string;
  total_results: number | null;
  progress: Record<string, unknown> | null;
  params: Record<string, unknown> | null;
  report_id: string | null;
}> {
  const { data, error } = await supabase
    .from('search_cache')
    .select('status, total_results, progress, params')
    .eq('search_id', searchId)
    .single();

  if (error || !data) throw new Error(`Search not found: ${searchId}`);

  // Verificar se ja existe relatorio gerado pra esta busca
  const { data: reportData } = await supabase
    .from('reports')
    .select('id')
    .eq('search_id', searchId)
    .limit(1)
    .maybeSingle();

  return {
    ...(data as { status: string; total_results: number | null; progress: Record<string, unknown> | null; params: Record<string, unknown> | null }),
    report_id: (reportData?.id as string) ?? null,
  };
}

export async function getSearchResults(searchId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from('search_results')
    .select('results')
    .eq('search_id', searchId)
    .order('offset_num');

  if (error) throw new Error(`Failed to get search results: ${error.message}`);
  const allResults: unknown[] = [];
  for (const row of data || []) {
    const results = (row as { results: unknown[] }).results;
    if (Array.isArray(results)) allResults.push(...results);
  }
  return allResults;
}

export async function getUserSearchHistory(userId: string): Promise<Array<{
  search_id: string;
  params: Record<string, unknown>;
  status: string;
  total_results: number | null;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('search_cache')
    .select('search_id, params, status, total_results, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(`Failed to get search history: ${error.message}`);
  return (data || []) as Array<{
    search_id: string;
    params: Record<string, unknown>;
    status: string;
    total_results: number | null;
    created_at: string;
  }>;
}

export const db = {
  getLocation,
  getActiveLocations,
  updateLocationLastCheck,
  insertNews,
  insertNewsSource,
  findGeoTemporalCandidates,
  insertOperationLog,
  trackCost,
  getCurrentMonthCost,
  getNewsFeed,
  searchNews,
  getPublicLocationsHierarchy,
  getLocationsHierarchy,
  insertLocation,
  updateLocation,
  deleteLocation,
  getAllUsers,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  getDashboardStats,
  getRecentLogs,
  upsertDevice,
  getUserNewsFeed,
  markAsRead,
  markAllAsRead,
  addFavorite,
  removeFavorite,
  getUnreadCount,
  getUserFavorites,
  createSearchCache,
  updateSearchStatus,
  updateSearchProgress,
  insertSearchResults,
  getSearchStatus,
  getSearchResults,
  getUserSearchHistory,
  getCityToUFMap,
  bulkInsertLocations,
  insertRejectedUrls,
  getRecentRejectedUrls,
  cleanupOldRejectedUrls,
  clearRejectedUrls,
  getBillingHistory,
  // Groups
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  removeUserDevices,
};

// ============================================
// City Groups
// ============================================

export interface CityGroup {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  cities: { id: string; name: string }[];
}

export async function getGroups(): Promise<CityGroup[]> {
  const { data: groups, error } = await supabase
    .from('city_groups')
    .select('*')
    .order('name');

  if (error) {
    logger.error('[Groups] Failed to fetch:', error.message);
    return [];
  }

  const { data: members } = await supabase
    .from('city_group_members')
    .select('group_id, location_id, monitored_locations(id, name)')
    .order('created_at');

  const membersByGroup = new Map<string, { id: string; name: string }[]>();
  for (const m of members || []) {
    const loc = m.monitored_locations as unknown as { id: string; name: string } | null;
    if (!loc) continue;
    const list = membersByGroup.get(m.group_id) || [];
    list.push({ id: loc.id, name: loc.name });
    membersByGroup.set(m.group_id, list);
  }

  return (groups || []).map((g) => ({
    ...g,
    cities: membersByGroup.get(g.id) || [],
  }));
}

export async function getGroupMembers(groupId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('city_group_members')
    .select('location_id')
    .eq('group_id', groupId);

  if (error) return [];
  return (data || []).map((m) => m.location_id);
}

export async function createGroup(
  name: string,
  description: string | null,
  locationIds: string[]
): Promise<string> {
  const { data, error } = await supabase
    .from('city_groups')
    .insert({ name, description })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create group: ${error.message}`);

  if (locationIds.length > 0) {
    const members = locationIds.map((lid) => ({
      group_id: data.id,
      location_id: lid,
    }));
    const { error: memberError } = await supabase
      .from('city_group_members')
      .insert(members);
    if (memberError) {
      logger.error('[Groups] Failed to add members:', memberError.message);
    }
  }

  return data.id;
}

export async function updateGroup(
  id: string,
  updates: { name?: string; description?: string; active?: boolean; locationIds?: string[] }
): Promise<void> {
  const { locationIds, ...fields } = updates;

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from('city_groups')
      .update(fields)
      .eq('id', id);
    if (error) throw new Error(`Failed to update group: ${error.message}`);
  }

  // Toggle group active → cascade to member cities
  if (updates.active !== undefined) {
    const memberIds = await getGroupMembers(id);
    if (memberIds.length > 0) {
      await supabase
        .from('monitored_locations')
        .update({ active: updates.active })
        .in('id', memberIds);
    }
  }

  if (locationIds !== undefined) {
    // Replace all members
    await supabase.from('city_group_members').delete().eq('group_id', id);
    if (locationIds.length > 0) {
      const members = locationIds.map((lid) => ({
        group_id: id,
        location_id: lid,
      }));
      await supabase.from('city_group_members').insert(members);
    }
  }
}

export async function deleteGroup(id: string): Promise<void> {
  const { error } = await supabase.from('city_groups').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete group: ${error.message}`);
}
