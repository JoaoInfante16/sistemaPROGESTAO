-- ============================================
-- Migration 012: Garantir configs de busca manual + fix default search_max_results
-- ============================================
-- A migration 009 pode nao ter sido rodada apos o reset (010).
-- Esta migration garante que os configs existam no banco.

-- Fix: search_max_results default = 15 (configManager usa 15, schema antigo usava 10)
UPDATE system_config SET value = '15' WHERE key = 'search_max_results' AND value = '10';

-- Garantir que configs de busca manual existam
INSERT INTO system_config (key, value, description, category, value_type)
VALUES
  ('manual_search_max_results_30d', '50', 'URLs por query na busca manual — 30 dias', 'pipeline', 'number'),
  ('manual_search_max_results_60d', '50', 'URLs por query na busca manual — 60 dias', 'pipeline', 'number'),
  ('manual_search_max_results_90d', '80', 'URLs por query na busca manual — 90 dias', 'pipeline', 'number')
ON CONFLICT (key) DO NOTHING;
