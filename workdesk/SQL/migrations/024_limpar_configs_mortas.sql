-- ============================================
-- 024 — Limpar configs mortas de system_config
-- ============================================
-- 2026-08-02. Nenhuma destas chaves é lida pelo código de `develop`, e todas
-- existem no `DEFAULTS` hardcoded do configManager — inclusive na `main`, com os
-- MESMOS valores que estão no banco. Verificado em:
--   git show origin/main:backend/src/services/configManager/index.ts
--
-- Logo: apagar a linha faz o `get()` cair no default do código, e o
-- comportamento de produção NÃO muda. É limpeza de painel, não de lógica.
--
-- ⚠️ DESTRUTIVA (DELETE). Reversível: é só reinserir com o valor do DEFAULTS.

-- ------------------------------------------------------------------
-- Bloco 1 — mortas de verdade, ninguém lê (nem develop, nem main)
-- ------------------------------------------------------------------
-- main tem todas no DEFAULTS: '*/5 * * * *', '3', '10', '30', '0.9'
DELETE FROM system_config
WHERE key IN (
  'scan_cron_schedule',
  'worker_concurrency',
  'worker_max_per_minute',
  'scan_lock_ttl_minutes',
  'budget_warning_threshold'
);

-- ------------------------------------------------------------------
-- Bloco 2 — faixas de período, mortas desde a Fase 8.4
-- ------------------------------------------------------------------
-- `develop` não lê mais (o teto virou função contínua da base de 30 dias).
-- `main` LÊ, mas cai no DEFAULTS: 50 e 80 — os mesmos valores do banco.
-- ⚠️ Rodar só DEPOIS do deploy do backend da 8.4 em staging/produção.
DELETE FROM system_config
WHERE key IN (
  'manual_search_max_results_60d',
  'manual_search_max_results_90d'
);

-- ------------------------------------------------------------------
-- Bloco 3 — OPCIONAL, e resolve o conflito entre os ambientes
-- ------------------------------------------------------------------
-- Esta chave tem SIGNIFICADO DIFERENTE nas duas versões:
--   main    → teto de COLETA no stage 1
--   develop → teto de ANÁLISE, 0 = sem teto
-- Por isso não dá para escolher um número que sirva aos dois.
--
-- Apagar a linha resolve: cada código cai no SEU default.
--   produção (main)    → 50  = exatamente o comportamento de hoje
--   staging (develop)  → 0   = teto aberto, que é o que o João quer
--
-- Depois que `main` for promovida, os dois passam a ter a mesma semântica e a
-- chave pode voltar (pelo painel) se você quiser um teto explícito.
--
-- DELETE FROM system_config WHERE key = 'manual_search_max_results_30d';

-- Conferência
-- SELECT key, value FROM system_config ORDER BY key;
