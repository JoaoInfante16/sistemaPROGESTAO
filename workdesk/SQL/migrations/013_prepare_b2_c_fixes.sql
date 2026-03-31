-- ============================================
-- Migration 013: Auditoria + Preparacao Blocos B2 e C
-- ============================================
-- Corrige problemas encontrados na auditoria de migrations.
-- Prepara colunas necessarias para Bloco B2 (tipos de crime) e Bloco C (Flutter auth).
-- Idempotente: pode rodar multiplas vezes sem erro.

-- ============================================
-- PARTE 1: Fixes da auditoria
-- ============================================

-- 1a. api_rate_limits: adicionar UNIQUE no provider (necessario pro ON CONFLICT)
ALTER TABLE api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_provider_unique;
ALTER TABLE api_rate_limits ADD CONSTRAINT api_rate_limits_provider_unique UNIQUE (provider);

-- 1b. api_rate_limits: garantir que brave exista
INSERT INTO api_rate_limits (provider, max_concurrent, min_time_ms, daily_quota, monthly_quota)
VALUES ('brave', 5, 100, 1000, NULL)
ON CONFLICT (provider) DO NOTHING;

-- 1c. Limpar provider legado (perplexity foi substituido por brave)
DELETE FROM api_rate_limits WHERE provider = 'perplexity';

-- 1c. scan_cron_schedule: corrigir de 1x/hora pra cada 5min
-- O CRON precisa acordar frequentemente pra checar se alguma cidade precisa de scan.
-- A frequencia real de cada cidade e controlada por scan_frequency_minutes.
UPDATE system_config SET value = '*/5 * * * *' WHERE key = 'scan_cron_schedule' AND value = '0 * * * *';

-- 1d. manual_search_max_results_30d: corrigir valor errado (15 → 50)
UPDATE system_config SET value = '50' WHERE key = 'manual_search_max_results_30d' AND value = '15';

-- 1e. Limpar configs de features removidas (SSP/Section Crawler)
DELETE FROM system_config WHERE key IN (
  'section_crawling_enabled',
  'section_crawling_max_domains',
  'ssp_scraping_enabled'
);

-- 1f. CASCADE no parent_id de monitored_locations
-- Se deletar um estado, as cidades filhas sao deletadas junto.
-- Separado em dois statements pra seguranca.
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- Encontrar o nome real da constraint
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'monitored_locations'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'parent_id';

  -- Dropar se existir
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE monitored_locations DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE monitored_locations
  ADD CONSTRAINT monitored_locations_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES monitored_locations(id) ON DELETE CASCADE;

-- ============================================
-- PARTE 2: Bloco B2 — Tipos de crime padronizados
-- ============================================

-- 2a. Coluna natureza: diferencia ocorrencia individual de estatistica agregada
-- Ocorrencia: "roubo na loja X dia 15/03"
-- Estatistica: "roubos sobem 20% no bairro Y"
ALTER TABLE news ADD COLUMN IF NOT EXISTS natureza TEXT DEFAULT 'ocorrencia';

-- Constraint separada pra ser idempotente (ADD COLUMN IF NOT EXISTS nao repete CHECK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'news_natureza_check'
  ) THEN
    ALTER TABLE news ADD CONSTRAINT news_natureza_check
      CHECK (natureza IN ('ocorrencia', 'estatistica'));
  END IF;
END $$;

-- 2b. Coluna categoria_grupo: agrupamento para gerenciamento de risco corporativo
-- Patrimonial: roubo/furto, vandalismo, invasao
-- Seguranca: homicidio, latrocinio, lesao corporal
-- Operacional: trafico, operacao policial, manifestacao, bloqueio de via
-- Fraude: estelionato, receptacao
-- Institucional: crime ambiental, trabalho irregular, outros
ALTER TABLE news ADD COLUMN IF NOT EXISTS categoria_grupo TEXT DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'news_categoria_grupo_check'
  ) THEN
    ALTER TABLE news ADD CONSTRAINT news_categoria_grupo_check
      CHECK (categoria_grupo IN ('patrimonial', 'seguranca', 'operacional', 'fraude', 'institucional'));
  END IF;
END $$;

-- ============================================
-- PARTE 3: Bloco C — Flutter auth (troca de senha)
-- ============================================

-- Flag must_change_password: marcada true quando admin cria usuario ou reseta senha.
-- Flutter checa apos login e redireciona pra tela de troca de senha.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
