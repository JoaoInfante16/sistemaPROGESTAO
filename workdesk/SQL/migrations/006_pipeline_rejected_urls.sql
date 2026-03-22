-- ============================================
-- Migration 006: Criar tabela pipeline_rejected_urls
-- ============================================
-- Tabela para dashboard de URLs rejeitadas pelo pipeline.
-- Retencao: 24h (limpeza automatica no inicio de cada scan).
-- Ja estava definida no schema.sql mas nunca criada no Supabase.

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

-- RLS: permitir leitura para usuarios autenticados, escrita via service_key
ALTER TABLE pipeline_rejected_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read rejected urls"
  ON pipeline_rejected_urls FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert rejected urls"
  ON pipeline_rejected_urls FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can delete rejected urls"
  ON pipeline_rejected_urls FOR DELETE
  TO service_role
  USING (true);
