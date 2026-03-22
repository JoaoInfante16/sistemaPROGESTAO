-- ============================================
-- Migration 007: Fix budget_tracking provider constraint
-- ============================================
-- O CHECK constraint limitava provider a ('google', 'jina', 'openai')
-- mas o codigo envia 'perplexity' como provider.
-- Causa do erro "Failed to track cost" em toda busca manual.

ALTER TABLE budget_tracking DROP CONSTRAINT IF EXISTS budget_tracking_provider_check;
ALTER TABLE budget_tracking ADD CONSTRAINT budget_tracking_provider_check
  CHECK (provider IN ('google', 'perplexity', 'jina', 'openai'));
