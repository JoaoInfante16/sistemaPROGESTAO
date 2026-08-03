-- ============================================
-- 027 — OpenAI: concorrencia de 5 para 20
-- ============================================
--
-- MOTIVADOR (medido em 03/08, ao dimensionar a busca com a taxonomia inteira):
--
-- `api_rate_limits.openai.max_concurrent = 5` e o gargalo mais apertado do
-- sistema. Ele estrangula o estagio 5 (Filter2 + embedding), que e onde a busca
-- manual passa mais tempo depois do Jina:
--
--   17 assuntos / 180 dias / capital  ->  ~450 artigos no Filter2
--   com 5 concorrentes e 200ms de intervalo  ->  ~6 min
--   com 20 concorrentes e 50ms                ->  ~1,5 min
--
-- E o mesmo Bottleneck e COMPARTILHADO com o auto-scan, que roda 24/7 no mesmo
-- processo: hoje uma busca manual longa deixa o scan do cliente na fila o tempo
-- todo dela.
--
-- POR QUE E SEGURO: 5 nunca foi um limite da OpenAI, foi um chute conservador
-- do inicio do projeto (a linha e de 2026-02-08 e nunca foi revisada). O limite
-- real da conta e ordens de grandeza maior — o modelo em uso e o `gpt-4o-mini`,
-- cujo tier mais baixo ja permite milhares de requisicoes por minuto. O
-- `min_time_ms` de 50 mantem um piso de espacamento.
--
-- ⚠️ AFETA PRODUCAO NA HORA. `api_rate_limits` e lida pelo mesmo banco
-- compartilhado, sem deploy no meio — a `main` le esta tabela igual. O efeito
-- para producao e SO acelerar: nenhuma logica muda, nenhuma noticia e
-- descartada, so para de esperar. Autorizado pelo Joao em 03/08.
--
-- NAO CONFUNDIR com o teto de analise (`manual_search_analysis_cap`), que
-- continua em 0 = SEM TETO por decisao de 02/08. Aquele corta artigo dentro da
-- janela (com cota 50, 142 candidatos viravam 50 — ver Fase 8/ROADMAP.md:133).
-- Este aqui nao descarta nada, so aumenta a vazao.

UPDATE api_rate_limits
   SET max_concurrent = 20,
       min_time_ms    = 50,
       updated_at     = NOW()
 WHERE provider = 'openai';

-- Verificacao (deve devolver 20 / 50):
--   SELECT provider, max_concurrent, min_time_ms FROM api_rate_limits
--    WHERE provider = 'openai';

-- ROLLBACK:
--   UPDATE api_rate_limits SET max_concurrent = 5, min_time_ms = 200
--    WHERE provider = 'openai';
