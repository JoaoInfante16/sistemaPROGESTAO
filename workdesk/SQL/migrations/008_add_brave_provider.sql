-- ============================================
-- Migration 008: Add 'brave' to provider constraints
-- ============================================
-- Novo search provider: Brave News Search API
-- 50 resultados/query, $0.005/query, date range customizado

-- budget_tracking
ALTER TABLE budget_tracking DROP CONSTRAINT IF EXISTS budget_tracking_provider_check;
ALTER TABLE budget_tracking ADD CONSTRAINT budget_tracking_provider_check
  CHECK (provider IN ('google', 'perplexity', 'brave', 'jina', 'openai'));

-- api_rate_limits
ALTER TABLE api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_provider_check;
ALTER TABLE api_rate_limits ADD CONSTRAINT api_rate_limits_provider_check
  CHECK (provider IN ('google', 'perplexity', 'brave', 'jina', 'openai'));

-- Inserir config de rate limit para Brave
INSERT INTO api_rate_limits (provider, max_concurrent, min_time_ms, daily_quota, monthly_quota)
VALUES ('brave', 5, 100, 1000, NULL)
ON CONFLICT DO NOTHING;
