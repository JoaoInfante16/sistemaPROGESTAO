-- ============================================
-- Migration 025: fechar o banco para a chave anon
-- ============================================
-- Data: 2026-08-02
-- Status: **NAO APLICADA** — precisa de autorizacao explicita do Joao.
--         Afeta staging E producao na hora (banco compartilhado).
--
-- ACHADO (medido em 02/08, com a SUPABASE_ANON_KEY do proprio .env):
--
--   GET  /rest/v1/user_profiles?select=id,is_admin  -> 200 com a lista inteira
--   GET  /rest/v1/news | search_cache | budget_tracking | system_config | ...
--                                                   -> 200 com dados
--   POST /rest/v1/system_config  (payload vazio)    -> 400 com codigo 23502
--
-- O 23502 e "null value violates not-null constraint": a requisicao passou
-- pela RLS e morreu na validacao do Postgres. Ou seja, **a escrita tambem
-- estava liberada** — um payload valido teria gravado. Nada foi gravado no
-- teste (os tres INSERTs falharam por NOT NULL).
--
-- A chave anon e PUBLICA por definicao: esta dentro do APK entregue ao cliente
-- (mobile-app/lib/core/config/env.dart) e no bundle JS do admin-panel.
--
-- POR QUE FECHAR NAO QUEBRA NADA (verificado, nao suposto):
--   - mobile-app: usa Supabase so em `auth` (grep por `.from(` no lib/ nao
--     acha nenhum acesso a tabela). Todos os dados vem do backend.
--   - admin-panel: idem — `supabase.auth.*` e so isso (use-auth.ts,
--     middleware.ts). Nenhum `supabase.from(...)`.
--   - backend: usa SUPABASE_SERVICE_KEY, que faz BYPASS de RLS por design.
--
-- Entao ligar RLS **sem criar policy nenhuma** = ninguem entra pela chave
-- publica, e tudo que funciona hoje continua funcionando.
--
-- DEPOIS DE APLICAR, CONFERIR (o mesmo teste do achado):
--   curl "$SUPABASE_URL/rest/v1/user_profiles?select=id" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   Esperado: [] em vez da lista.
--   E rodar uma busca manual pelo app + abrir o feed, para confirmar que o
--   caminho pela service key nao mudou.

-- ============================================
-- UP
-- ============================================

ALTER TABLE user_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE news                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache         ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_results       ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_tracking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_news_read       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits      ENABLE ROW LEVEL SECURITY;

-- Sem CREATE POLICY de proposito: nenhuma policy = ninguem passa, exceto a
-- service key (bypass) e o dono da tabela. E exatamente o desenho atual do
-- sistema, onde todo acesso a dado e mediado pelo backend.
--
-- Tabelas que ja tinham RLS ligada (nao repetir): pipeline_rejected_urls
-- (migration 006), user_favorites e reports — o teste de 02/08 mostrou as duas
-- primeiras devolvendo [] com a anon key. `ENABLE` em tabela que ja esta ligada
-- e no-op, entao a lista acima e segura mesmo com sobreposicao.
--
-- Se alguma tabela nao existir neste banco, o ALTER falha e aborta a transacao:
-- rodar bloco a bloco no SQL Editor, ou remover a linha da tabela ausente.

-- ============================================
-- DOWN (reverter)
-- ============================================
-- ALTER TABLE user_profiles        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE news                 DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE news_sources         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_cache         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE search_results       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE monitored_locations  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE system_config        DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE budget_tracking      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE operation_logs       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_devices         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_news_read       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_favorites       DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_rate_limits      DISABLE ROW LEVEL SECURITY;
