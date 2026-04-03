-- ============================================
-- Migration 016: Adicionar Bright Data como provider
-- ============================================
-- Bright Data SERP API substitui Brave como provider principal de busca.
-- $0.0015/request vs Brave $0.005/query.

-- Atualizar CHECK constraint de api_rate_limits
ALTER TABLE api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_provider_check;
ALTER TABLE api_rate_limits ADD CONSTRAINT api_rate_limits_provider_check
  CHECK (provider IN ('google', 'perplexity', 'brave', 'brightdata', 'jina', 'openai'));

-- Atualizar CHECK constraint de budget_tracking
ALTER TABLE budget_tracking DROP CONSTRAINT IF EXISTS budget_tracking_provider_check;
ALTER TABLE budget_tracking ADD CONSTRAINT budget_tracking_provider_check
  CHECK (provider IN ('google', 'perplexity', 'brave', 'brightdata', 'jina', 'openai'));

-- Inserir rate limit para brightdata
INSERT INTO api_rate_limits (provider, max_concurrent, min_time_ms, daily_quota, monthly_quota)
VALUES ('brightdata', 10, 100, NULL, NULL)
ON CONFLICT (provider) DO NOTHING;
