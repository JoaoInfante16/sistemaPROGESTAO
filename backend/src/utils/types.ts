// ============================================
// Tipos compartilhados do sistema
// ============================================

export interface NewsExtraction {
  e_crime: boolean;
  tipo_crime: 'roubo' | 'furto' | 'homicídio' | 'latrocínio' | 'tráfico' | 'assalto' | 'outro';
  cidade: string;
  bairro?: string;
  rua?: string;
  data_ocorrencia: string; // YYYY-MM-DD
  resumo: string;
  confianca: number; // 0.0 a 1.0
  embedding?: number[];
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
  last_check: Date | null;
  created_at: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  is_admin: boolean;
  created_by: string | null;
  active: boolean;
  created_at: Date;
}

export interface UserDevice {
  id: string;
  user_id: string;
  device_token: string;
  platform: 'ios' | 'android';
  last_seen: Date;
  created_at: Date;
}

export interface OperationLog {
  id: string;
  location_id: string;
  stage: string;
  urls_processed: number;
  news_found: number;
  cost_usd: number;
  duration_ms: number;
  created_at: Date;
}

export interface RateLimit {
  id: string;
  provider: 'google' | 'perplexity' | 'jina' | 'openai';
  max_concurrent: number;
  min_time_ms: number;
  daily_quota: number | null;
  monthly_quota: number | null;
  active: boolean;
  updated_at: Date;
}

export interface BudgetEntry {
  id: string;
  source: 'auto_scan' | 'manual_search';
  provider: 'google' | 'perplexity' | 'jina' | 'openai';
  cost_usd: number;
  details: Record<string, unknown>;
  created_at: Date;
}

export interface PipelineResult {
  locationId: string;
  locationName: string;
  urlsFound: number;
  afterFilter0: number;
  afterFilter1: number;
  afterFilter2: number;
  newsSaved: number;
  duplicatesFound: number;
  totalCostUsd: number;
  durationMs: number;
}
