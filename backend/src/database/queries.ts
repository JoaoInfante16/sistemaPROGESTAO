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
  /** `HH:MM` local do veiculo (migration 030). Ver `NewsExtraction`. */
  hora_publicacao?: string;
  titulo?: string;
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
      hora_publicacao: params.hora_publicacao || null,
      titulo: params.titulo || null,
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

export interface FusaoParams {
  titulo: string;
  resumo: string;
  tipo_crime: string;
  categoria_grupo: string;
  embedding: number[];
}

/**
 * Reescreve a linha que sobreviveu a uma fusão de duplicatas.
 *
 * 🚨 **Existe porque fundir estava DESCARTANDO informação.** Até 24/08 a fusão
 * chamava só `insertNewsSource`: guardava a URL do relato novo e jogava fora a
 * manchete e o resumo dele. Com o feed antigo isso quase não aparecia; depois
 * que a camada 1 parou de filtrar por `tipo_crime`, fundir virou rotina — e a
 * linha sobrevivente seria sempre a PRIMEIRA. Na prática: *"Menina de 4 anos é
 * morta após maus-tratos"* ficaria no feed para sempre e a prisão do tio viraria
 * uma URL que ninguém vê. Consertar a detecção sem isto pioraria o produto.
 *
 * ⚠️ **`tipo_crime` também muda, e isso não é detalhe.** Se a agressão virou
 * homicídio, a linha tem que virar homicídio: `getCrimeSummary` conta por tipo,
 * e manter `lesao_corporal` subnotifica um homicídio no relatório que chega ao
 * cliente.
 *
 * 🚨 **O `embedding` é obrigatório aqui.** Ele é gerado A PARTIR do texto; trocar
 * o resumo sem regravar o vetor faz os dois deixarem de corresponder, e as
 * comparações futuras degradam **em silêncio** — o modo de falha mais caro que
 * este projeto já teve. Quem chamar tem que regerar com a MESMA fórmula
 * (`textoParaEmbedding` em `pipelineCore.ts`), nunca uma variação.
 *
 * `data_ocorrencia` NÃO entra: o fato aconteceu quando aconteceu.
 */
export async function atualizarNoticiaFundida(id: string, params: FusaoParams): Promise<void> {
  const { error } = await supabase
    .from('news')
    .update({
      titulo: params.titulo,
      resumo: params.resumo,
      tipo_crime: params.tipo_crime,
      categoria_grupo: params.categoria_grupo,
      embedding: params.embedding,
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update merged news ${id}: ${error.message}`);
  }
}

/**
 * Quais destas URLs já viraram notícia salva. Serve pro auto-scan não pagar
 * Jina + GPT de novo pelo mesmo artigo a cada rodada: ele roda de hora em hora
 * sobre a mesma janela, então a SERP devolve os mesmos links repetidamente.
 *
 * Em lotes porque o `.in()` do PostgREST vai na query string — algumas centenas
 * de URLs longas estouram o limite de tamanho do request.
 */
export async function findKnownSourceUrls(urls: string[]): Promise<Set<string>> {
  const conhecidas = new Set<string>();
  if (urls.length === 0) return conhecidas;

  const LOTE = 100;
  for (let i = 0; i < urls.length; i += LOTE) {
    const { data, error } = await supabase
      .from('news_sources')
      .select('url')
      .in('url', urls.slice(i, i + LOTE));

    if (error) {
      // Falhar aqui só custa dinheiro (reanalisa), não corretude — então
      // degrada pra "não conheço nenhuma" em vez de derrubar o scan.
      logger.error('Failed to check known source URLs:', error.message);
      return conhecidas;
    }

    for (const row of data || []) conhecidas.add((row as { url: string }).url);
  }

  return conhecidas;
}

// ============================================
// Deduplication - Geo-Temporal Candidates
// ============================================

export interface DedupCandidate {
  id: string;
  resumo: string;
  embedding: number[];
  /**
   * A manchete. Entra porque a camada 3 passou a compará-la junto com o resumo:
   * é nela que mora a identidade do fato ("Operação Ad Extremum", o bairro, a
   * vítima), e até 24/08 ela era simplesmente ignorada pelo dedup.
   */
  titulo: string | null;
  /** Necessário na fusão: se a agressão virou homicídio, a linha tem que virar. */
  tipo_crime: string;
  /**
   * Metadata da linha que SOBREVIVE. Vem junto porque `buildEmbeddingText` a
   * exige para regerar o vetor na fusão — e o vetor tem que ser reconstruído
   * com os dados de quem fica, não de quem chegou.
   */
  cidade: string;
  estado: string | null;
  bairro: string | null;
  data_ocorrencia: string;
}

/**
 * Quantos dias para cada lado a camada 1 aceita como "pode ser o mesmo fato".
 *
 * 🚨 Era **1**, e por isso uma duplicata escapou em 17/08 (`Bancário desaparece
 * em Florianópolis`): a MESMA matéria, lida com 2h de diferença, foi gravada com
 * `data_ocorrencia` 17/08 numa linha e 15/08 na outra. Dois dias de distância,
 * janela de um: a linha antiga nunca virou candidata, e as camadas 2 e 3 — que
 * teriam acertado, medido YES 5/5 — nunca chegaram a ser consultadas.
 *
 * A causa da divergência é a **regra 4 do prompt do Filter2**: *"If unsure, use
 * today's date"*. Fallback que muda conforme a hora do scan. Enquanto ele
 * existir, `data_ocorrencia` pode divergir em até `scan_period_days` para a
 * mesma matéria, e a janela do dedup precisa cobrir isso.
 *
 * ⚠️ Alargar aqui **não** afrouxa o critério: só amplia quem é *perguntado*.
 * Quem decide continua sendo o cosine e o GPT, e o GPT lê "same time frame".
 * O custo é candidato a mais na camada 2, que é local e grátis.
 */
const DEDUP_JANELA_DIAS = 3;

/**
 * A camada 1 do dedup: quem sequer é COMPARADO com a notícia que chegou.
 *
 * 🚨 **É um portão, não um veredito** — quem ela não devolve, ninguém mais
 * examina. Por isso ela filtra só pelo que é confiável, e deixa o resto para as
 * camadas 2 e 3, que sabem julgar.
 *
 * ⚠️ **Até 24/08 ela filtrava também por `tipo_crime` e por `bairro`, e isso era
 * circular:** os dois campos são inventados pelo GPT no Filter2, e a duplicata
 * nasce justamente quando o GPT é inconsistente. Ou seja, o portão fechava
 * exatamente nos casos que ele deveria pegar. Medido em 24/08 — **5 dos 7
 * clusters de repetição do feed** morriam aqui:
 *
 *   "Carro invade loja em Palhoça e causa prejuízo de R$50 mil"   -> vandalismo
 *   "Carro invade loja de bebidas em Palhoça e motorista é preso" -> invasao
 *   (mesmo carro, mesma loja, mesmo dia, cosine 0.9513, nunca comparados)
 *
 * O par mais constrangedor diferia em UMA LETRA no título (`roubos`/`roubo`) e
 * caiu em `operacao_policial` contra `roubo_furto`.
 *
 * A mesma doença já tinha aparecido em 17/08 no `data_ocorrencia` — ver
 * `DEDUP_JANELA_DIAS` acima. Lá foi tratada alargando a janela; aqui não dá para
 * "alargar" uma igualdade de string, então o filtro sai.
 *
 * **Sobra `cidade` + `estado` + janela de data.** Cidade resiste porque é
 * pós-filtrada contra a localização monitorada: em 24/08 o banco inteiro tinha
 * cinco valores, todos municípios reais. O caso em que ela falha — fato de
 * alcance estadual pendurado na cidade que disparou a query — é conhecido,
 * aceito e está no ROADMAP.
 *
 * Custo de alargar: ~20-30 candidatos em vez de ~4, no volume de 2026-08. Cosine
 * é local e grátis, e só o topo vai ao GPT.
 */
export async function findGeoTemporalCandidates(
  cidade: string,
  dataOcorrencia: string,
  estado?: string | null,
): Promise<DedupCandidate[]> {
  const date = new Date(dataOcorrencia);
  const dateFrom = new Date(date.getTime() - DEDUP_JANELA_DIAS * 86400000).toISOString().split('T')[0];
  const dateTo = new Date(date.getTime() + DEDUP_JANELA_DIAS * 86400000).toISOString().split('T')[0];

  let query = supabase
    .from('news')
    .select('id, titulo, resumo, tipo_crime, cidade, estado, bairro, data_ocorrencia, embedding')
    .eq('cidade', cidade)
    .gte('data_ocorrencia', dateFrom)
    .lte('data_ocorrencia', dateTo)
    .eq('active', true)
    .limit(200);

  if (estado) {
    query = query.eq('estado', estado);
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
  categoria_grupo: string | null;
  cidade: string;
  estado: string | null;
  bairro: string | null;
  rua: string | null;
  data_ocorrencia: string;
  /**
   * `HH:MM` do veiculo (migration 030). null nas linhas anteriores e quando o
   * artigo nao informa — o app **omite** o carimbo nesse caso, em vez de
   * exibir `00:00`, que era o que acontecia lendo a hora de `data_ocorrencia`
   * (coluna DATE, portanto sempre meia-noite).
   */
  hora_publicacao: string | null;
  /** null nas linhas anteriores a migration 029 — o app compoe um titulo. */
  titulo: string | null;
  resumo: string;
  confianca: number;
  created_at: string;
  news_sources: Array<{ url: string; source_name: string | null }>;
}

export async function getNewsFeed(params: NewsFeedParams): Promise<{ news: NewsFeedItem[]; hasMore: boolean }> {
  let query = supabase
    .from('news')
    .select('id, tipo_crime, categoria_grupo, natureza, cidade, estado, bairro, rua, data_ocorrencia, hora_publicacao, titulo, resumo, confianca, created_at, news_sources(url, source_name)')
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
    .select('id, tipo_crime, categoria_grupo, natureza, cidade, estado, bairro, rua, data_ocorrencia, hora_publicacao, titulo, resumo, confianca, created_at, news_sources(url, source_name)')
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

// Uma rejeição vem OU do auto-scan (tem location_id) OU da busca manual (tem
// search_id) — nunca das duas, porque a busca manual roda em cidade que não
// está em monitored_locations e não teria location_id para gravar.
export interface RejectedUrl {
  url: string;
  title?: string;
  stage: string;
  reason?: string;
  location_id?: string;
  search_id?: string;
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

export interface NotificationPrefs {
  cidades: string[] | null;
  categorias: string[] | null;
  estatisticas: boolean;
}

/**
 * Devolve `null` quando o usuario nunca escolheu — e quem chama traduz isso
 * para "recebe tudo". Ver `querReceber` em `pushService.ts` e a migration 032.
 */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs | null> {
  const { data, error } = await supabase
    .from('user_notification_prefs')
    .select('cidades, categorias, estatisticas')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch notification prefs: ${error.message}`);
  return (data as NotificationPrefs | null) ?? null;
}

export async function upsertNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase
    .from('user_notification_prefs')
    .upsert(
      { user_id: userId, ...prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) throw new Error(`Failed to save notification prefs: ${error.message}`);
}

// Namespace export para usar como db.getLocation(), db.insertNews(), etc.
// ============================================
// User Feed (com status de lida)
// ============================================

export async function getUserNewsFeed(userId: string, params: { offset: number; limit: number; cidade?: string; cidades?: string[]; estado?: string }) {
  let query = supabase
    .from('news')
    .select('id, tipo_crime, categoria_grupo, natureza, cidade, estado, bairro, rua, data_ocorrencia, hora_publicacao, titulo, resumo, confianca, created_at, news_sources(url, source_name)')
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

  const items = (news || []) as unknown as NewsFeedItem[];
  const enriched = items.map((n) => ({
    ...n,
    is_unread: !readSet.has(n.id),
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

// ============================================
// Manual Search (search_cache + search_results)
// ============================================

interface CreateSearchCacheParams {
  user_id: string;
  params: Record<string, unknown>;
}

export async function createSearchCache(p: CreateSearchCacheParams): Promise<string> {
  // O `user_id` ENTRA no hash. Sem ele, `params_hash` é UNIQUE global (schema.sql)
  // e dois clientes que buscassem a mesma cidade no mesmo período colidiam: o
  // segundo caía no ramo de baixo e **apagava a busca do primeiro** pra conseguir
  // inserir a sua. Com o usuário dentro do hash, a trava vira na prática
  // UNIQUE(user_id, params) e a colisão só acontece com a própria busca anterior.
  //
  // Ninguém consulta a coluna — ela existe só como trava de unicidade (grep:
  // `params_hash` só aparece nesta função), então mudar a fórmula não invalida
  // nada. Linhas antigas com o formato velho deixam de colidir e expiram sozinhas
  // pelo `expires_at` de 7 dias.
  const paramsHash = JSON.stringify({ u: p.user_id, ...p.params });

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
    // 🚨 **Busca em andamento não se apaga.** Veio da `main` (fix de produção de
    // 12/08) e a `staging` não tinha: sem esta checagem, disparar a MESMA busca
    // de novo deletava a linha enquanto o worker ainda rodava — e o worker
    // seguia trabalhando contra um `search_id` que não existe mais, gastando
    // Jina e GPT para gravar resultado em lugar nenhum. Quem tocasse duas vezes
    // no INICIAR CONSULTA matava a primeira.
    //
    // Só apaga o que já terminou (`completed`/`failed`/`cancelled`).
    const { data: existing } = await supabase
      .from('search_cache')
      .select('search_id, status')
      .eq('params_hash', paramsHash)
      .maybeSingle();

    if (existing?.status === 'processing') {
      return (existing as { search_id: string }).search_id;
    }

    // Busca com mesmos params já existe e terminou — deletar antiga e recriar.
    // O `user_id` é redundante depois que ele entrou no hash, e fica de propósito:
    // se a fórmula do hash mudar um dia, o delete continua confinado ao dono.
    await supabase
      .from('search_cache')
      .delete()
      .eq('params_hash', paramsHash)
      .eq('user_id', p.user_id);

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

interface StageHistoryEntry {
  stage_num: number;
  details?: string;
  started_at: string; // ISO
}

/**
 * Achado recente, pra tela de carregamento mostrar a busca trabalhando.
 *
 * Os cinco campos saem TODOS da mesma extracao do Filter2, no instante em que
 * ela fica pronta — nenhuma consulta a mais, nenhum token a mais. Ate 09/08 so
 * os tres primeiros vinham, e a tela dizia "Roubo/Furto - Kobrasol": o titulo
 * ja existia em memoria e era descartado uma linha depois.
 *
 * `titulo`, `cidade` e `categoria_grupo` sao opcionais porque a linha de
 * `NewsExtraction` que os alimenta tambem e: item sem manchete nao e rejeitado
 * (ver migration 029). Quem consome desenha o que tem.
 */
export interface AchadoProgresso {
  tipo_crime: string;
  bairro?: string | null;
  data_ocorrencia: string;
  titulo?: string | null;
  cidade?: string | null;
  /** Uma das 5 categorias — e o que da a cor do quadradinho na tela. */
  categoria_grupo?: string | null;
}

export interface SearchProgressPayload {
  stage: string;
  stage_num: number;
  total_stages: number;
  details?: string;
  /** Contador DENTRO do estágio (8.5). Sem isto, o estágio 4 fica mudo por minutos. */
  feitos?: number;
  total?: number;
  /** Últimos achados do Filter2, em ordem de conclusão. */
  achados?: AchadoProgresso[];
}

// Atualiza o progresso e **acumula** um history de stages com timestamp.
// Permite que o Flutter (quando user retoma busca via histórico) reconstrua
// a cronologia completa — [HH:MM:SS] + duração por stage, igual se tivesse
// ficado na tela. Sem migration: só expande o shape do JSONB `progress`.
//
// `atualizado_em` (8.5) marca a ULTIMA vez que algo se mexeu — e o que permite
// distinguir "busca lenta" de "busca morta" sem relogio fixo. Ver o 409 e a
// deteccao de busca fantasma em manualSearchRoutes.
export async function updateSearchProgress(
  searchId: string,
  progress: SearchProgressPayload
): Promise<void> {
  const { data: current } = await supabase
    .from('search_cache')
    .select('progress')
    .eq('search_id', searchId)
    .maybeSingle();

  const existingHistory = (((current?.progress as Record<string, unknown> | null)?.history as StageHistoryEntry[] | undefined) || []);

  // Append só se stage_num novo (worker é sequencial, mas cinto + suspensório).
  const alreadyLogged = existingHistory.some((h) => h.stage_num === progress.stage_num);
  const history: StageHistoryEntry[] = alreadyLogged
    ? existingHistory
    : [
        ...existingHistory,
        {
          stage_num: progress.stage_num,
          details: progress.details,
          started_at: new Date().toISOString(),
        },
      ];

  const { error } = await supabase
    .from('search_cache')
    .update({ progress: { ...progress, atualizado_em: new Date().toISOString(), history } })
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

// ============================================
// Executive Cache — resumo + indicadores visuais gerados via GPT a partir
// das estatísticas (natureza='estatistica') do período. Chave: cidade+estado+range_days.
// Invalidação: pipeline dispara delete quando salva nova estatística. TTL 24h
// como fallback pra capturar saída de estatísticas antigas pela janela móvel.
// ============================================

export interface ExecutiveData {
  indicadores: Array<{
    valor: number;
    unidade: string | null; // '%' | null
    tipo: 'percentual' | 'absoluto' | 'monetario';
    sentido: 'positivo' | 'negativo' | 'neutro';
    label: string;
    contexto: string;
    fonte: string;
  }>;
  resumo_complementar: string | null;
  fontes: string[];
}

// TTL 30 dias pra ambos os modos.
// - Dashboard: invalidado por evento quando chega stat nova (invalidateExecutiveCacheByCity),
//   TTL 30d é só garantia contra "estatísticas fantasma" que caíram fora da janela móvel.
// - Busca manual: busca é imutável, mas 30d mantém o DB limpo — depois disso provavelmente
//   ninguém abre de novo.
const EXECUTIVE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Busca cache. Se searchId é fornecido, usa ele como chave (modo busca manual).
// Senão, usa cidade+estado+rangeDays (modo dashboard).
export async function getExecutiveCache(
  cidade: string,
  estado: string,
  rangeDays: number,
  searchId?: string | null,
): Promise<{ data: ExecutiveData; generated_at: string } | null> {
  let query = supabase
    .from('executive_cache')
    .select('data, generated_at, expires_at');

  if (searchId) {
    query = query.eq('search_id', searchId);
  } else {
    query = query
      .eq('cidade', cidade)
      .eq('estado', estado)
      .eq('range_days', rangeDays)
      .is('search_id', null);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;

  // Expirou? trata como miss.
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  return {
    data: data.data as ExecutiveData,
    generated_at: data.generated_at as string,
  };
}

// Salva/atualiza cache. Se searchId fornecido, salva no modo busca manual
// (chave = search_id). Senão, salva no modo dashboard (cidade+estado+range_days).
export async function upsertExecutiveCache(
  cidade: string,
  estado: string,
  rangeDays: number,
  data: ExecutiveData,
  searchId?: string | null,
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXECUTIVE_CACHE_TTL_MS);

  const row = {
    cidade,
    estado,
    range_days: rangeDays,
    search_id: searchId ?? null,
    data,
    generated_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  // Postgres trata NULL como != em unique constraints. Usamos 2 índices
  // parciais distintos (migration 022): um quando search_id IS NULL, outro
  // quando IS NOT NULL. O onConflict abaixo seleciona o constraint certo.
  const onConflict = searchId ? 'search_id' : 'cidade,estado,range_days';

  const { error } = await supabase
    .from('executive_cache')
    .upsert(row, { onConflict });

  if (error) logger.warn(`[ExecutiveCache] Upsert failed: ${error.message}`);
}

// Invalida todos os caches de uma cidade (qualquer estado, qualquer range).
// Chamado pelo pipeline quando salva nova notícia natureza='estatistica'.
export async function invalidateExecutiveCacheByCity(cidade: string): Promise<void> {
  const { error } = await supabase
    .from('executive_cache')
    .delete()
    .eq('cidade', cidade);

  if (error) logger.warn(`[ExecutiveCache] Invalidate failed for ${cidade}: ${error.message}`);
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
  atualizarNoticiaFundida,
  findKnownSourceUrls,
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
  getUnreadCount,
  createSearchCache,
  updateSearchStatus,
  updateSearchProgress,
  insertSearchResults,
  getSearchStatus,
  getSearchResults,
  getUserSearchHistory,
  getCityToUFMap,
  bulkInsertLocations,
  getExecutiveCache,
  upsertExecutiveCache,
  invalidateExecutiveCacheByCity,
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
  getNotificationPrefs,
  upsertNotificationPrefs,
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
