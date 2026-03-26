-- ============================================
-- Migration 009: Configs de max_results por período
-- ============================================
-- Auto-scan: search_max_results (já existe, atualizar pra 15)
-- Busca manual: configs separadas por periodo (30d, 60d, 90d)

-- Atualizar auto-scan pra 15 (era 10)
UPDATE system_config SET value = '15' WHERE key = 'search_max_results';
UPDATE system_config SET description = 'URLs por query no monitoramento automatico (CRON)' WHERE key = 'search_max_results';

-- Busca manual por período
INSERT INTO system_config (key, value, description, category, value_type)
VALUES
  ('manual_search_max_results_30d', '50', 'URLs por query na busca manual — 30 dias', 'pipeline', 'number'),
  ('manual_search_max_results_60d', '50', 'URLs por query na busca manual — 60 dias', 'pipeline', 'number'),
  ('manual_search_max_results_90d', '80', 'URLs por query na busca manual — 90 dias', 'pipeline', 'number')
ON CONFLICT (key) DO NOTHING;
