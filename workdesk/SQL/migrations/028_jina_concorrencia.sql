-- ============================================
-- 028 — Jina: concorrencia de 10 para 20
-- ============================================
--
-- MOTIVADOR (medido em 03/08, na busca de Goiania com 17 assuntos):
--
--   Filter1     619 snippets ....   7s
--   Jina        393 artigos ..... 327s   <-- 63% do tempo da busca
--   Filter2     .................. 188s
--
-- Com a taxonomia inteira virando query, o estagio 4 voltou a ser o gargalo.
-- 393 artigos a 10 por vez, ~8,3s cada, dao os 327s. A 20 por vez: ~165s.
--
-- ⚠️ SAO DOIS LIMITADORES EM SERIE, e subir so um NAO acelera nada:
--   1. `manual_search_fetch_concurrency` (o asyncPool) — vai a 20 no codigo,
--      no mesmo commit desta migration
--   2. `api_rate_limits.jina.max_concurrent` — esta migration
-- Foi exatamente o erro inverso de 02/08: o pool estava em 5 com o rate limiter
-- ja em 10, e metade da vazao permitida ficava parada na mesa.
--
-- ⚠️ PRE-REQUISITO JA FEITO: `JinaContentFetcher` passou a tratar 429 com
-- `Retry-After` (commit desta mesma data). Antes disso, um 429 virava excecao,
-- NAO entrava na lista de fallback (422/503/SSL/403) e o artigo era perdido em
-- SILENCIO. Subir concorrencia sem isso trocaria lentidao por noticia faltando
-- — que e pior, porque nao aparece em lugar nenhum.
--
-- ⚠️ AFETA PRODUCAO NA HORA (banco compartilhado). O efeito e so acelerar; o
-- `content_fetch_concurrency` do auto-scan continua em 5 e nao e tocado aqui.
--
-- SE APARECER MUITO 429 NO LOG (`[Jina] 429 em ...`): o teto real depende do
-- plano contratado do Jina, que nao esta no repo. Com o retry no lugar, um 429
-- custa ~2s e nao perde o artigo — entao a forma segura de achar o teto e subir
-- e observar, e nao adivinhar. Rollback abaixo.

UPDATE api_rate_limits
   SET max_concurrent = 20,
       updated_at     = NOW()
 WHERE provider = 'jina';

-- Verificacao (deve devolver 20):
--   SELECT provider, max_concurrent, min_time_ms FROM api_rate_limits
--    WHERE provider = 'jina';

-- ROLLBACK:
--   UPDATE api_rate_limits SET max_concurrent = 10 WHERE provider = 'jina';
