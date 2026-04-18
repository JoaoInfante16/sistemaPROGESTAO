const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ============================================
// Types matching backend responses
// ============================================

export type CategoriaGrupo = 'patrimonial' | 'seguranca' | 'operacional' | 'fraude' | 'institucional';

export interface NewsItem {
  id: string;
  tipo_crime: string;
  natureza: 'ocorrencia' | 'estatistica';
  categoria_grupo: CategoriaGrupo | null;
  cidade: string;
  bairro: string | null;
  rua: string | null;
  data_ocorrencia: string;
  resumo: string;
  confianca: number;
  created_at: string;
  news_sources: Array<{ url: string; source_name: string | null }>;
}

export interface MonitoredLocation {
  id: string;
  type: 'state' | 'city';
  name: string;
  parent_id: string | null;
  active: boolean;
  mode: 'keywords' | 'any';
  keywords: string[] | null;
  scan_frequency_minutes: number;
  last_check: string | null;
  created_at: string;
}

export interface StateWithCities extends MonitoredLocation {
  cities: MonitoredLocation[];
}

export interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  active: boolean;
  must_change_password: boolean;
  password_reset_requested: boolean;
  created_at: string;
  created_by: string | null;
}

export interface RateLimit {
  id: string;
  provider: string;
  max_concurrent: number;
  min_time_ms: number;
  daily_quota: number | null;
  monthly_quota: number | null;
  updated_at: string;
}

export interface BudgetSummary {
  month: string;
  total: number;
  autoScans: number;
  manualSearches: number;
  byProvider: Record<string, number>;
  budget: number;
  budgetUsedPercent: number;
}

export interface DailyBudget {
  date: string;
  cost_usd: number;
}

export interface SystemConfig {
  key: string;
  value: string;
  category: string;
  description: string;
  updated_at: string;
}

export interface DashboardStats {
  newsThisMonth: number;
  activeCities: number;
  costThisMonth: number;
  pipelineSuccessRate: number;
  scansToday: number;
}

export interface OperationLog {
  id: string;
  location_id: string;
  stage: string;
  urls_processed: number;
  news_found: number;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
  monitored_locations?: { name: string };
}

export interface RejectedUrlEntry {
  url: string;
  title: string | null;
  stage: string;
  reason: string | null;
  location_id: string;
  created_at: string;
  monitored_locations?: { name: string };
}

// ============================================
// Analytics Types
// ============================================

export interface CrimeSummary {
  totalCrimes: number;
  byCrimeType: Array<{ tipo_crime: string; count: number; percentage: number }>;
  byCategory: Array<{ category: string; count: number; percentage: number }>;
  topBairros: Array<{ bairro: string; count: number }>;
  avgConfianca: number;
}

export interface CrimeTrend {
  dataPoints: Array<{
    period: string;
    label: string;
    total: number;
    breakdown: Record<string, number>;
  }>;
}

export interface CrimeComparison {
  period1: { label: string; total: number; byCrimeType: Record<string, number> };
  period2: { label: string; total: number; byCrimeType: Record<string, number> };
  changes: Array<{
    tipo_crime: string;
    period1Count: number;
    period2Count: number;
    changePercent: string;
  }>;
  overallDelta: string;
}

export interface ReportData {
  id: string;
  cidade: string;
  estado: string;
  date_from: string;
  date_to: string;
  report_data: {
    cidade: string;
    estado: string;
    dateFrom: string;
    dateTo: string;
    generatedAt: string;
    summary: {
      totalCrimes: number;
      avgConfianca: number;
      topCrimeType: string;
      comparisonDelta: string;
    };
    riskScore?: number;
    riskLevel?: 'baixo' | 'moderado' | 'alto';
    credibilityPercent?: number;
    byCrimeType: Array<{ tipo_crime: string; count: number; percentage: number }>;
    byCategory?: Array<{ category: string; count: number; percentage: number }>;
    trend: Array<{ period: string; label: string; total: number; breakdown: Record<string, number> }>;
    topBairros: Array<{ bairro: string; count: number }>;
    comparison: CrimeComparison | null;
    sources: Array<{ name: string; count: number; urls?: string[]; type?: 'oficial' | 'midia' }>;
    sourceCounts?: { official: number; media: number };
    sourcesOficial?: Array<{ name: string; count: number; urls?: string[] }>;
    sourcesMedia?: Array<{ name: string; count: number; urls?: string[] }>;
    heatmapData?: Array<{ bairro: string; count: number; lat: number; lng: number }>;
    // Radar de ocorrências (substitui heatmapData legado)
    mapPoints?: Array<{
      id: string;
      lat: number;
      lng: number;
      categoria: string;
      tipo_crime: string;
      data: string;
      bairro: string | null;
      rua: string | null;
      precisao: 'rua' | 'bairro' | 'cidade';
    }>;
    // Executive Section (cards de indicadores + resumo + fontes)
    executive?: {
      indicadores: Array<{
        valor: number;
        unidade: string | null;
        tipo: 'percentual' | 'absoluto' | 'monetario';
        sentido: 'positivo' | 'negativo' | 'neutro';
        label: string;
        contexto: string;
        fonte: string;
      }>;
      resumo_complementar: string | null;
      fontes: string[];
    };
  };
  sources: Array<{ name: string; count: number; urls?: string[]; type?: 'oficial' | 'midia' }>;
  created_at: string;
  expires_at: string;
}

export interface BillingRecord {
  id: string;
  month: string;
  total_cost_usd: number;
  total_scans: number;
  breakdown: Record<string, number>;
  closed_at: string;
}

export interface CityGroup {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  cities: { id: string; name: string }[];
}

// ============================================
// API Client - paths match backend routes exactly
// ============================================

export const api = {
  // News (GET /news, POST /search)
  getNews: (token: string, params?: { offset?: number; limit?: number; cidade?: string }) => {
    const qs = new URLSearchParams();
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.cidade) qs.set('cidade', params.cidade);
    const query = qs.toString();
    return apiFetch<{ news: NewsItem[]; hasMore: boolean }>(`/news${query ? `?${query}` : ''}`, { token });
  },

  searchNews: (token: string, params: { query: string; cidade?: string; dateFrom?: string; dateTo?: string; offset?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.offset) qs.set('offset', String(params.offset));
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return apiFetch<{ news: NewsItem[]; hasMore: boolean }>(`/search${query ? `?${query}` : ''}`, {
      method: 'POST',
      body: JSON.stringify({
        query: params.query,
        cidade: params.cidade,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
      token,
    });
  },

  // Locations (GET/POST /locations, PATCH /locations/:id, POST /locations/:id/scan)
  getLocations: (token: string) =>
    apiFetch<StateWithCities[]>('/locations', { token }),

  createLocation: (token: string, data: {
    type: 'state' | 'city';
    name: string;
    parent_id?: string | null;
    mode?: 'keywords' | 'any';
    keywords?: string[] | null;
    scan_frequency_minutes?: number;
  }) =>
    apiFetch<MonitoredLocation>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateLocation: (token: string, id: string, data: {
    active?: boolean;
    mode?: 'keywords' | 'any';
    keywords?: string[] | null;
    scan_frequency_minutes?: number;
  }) =>
    apiFetch<{ success: boolean }>(`/locations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deleteLocation: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/locations/${id}`, {
      method: 'DELETE',
      token,
    }),

  triggerScan: (token: string, locationId: string) =>
    apiFetch<{ success: boolean; jobId: string }>(`/locations/${locationId}/scan`, {
      method: 'POST',
      token,
    }),

  bulkImportLocations: (token: string, data: {
    state_name: string;
    cities: string[];
    mode?: 'keywords' | 'any';
    scan_frequency_minutes?: number;
  }) =>
    apiFetch<{ imported: number; skipped: number; total: number }>('/locations/bulk-import', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getScanFrequency: (token: string) =>
    apiFetch<{ scan_frequency_minutes: number }>('/locations/scan-frequency', { token }),

  updateScanFrequency: (token: string, scan_frequency_minutes: number) =>
    apiFetch<{ success: boolean; updated: number; scan_frequency_minutes: number }>('/locations/scan-frequency', {
      method: 'PATCH',
      body: JSON.stringify({ scan_frequency_minutes }),
      token,
    }),

  // Users (GET/POST /users, PATCH /users/:id)
  getUsers: (token: string) =>
    apiFetch<UserProfile[]>('/users', { token }),

  createUser: (token: string, data: { email: string; is_admin?: boolean; password?: string }) =>
    apiFetch<{ success: boolean; userId: string; tempPassword: string; message: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateUser: (token: string, id: string, data: { active?: boolean }) =>
    apiFetch<{ success: boolean }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deleteUser: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
      token,
    }),

  resetPassword: (token: string, id: string) =>
    apiFetch<{ success: boolean; tempPassword: string }>(`/users/${id}/reset-password`, {
      method: 'POST',
      token,
    }),

  // Settings
  getRateLimits: (token: string) =>
    apiFetch<RateLimit[]>('/settings/rate-limits', { token }),

  updateRateLimit: (token: string, id: string, data: {
    max_concurrent?: number;
    min_time_ms?: number;
    daily_quota?: number | null;
    monthly_quota?: number | null;
  }) =>
    apiFetch<RateLimit>(`/settings/rate-limits/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  getBudgetSummary: (token: string) =>
    apiFetch<BudgetSummary>('/settings/budget/summary', { token }),

  getBudgetDaily: (token: string) =>
    apiFetch<DailyBudget[]>('/settings/budget/daily', { token }),

  getCostEstimate: (token: string) =>
    apiFetch<{
      avgCostPerScan: number;
      totalScansThisMonth: number;
      totalCostThisMonth: number;
      avgCostByProvider: { brightdata: number; brave: number; jina: number; openai: number };
      activeCities: number;
      estimatedScansPerDay: number;
    }>('/settings/cost-estimate', { token }),

  getConfig: (token: string) =>
    apiFetch<Record<string, SystemConfig[]>>('/settings/config', { token }),

  updateConfig: (token: string, key: string, value: string) =>
    apiFetch<{ success: boolean; restartRequired: boolean; message: string }>(`/settings/config/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
      token,
    }),

  // Stats & Logs
  getStats: (token: string) =>
    apiFetch<DashboardStats>('/stats', { token }),

  getLogs: (token: string) =>
    apiFetch<OperationLog[]>('/logs/recent', { token }),

  // Rejected URLs (dashboard)
  getRejectedUrls: (token: string) =>
    apiFetch<RejectedUrlEntry[]>('/dashboard/rejected-urls', { token }),

  clearRejectedUrls: (token: string) =>
    apiFetch<{ success: boolean }>('/dashboard/rejected-urls', { method: 'DELETE', token }),

  // Analytics
  getCrimeSummary: (token: string, params: { cidade: string; dateFrom: string; dateTo: string }) => {
    const qs = new URLSearchParams(params);
    return apiFetch<CrimeSummary>(`/analytics/crime-summary?${qs}`, { token });
  },

  getCrimeTrend: (token: string, params: { cidade: string; dateFrom: string; dateTo: string; groupBy?: string }) => {
    const qs = new URLSearchParams({ cidade: params.cidade, dateFrom: params.dateFrom, dateTo: params.dateTo });
    if (params.groupBy) qs.set('groupBy', params.groupBy);
    return apiFetch<CrimeTrend>(`/analytics/crime-trend?${qs}`, { token });
  },

  getCrimeComparison: (token: string, params: { cidade: string; period1Start: string; period1End: string; period2Start: string; period2End: string }) => {
    const qs = new URLSearchParams(params);
    return apiFetch<CrimeComparison>(`/analytics/crime-comparison?${qs}`, { token });
  },

  generateReport: (token: string, data: { cidade: string; estado: string; dateFrom: string; dateTo: string; searchId?: string }) =>
    apiFetch<{ reportId: string }>('/analytics/report', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  getPublicReport: (reportId: string) =>
    apiFetch<ReportData>(`/public/report/${reportId}`),

  // Billing
  getBillingHistory: (token: string) =>
    apiFetch<BillingRecord[]>('/billing/history', { token }),

  closeBillingMonth: (token: string) =>
    apiFetch<{ success: boolean }>('/billing/close', { method: 'POST', token }),

  // Groups
  getGroups: (token: string) =>
    apiFetch<CityGroup[]>('/groups', { token }),

  createGroup: (token: string, data: { name: string; description?: string; locationIds: string[] }) =>
    apiFetch<{ id: string; success: boolean }>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  updateGroup: (token: string, id: string, data: { name?: string; description?: string; active?: boolean; locationIds?: string[] }) =>
    apiFetch<{ success: boolean }>(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    }),

  deleteGroup: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/groups/${id}`, { method: 'DELETE', token }),
};
