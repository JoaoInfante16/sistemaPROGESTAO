-- ============================================
-- 033 — Relatorio compartilhado para de expirar
-- ============================================
-- Data: 2026-08-12
-- Status: APLICADA em 16/08. Verificado em 26/08: 20 relatorios, 0 com expires_at
--         preenchido.
--
-- POR QUE
-- `reports.expires_at` nasceu com `NOW() + INTERVAL '30 days'`, e
-- `getReport()` (analyticsQueries.ts) recusa qualquer linha vencida. Ou seja:
-- no dia 31 o link que o cliente arquivou vira "Relatorio indisponivel", em
-- silencio, sem nada ter sido apagado — **nenhuma rotina deleta linha de
-- `reports`**, elas continuam todas la, so inalcancaveis.
--
-- Isso fazia sentido quando o relatorio era um link descartavel gerado no
-- painel. Deixou de fazer na Fase E2 (12/08): o documento virou peca de
-- apresentacao, desenhada pra chegar no cliente do cliente, e uma peca de
-- apresentacao que expira sozinha e um vexame agendado — quem abre em outubro
-- o link que recebeu em agosto conclui que o produto quebrou.
--
-- O CUSTO DE NAO EXPIRAR
-- Uma linha de `reports` e um JSONB de ~20-60 KB (contagens + mapPoints
-- geocodados). No ritmo atual, dezenas por mes. Guardar isso por anos custa
-- alguns MB — e barato o suficiente pra nao valer uma politica de expurgo.
-- Se um dia valer, a coluna continua aqui e basta voltar a preencher.
--
-- POR QUE NULL E NAO UMA DATA LONGE
-- Data longe (2099) e a mesma armadilha adiada, e mente pra quem le a tabela.
-- `NULL` diz o que e: **este relatorio nao expira**. A leitura em
-- `getReport()` foi ajustada no mesmo commit pra tratar nulo como "vale".
--
-- REVERSAO
--   ALTER TABLE reports ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '30 days';
--   UPDATE reports SET expires_at = created_at + INTERVAL '30 days' WHERE expires_at IS NULL;
-- ============================================

-- 1. Relatorio novo nasce sem prazo.
ALTER TABLE reports ALTER COLUMN expires_at DROP DEFAULT;

-- 2. Os que ja existem param de vencer.
--    Inclui os JA vencidos: eles nunca foram apagados, so estavam inalcancaveis,
--    e um link antigo que volta a abrir e melhor que um link antigo que nao abre.
UPDATE reports SET expires_at = NULL;

-- 3. OPCIONAL, e comentado de proposito.
--    `idx_reports_expires` fica sem serventia — nada mais filtra por essa
--    coluna. E so custo de escrita, e pequeno. Fica comentado porque `DROP` e
--    verbo destrutivo e esta migration nao precisa de nenhum: rodar sem este
--    bloco resolve o problema inteiro. Se um dia quiser, e reversivel:
--      CREATE INDEX idx_reports_expires ON reports(expires_at);
--
-- DROP INDEX IF EXISTS idx_reports_expires;

-- Conferencia:
--   SELECT count(*) FILTER (WHERE expires_at IS NULL) AS sem_prazo,
--          count(*) AS total
--   FROM reports;
