-- ============================================
-- Migration 011: Performance indexes
-- ============================================
-- Indexes para queries de analytics e dashboard

CREATE INDEX IF NOT EXISTS idx_news_analytics
  ON news(cidade, tipo_crime) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_operation_logs_location
  ON operation_logs(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_budget_tracking_provider
  ON budget_tracking(provider, created_at DESC);
