-- Migration 005: Search Progress Tracking
-- Adiciona coluna progress para rastrear etapa do pipeline
-- Estende retencao de 24h para 7 dias (historico util)

ALTER TABLE search_cache ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT NULL;

COMMENT ON COLUMN search_cache.progress IS 'Pipeline stage: {stage, stage_num, total_stages, details?}';

-- Nota: para buscas futuras, expires_at sera NOW() + 7 days (alterado no backend createSearchCache)
-- Buscas existentes mantem 24h original
