-- ============================================
-- NETRIOS NEWS - Database Schema
-- ============================================
-- Execute este arquivo no Supabase SQL Editor
-- ============================================

-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. NOTÍCIAS PROCESSADAS
-- ============================================

CREATE TABLE news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_crime TEXT NOT NULL,
  cidade TEXT NOT NULL,
  bairro TEXT,
  rua TEXT,
  data_ocorrencia DATE NOT NULL,
  resumo TEXT NOT NULL,
  embedding vector(1536),
  confianca DECIMAL(3,2),
  natureza TEXT DEFAULT 'ocorrencia' CHECK (natureza IN ('ocorrencia', 'estatistica')),
  categoria_grupo TEXT DEFAULT NULL CHECK (categoria_grupo IN ('patrimonial', 'seguranca', 'operacional', 'fraude', 'institucional')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para similarity search (CRÍTICO para deduplicação!)
-- HNSW: funciona com 0 rows (IVFFlat requer dados para treinar)
-- Migration 002: trocado de IVFFlat para HNSW
CREATE INDEX news_embedding_idx ON news
USING hnsw (embedding vector_cosine_ops);

-- Índices adicionais para queries rápidas
CREATE INDEX idx_news_cidade ON news(cidade);
CREATE INDEX idx_news_data ON news(data_ocorrencia DESC);
CREATE INDEX idx_news_created ON news(created_at DESC);

-- ============================================
-- 2. FONTES AGRUPADAS (para deduplicação)
-- ============================================

CREATE TABLE news_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  source_name TEXT,
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. LOCALIZAÇÕES MONITORADAS
-- ============================================

CREATE TABLE monitored_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT CHECK (type IN ('state', 'city')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES monitored_locations(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT true,
  mode TEXT CHECK (mode IN ('keywords', 'any')) DEFAULT 'any',
  keywords TEXT[],
  scan_frequency_minutes INTEGER DEFAULT 60,
  last_check TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_location UNIQUE(type, name, parent_id)
);

-- ============================================
-- 4. PERFIS DE USUÁRIOS (complementa Supabase Auth)
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  must_change_password BOOLEAN DEFAULT false,
  password_reset_requested BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. DEVICES PARA PUSH NOTIFICATIONS
-- ============================================

CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  last_seen TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. CACHE DE BUSCAS HISTÓRICAS
-- ============================================

CREATE TABLE search_cache (
  search_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  params JSONB NOT NULL,
  params_hash TEXT UNIQUE,
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  total_results INTEGER,
  progress JSONB DEFAULT NULL, -- Pipeline stage: {stage, stage_num, total_stages, details?}
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
);

CREATE TABLE search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_cache(search_id) ON DELETE CASCADE,
  offset_num INTEGER,
  results JSONB
);

-- ============================================
-- 7. LOGS DE OPERAÇÃO
-- ============================================

CREATE TABLE operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES monitored_locations(id),
  stage TEXT,
  urls_processed INTEGER,
  news_found INTEGER,
  cost_usd DECIMAL(10,6),
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_created ON operation_logs(created_at DESC);

-- ============================================
-- 8. RATE LIMITS CONFIGURÁVEIS (admin panel)
-- ============================================

CREATE TABLE api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'perplexity', 'brave', 'jina', 'openai')),
  max_concurrent INTEGER NOT NULL DEFAULT 5,
  min_time_ms INTEGER NOT NULL DEFAULT 100,
  daily_quota INTEGER,
  monthly_quota INTEGER,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  CONSTRAINT api_rate_limits_provider_unique UNIQUE (provider)
);

-- Valores iniciais
INSERT INTO api_rate_limits (provider, max_concurrent, min_time_ms, daily_quota, monthly_quota) VALUES
  ('google', 1, 100, 100, 3000),
  ('brave', 5, 100, 1000, NULL),
  ('jina', 10, 50, NULL, NULL),
  ('openai', 5, 200, NULL, NULL);

-- ============================================
-- 9. TRACKING DE BUDGET (read-only, automático)
-- ============================================

CREATE TABLE budget_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('auto_scan', 'manual_search')),
  provider TEXT NOT NULL CHECK (provider IN ('google', 'perplexity', 'brave', 'jina', 'openai')),
  cost_usd DECIMAL(10,6) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_budget_created ON budget_tracking(created_at DESC);

-- View para dashboard de budget
CREATE VIEW budget_summary AS
SELECT
  date_trunc('month', created_at) as month,
  source,
  provider,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as total_requests
FROM budget_tracking
GROUP BY date_trunc('month', created_at), source, provider;

-- ============================================
-- 10. SYSTEM CONFIG (configurável via admin panel)
-- ============================================
-- Todos os thresholds, limites e parâmetros centralizados aqui.
-- Admin panel lê/escreve via API.
-- Backend lê com cache de 5 minutos.

CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  value_type TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean')),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Valores iniciais
INSERT INTO system_config (key, value, description, category, value_type) VALUES
  ('dedup_similarity_threshold', '0.85', 'Threshold de similaridade coseno para deduplicação (camada 2)', 'pipeline', 'number'),
  ('filter2_confidence_min', '0.7', 'Confiança mínima da extração GPT para aceitar notícia', 'pipeline', 'number'),
  ('content_fetch_concurrency', '5', 'Máximo de fetches simultâneos por pipeline run', 'pipeline', 'number'),
  ('search_max_results', '15', 'URLs por query no monitoramento automatico', 'pipeline', 'number'),
  ('filter2_max_content_chars', '4000', 'Máximo de caracteres enviados ao GPT no filter2', 'pipeline', 'number'),
  ('monthly_budget_usd', '100', 'Limite mensal de gastos em USD', 'budget', 'number'),
  ('budget_warning_threshold', '0.9', 'Threshold de alerta de orçamento (0.0 a 1.0)', 'budget', 'number'),
  ('scan_cron_schedule', '*/5 * * * *', 'Expressão CRON para scans automáticos (requer restart)', 'scheduler', 'string'),
  ('worker_concurrency', '3', 'Máximo de scans em paralelo no worker (requer restart)', 'scheduler', 'number'),
  ('worker_max_per_minute', '10', 'Máximo de jobs por minuto no worker (requer restart)', 'scheduler', 'number'),
  ('scan_lock_ttl_minutes', '30', 'TTL do lock Redis para scans (minutos)', 'scheduler', 'number'),
  ('push_enabled', 'true', 'Habilitar/desabilitar push notifications', 'notifications', 'boolean'),
  ('auth_required', 'true', 'Se o app exige login para acessar', 'auth', 'boolean'),
  ('search_permission', 'authorized', 'Quem pode fazer buscas manuais: all ou authorized', 'auth', 'string'),
  -- Ingestão robusta - fontes configuráveis
  ('multi_query_enabled', 'true', 'Usar múltiplas variações de query na busca (além do mega prompt)', 'ingestion', 'boolean'),
  ('search_queries_per_scan', '2', 'Quantas queries por scan (1-5, rotação automática)', 'ingestion', 'number'),
  ('google_news_rss_enabled', 'true', 'Coleta via Google News RSS (gratuito)', 'ingestion', 'boolean'),
  ('filter0_regex_enabled', 'true', 'Filtro regex que bloqueia redes sociais e palavras nao-crime antes do GPT', 'ingestion', 'boolean'),
  -- Busca manual por período
  ('manual_search_max_results_30d', '50', 'URLs por query na busca manual — 30 dias', 'pipeline', 'number'),
  ('manual_search_max_results_60d', '50', 'URLs por query na busca manual — 60 dias', 'pipeline', 'number'),
  ('manual_search_max_results_90d', '80', 'URLs por query na busca manual — 90 dias', 'pipeline', 'number');

-- ============================================
-- 11. UX: Notícias lidas + Favoritos (FASE 8.5)
-- ============================================

-- Resumo agregado de múltiplas fontes
ALTER TABLE news ADD COLUMN IF NOT EXISTS resumo_agregado TEXT;

-- Sistema de notícias lidas por usuário
CREATE TABLE IF NOT EXISTS user_news_read (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_user_news_read ON user_news_read(user_id, news_id);

-- Favoritos por usuário
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  news_id UUID REFERENCES news(id) ON DELETE CASCADE,
  favorited_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, news_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites ON user_favorites(user_id);

-- ============================================
-- 12. LISTEN/NOTIFY - Event-Driven Push (FASE 2.5)
-- ============================================
-- Pipeline INSERT → Postgres NOTIFY → Listener → Push
-- Desacopla push do pipeline para maior confiabilidade.

CREATE OR REPLACE FUNCTION notify_new_news()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_news',
    json_build_object(
      'id', NEW.id,
      'tipo_crime', NEW.tipo_crime,
      'cidade', NEW.cidade,
      'bairro', NEW.bairro,
      'resumo', NEW.resumo
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER news_inserted_trigger
AFTER INSERT ON news
FOR EACH ROW
EXECUTE FUNCTION notify_new_news();

-- ============================================
-- 13. RELATÓRIOS EXPORTÁVEIS (FASE 2 - Feature Dashboard)
-- ============================================
-- Relatórios pré-computados com link público compartilhável.
-- Expira em 30 dias por padrão.

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_cache(search_id) ON DELETE SET NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  report_data JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_reports_expires ON reports(expires_at);

-- Índices compostos para queries de analytics
CREATE INDEX IF NOT EXISTS idx_news_cidade_tipo ON news(cidade, tipo_crime) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_news_cidade_data_tipo ON news(cidade, data_ocorrencia, tipo_crime) WHERE active = true;

-- ============================================
-- 14. URLs REJEITADAS PELO PIPELINE (dashboard)
-- ============================================
-- Armazena URLs filtradas em cada etapa do pipeline.
-- Retencao: 24h (limpeza automatica no inicio de cada scan).

CREATE TABLE IF NOT EXISTS pipeline_rejected_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  title TEXT,
  stage TEXT NOT NULL,
  reason TEXT,
  location_id UUID REFERENCES monitored_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rejected_created ON pipeline_rejected_urls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rejected_stage ON pipeline_rejected_urls(stage);
