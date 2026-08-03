-- ============================================
-- Migration 026: rastrear rejeicoes da BUSCA MANUAL
-- ============================================
-- Data: 2026-08-03
-- Status: **NAO APLICADA** — aguarda autorizacao.
--         Aditiva e reversivel (ADD COLUMN nullable, sem default, sem backfill).
--         Nao afeta nenhuma leitura ou escrita existente.
--
-- POR QUE
--
-- `pipeline_rejected_urls` so guarda rejeicao do AUTO-SCAN, e amarra a linha a
-- `location_id` (FK para monitored_locations). A busca manual roda em cidade
-- que nao esta monitorada — Goiania, por exemplo — entao nao tem location_id
-- nenhum para gravar, e por isso o worker da busca manual apenas LOGA os
-- motivos e nao persiste.
--
-- Consequencia medida em 03/08: Goiania/30d levou 74 conteudos lidos para 27
-- extracoes. 47 artigos morreram no Filter2 e **nao ha como saber por que**
-- sem re-rodar o pipeline pagando Jina + GPT de novo (scripts/diagnostico-funil.ts
-- existe exatamente por causa dessa lacuna, e custa dinheiro toda vez).
--
-- O DADO JA EXISTE EM MEMORIA: `rejectedUrls[]` e preenchido por todos os
-- stages do worker e descartado no fim. Gravar e de graca.
--
-- O QUE MUDA
--
-- Uma coluna nullable. Linha do auto-scan continua com location_id preenchido
-- e search_id NULL; linha da busca manual, o inverso. Nenhuma linha existente
-- e tocada.

ALTER TABLE pipeline_rejected_urls
  ADD COLUMN IF NOT EXISTS search_id UUID;

-- Consultar "as rejeicoes da busca X" sem varrer a tabela inteira.
CREATE INDEX IF NOT EXISTS idx_rejected_search
  ON pipeline_rejected_urls(search_id)
  WHERE search_id IS NOT NULL;

-- ============================================
-- VERIFICACAO (rodar depois)
-- ============================================
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'pipeline_rejected_urls'
--      AND column_name = 'search_id';
--
-- Esperado: uma linha, uuid, YES.
--
-- Depois da proxima busca manual, o funil sai com uma query so:
--
--   SELECT stage, reason, count(*)
--     FROM pipeline_rejected_urls
--    WHERE search_id = '<id da busca>'
--    GROUP BY stage, reason
--    ORDER BY count(*) DESC;
--
-- ============================================
-- ROLLBACK
-- ============================================
--
--   DROP INDEX IF EXISTS idx_rejected_search;
--   ALTER TABLE pipeline_rejected_urls DROP COLUMN IF EXISTS search_id;
