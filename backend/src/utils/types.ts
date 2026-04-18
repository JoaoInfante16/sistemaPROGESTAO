// ============================================
// Tipos compartilhados do sistema
// ============================================

// 15 categorias padronizadas de crime (gerenciamento de risco corporativo)
export type TipoCrime =
  | 'roubo_furto' | 'vandalismo' | 'invasao'           // patrimonial
  | 'homicidio' | 'latrocinio' | 'lesao_corporal'      // seguranca
  | 'trafico' | 'operacao_policial' | 'manifestacao' | 'bloqueio_via' // operacional
  | 'estelionato' | 'receptacao'                        // fraude
  | 'crime_ambiental' | 'trabalho_irregular' | 'estatistica' | 'outros'; // institucional

export type CategoriaGrupo = 'patrimonial' | 'seguranca' | 'operacional' | 'fraude' | 'institucional';
export type Natureza = 'ocorrencia' | 'estatistica';

// Mapa tipo_crime → categoria_grupo (usado pra validacao)
export const TIPO_CRIME_GRUPO: Record<TipoCrime, CategoriaGrupo> = {
  roubo_furto: 'patrimonial', vandalismo: 'patrimonial', invasao: 'patrimonial',
  homicidio: 'seguranca', latrocinio: 'seguranca', lesao_corporal: 'seguranca',
  trafico: 'operacional', operacao_policial: 'operacional', manifestacao: 'operacional', bloqueio_via: 'operacional',
  estelionato: 'fraude', receptacao: 'fraude',
  crime_ambiental: 'institucional', trabalho_irregular: 'institucional', estatistica: 'institucional', outros: 'institucional',
};

export interface NewsExtraction {
  e_crime: boolean;
  tipo_crime: TipoCrime;
  natureza: Natureza;
  categoria_grupo: CategoriaGrupo;
  cidade: string;
  estado?: string;
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
  must_change_password: boolean;
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
  provider: 'google' | 'brave' | 'brightdata' | 'jina' | 'openai';
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
  provider: 'google' | 'brave' | 'brightdata' | 'jina' | 'openai';
  cost_usd: number;
  details: Record<string, unknown>;
  created_at: Date;
}

// Ponto individual de ocorrência pro mapa (radar).
// `precisao` indica o nível de ancoragem do geocode — útil pra aplicar jitter só
// quando cai no centro do bairro ou cidade (evita empilhar pontos em 1 pixel).
export interface CrimePoint {
  id: string;
  lat: number;
  lng: number;
  categoria: CategoriaGrupo;
  tipo_crime: TipoCrime;
  data: string; // YYYY-MM-DD
  bairro: string | null;
  rua: string | null;
  precisao: 'rua' | 'bairro' | 'cidade';
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
