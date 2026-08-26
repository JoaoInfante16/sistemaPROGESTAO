-- ============================================
-- Migration 035: fechar as QUATRO tabelas que a 025 deixou abertas
-- ============================================
-- Data: 2026-08-26
-- Status: ESCRITA. Ver o MIGRATIONS_LOG para o estado real — o cabecalho de
--         quatro .sql ja mentiu sobre isso em 26/08.
--
-- ACHADO (medido em 26/08 com a SUPABASE_ANON_KEY do proprio .env, e com caso
-- de controle: uma tabela inexistente devolveu PGRST205, entao a sonda vale):
--
--   reports             -> 200, 3 linhas. id, search_id, cidade, estado, datas
--   city_groups         -> 200, 2 linhas
--   city_group_members  -> 200, 3 linhas
--   billing_history     -> 200, 3 linhas. total_cost_usd, breakdown
--
-- E o grant do role `anon` nessas tabelas e
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER.
-- Ou seja: onde a RLS esta desligada nao existe trava NENHUMA. A chave anon e
-- publica por definicao — vai dentro do APK entregue ao cliente
-- (mobile-app/lib/core/config/env.dart) e no bundle JS do admin-panel.
--
-- `reports` e a pior das quatro: guarda o conteudo do relatorio que o cliente
-- manda para o cliente DELE (report_data em JSONB). `billing_history` entrega
-- custo e breakdown do negocio.
--
-- POR QUE ESTAS QUATRO ESCAPARAM DA 025:
-- a 025 fechou 13 tabelas e afirma, no proprio comentario (linha 65), que
-- "reports" ja tinha RLS ligada. **Nao tinha.** As outras tres nem sao citadas.
-- `city_groups`/`city_group_members` vieram depois (018) e ninguem voltou.
-- E o caso de manual da regra zero da workdesk: afirmacao dentro de um arquivo,
-- nunca medida, que vira segunda verdade.
--
-- POR QUE FECHAR NAO QUEBRA NADA (verificado em 26/08, nao herdado da 025):
--   - mobile-app: `grep -rn "\.from(" lib/` devolve ZERO. So `supabase.auth`.
--   - admin-panel: os unicos `supabase.*` sao auth.getSession, auth.getUser,
--     auth.onAuthStateChange, auth.signInWithPassword, auth.signOut. Os `.from(`
--     que aparecem no grep sao todos `Array.from(...)`, JavaScript puro.
--   - backend: usa SUPABASE_SERVICE_KEY, que faz BYPASS de RLS por design
--     (src/config/database.ts). Todo dado do app passa por ele.
--
-- Ligar RLS sem criar policy = ninguem entra pela chave publica, e todo caminho
-- que funciona hoje continua funcionando.
--
-- 🚨 RODAR NOS DOIS BANCOS (producao e o staging novo). Se rodar so no staging,
-- o furo continua exatamente onde importa.

-- ============================================
-- UP
-- ============================================

ALTER TABLE reports             ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_group_members  ENABLE ROW LEVEL SECURITY;

-- Sem CREATE POLICY, pelo mesmo motivo da 025: nenhuma policy = so a service
-- key (bypass) e o dono da tabela passam. `ENABLE` em tabela ja ligada e no-op,
-- entao rodar duas vezes e inofensivo.

-- ============================================
-- CONFERIR DEPOIS (o mesmo teste do achado, nos dois bancos)
-- ============================================
-- Esperado: [] nas quatro, em vez das linhas.
--
--   for t in reports billing_history city_groups city_group_members; do
--     curl -s "$SUPABASE_URL/rest/v1/$t?select=id" \
--          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   done
--
-- E abrir um relatorio pelo app (caminho pela service key) para confirmar que
-- nao mudou nada do lado de quem deveria enxergar.

-- ============================================
-- DOWN (reverter)
-- ============================================
-- ALTER TABLE reports             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE billing_history     DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE city_groups         DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE city_group_members  DISABLE ROW LEVEL SECURITY;
