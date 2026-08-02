-- ============================================
-- 023 — Busca manual: teto de análise ABERTO + limpeza das faixas
-- ============================================
-- Fase 8.4 (2026-08-02). Decisão do João: "vamos deixar o teto de análise aberto".
--
-- O teto deixou de ser por faixa de período. `manual_search_max_results_30d`
-- passa a ser a BASE (artigos que valem 30 dias de janela) e todo outro período
-- escala dela por raiz quadrada, no código. `0` = SEM TETO.
--
-- As faixas `_60d` e `_90d` não são mais lidas pelo backend desde o commit da
-- 8.4 e saíram do painel admin. Ficam aqui como DELETE opcional, comentado —
-- rodar só depois que o backend estiver deployado, pra não haver janela em que
-- uma versão antiga leia config inexistente.
--
-- NÃO É DESTRUTIVA: só altera valor e descrição de uma linha de configuração.
-- Reversível com um UPDATE de volta pra '50'.

UPDATE system_config
SET value = '0',
    description = 'BASE de artigos analisados na busca manual (equivale a 30 dias). Outros periodos escalam por raiz quadrada, sem faixas. 0 = SEM TETO',
    updated_at = NOW()
WHERE key = 'manual_search_max_results_30d';

-- Horizonte do balde "fora do período" (Fase 8.2). Casado com o teto de 180 dias
-- da validação: nada mais velho que 6 meses entra, qualquer que seja a busca.
INSERT INTO system_config (key, value, description, category, value_type)
VALUES (
  'manual_search_horizon_days',
  '180',
  'Ate quantos dias atras aceitar noticia como "fora do periodo" em vez de descartar',
  'pipeline',
  'number'
)
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------
-- OPCIONAL — rodar só APÓS o deploy do backend da 8.4.
-- Configs mortas desde que o teto deixou de ser por faixa.
-- ------------------------------------------------------------------
-- DELETE FROM system_config
-- WHERE key IN ('manual_search_max_results_60d', 'manual_search_max_results_90d');

-- Conferência
-- SELECT key, value, description FROM system_config WHERE key LIKE 'manual_search%';
