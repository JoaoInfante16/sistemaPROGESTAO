-- ============================================
-- Migration 010: Reset all data for Fase 4
-- ============================================
-- Limpa dados de teste. Mantém estrutura, configs e users.

-- Ordem importa (foreign keys)
TRUNCATE TABLE news_sources CASCADE;
TRUNCATE TABLE search_results CASCADE;
TRUNCATE TABLE search_cache CASCADE;
TRUNCATE TABLE pipeline_rejected_urls CASCADE;
TRUNCATE TABLE operation_logs CASCADE;
TRUNCATE TABLE budget_tracking CASCADE;
TRUNCATE TABLE news CASCADE;
TRUNCATE TABLE user_news_read CASCADE;
TRUNCATE TABLE user_favorites CASCADE;

-- NÃO truncar:
-- monitored_locations (cidades configuradas)
-- user_devices (tokens de push)
-- user_profiles (usuarios)
-- system_config (configs do admin)
-- api_rate_limits (configs de rate limit)
