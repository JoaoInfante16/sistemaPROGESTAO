-- Migration 003: Fix all database inconsistencies
-- Date: 2026-03-17
-- Status: APLICADO
-- Motivo: Schema foi aplicado em pedacos na Fase 1, gerando inconsistencias

-- UP

-- 1. Remove coluna duplicada scan_frequency_hours (codigo usa scan_frequency_minutes)
ALTER TABLE monitored_locations DROP COLUMN IF EXISTS scan_frequency_hours;

-- 2. Fix indice IVFFlat -> HNSW (funciona com 0 rows)
DROP INDEX IF EXISTS news_embedding_idx;
CREATE INDEX news_embedding_idx ON news USING hnsw (embedding vector_cosine_ops);

-- 3. Adicionar config search_permission que estava faltando
INSERT INTO system_config (key, value, description, category, value_type)
VALUES ('search_permission', 'authorized', 'Quem pode fazer buscas manuais: all ou authorized', 'auth', 'string')
ON CONFLICT (key) DO NOTHING;

-- DOWN
-- ALTER TABLE monitored_locations ADD COLUMN scan_frequency_hours INTEGER DEFAULT 1;
-- DROP INDEX IF EXISTS news_embedding_idx;
-- CREATE INDEX news_embedding_idx ON news USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- DELETE FROM system_config WHERE key = 'search_permission';
