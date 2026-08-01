-- ============================================
-- 021: toggle do ramo web da busca manual
-- ============================================
-- Contexto (2026-08-01): o ramo web da busca manual usa o indice ORGANICO do
-- Google via scraper da Bright Data. O tempo de coleta desse scraper explodiu
-- depois de 21/07 — snapshots da propria conta saltaram de 17-70s para 660-978s,
-- com variancia enorme (mesma cidade, 10 min de diferenca: 22s vs 667s).
--
-- Isso travava a busca manual no stage 1 e o usuario ficava olhando "1/7" ate
-- desistir — exatamente o sintoma que o cliente reportou.
--
-- Nao ha incidente publico da Bright Data nem do Google com essa data. A leitura
-- mais provavel e endurecimento do SearchGuard (anti-bot do Google) no indice
-- organico, que e a superficie mais raspada da internet. O indice de NOTICIAS
-- (tbm=nws) nao sofre disso: entrega ~30 resultados em ~50s de forma estavel.
--
-- Default FALSE: a busca roda so no ramo news, rapida e previsivel.
-- Ligar de volta se o cenario mudar. Medicoes em workdesk/AUDITORIA_2026-07-30.md.

INSERT INTO system_config (key, value, description, category, value_type)
VALUES (
  'manual_search_web_enabled',
  'false',
  'Ativa o ramo web (indice organico) na busca manual. Desligado em 2026-08-01: o scraper do Google passou a levar 11-16 min em vez de 17-70s. O ramo news continua sempre ativo.',
  'pipeline',
  'boolean'
)
ON CONFLICT (key) DO NOTHING;
