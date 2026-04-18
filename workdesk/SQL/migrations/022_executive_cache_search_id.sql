-- Fase 2: executive_cache ganha suporte a busca manual + TTL mais longo
--
-- Motivos:
-- 1) Busca manual (report_screen) hoje chama GPT a cada abertura do relatório.
--    Como a busca é imutável (resultados congelados), cache por search_id evita
--    recalcular. Primeira abertura = GPT + save. Próximas = cache hit.
--
-- 2) TTL 24h era agressivo. Cache de dashboard é invalidado por evento quando
--    chega estatística nova (invalidateExecutiveCacheByCity), então 24h só
--    gastava GPT à toa quando nada mudava. Extendido pra 30 dias como
--    garantia contra "estatísticas fantasma" que caem fora da janela móvel.
--
-- ORDEM DE APLICAÇÃO:
-- 1) Rodar esta migration primeiro (schema aceita nova coluna)
-- 2) Deploy backend novo depois (upsert com search_id e TTL 30d)
-- Código velho continua funcionando porque search_id é opcional.

-- UP

-- Nova coluna nullable pra chave de busca manual
ALTER TABLE executive_cache ADD COLUMN IF NOT EXISTS search_id UUID NULL;

-- Dropar unique antigo (só cobria cidade+estado+range_days)
ALTER TABLE executive_cache DROP CONSTRAINT IF EXISTS executive_cache_unique;

-- Dois uniques parciais pra cobrir os 2 modos de cache:
-- Dashboard (auto-scan): busca por cidade+estado+range_days, search_id = NULL
CREATE UNIQUE INDEX IF NOT EXISTS executive_cache_unique_dashboard
  ON executive_cache (cidade, estado, range_days)
  WHERE search_id IS NULL;

-- Busca manual: busca direta por search_id
CREATE UNIQUE INDEX IF NOT EXISTS executive_cache_unique_search
  ON executive_cache (search_id)
  WHERE search_id IS NOT NULL;

-- Index secundário pra lookups
CREATE INDEX IF NOT EXISTS executive_cache_search_lookup
  ON executive_cache (search_id)
  WHERE search_id IS NOT NULL;

-- DOWN
-- ALTER TABLE executive_cache DROP COLUMN IF EXISTS search_id;
-- DROP INDEX IF EXISTS executive_cache_unique_dashboard;
-- DROP INDEX IF EXISTS executive_cache_unique_search;
-- DROP INDEX IF EXISTS executive_cache_search_lookup;
-- ALTER TABLE executive_cache ADD CONSTRAINT executive_cache_unique UNIQUE (cidade, estado, range_days);
