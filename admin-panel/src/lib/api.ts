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

export interface NewsItem {
  id: string;
  tipo_crime: string;
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

  triggerScan: (token: string, locationId: string) =>
    apiFetch<{ success: boolean; jobId: string }>(`/locations/${locationId}/scan`, {
      method: 'POST',
      token,
    }),

  // Users (GET/POST /users, PATCH /users/:id)
  getUsers: (token: string) =>
    apiFetch<UserProfile[]>('/users', { token }),

  createUser: (token: string, data: { email: string; is_admin?: boolean }) =>
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
      avgCostByProvider: { google: number; jina: number; openai: number };
      activeCities: number;
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

  // Dev Tools (TEMPORARIO - remover antes do deploy)
  seedNews: (token: string) =>
    apiFetch<{ success: boolean; inserted: number; total: number }>('/dev/seed-news', {
      method: 'POST',
      token,
    }),

  triggerNotification: (token: string) =>
    apiFetch<{ success: boolean; devices: number; successCount: number; reason?: string; notification: { title: string; body: string } }>('/dev/trigger-notification', {
      method: 'POST',
      token,
    }),

  clearMock: (token: string) =>
    apiFetch<{ success: boolean; deleted: number }>('/dev/clear-mock', {
      method: 'POST',
      token,
    }),
};
