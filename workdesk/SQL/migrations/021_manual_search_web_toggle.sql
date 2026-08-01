-- ============================================
-- 021: toggle do ramo web da busca manual
-- ============================================
-- O ramo web usa o indice ORGANICO do Google — portais locais, sites de
-- prefeitura, comunicados de policia. Conteudo que NAO aparece no indice de
-- noticias (tbm=nws), e que era justamente o valor do antigo "Top 100".
--
-- Historico (2026-08-01):
--   Esse ramo usava o scraper de dataset da Bright Data. O tempo de coleta dele
--   saltou de 17-70s (ate 21/07) para 660-978s, travando a busca manual no
--   stage 1 — o sintoma que o cliente reportou. Migramos o ramo para a SERP API
--   sincrona (a mesma que o ramo news usa), que serve o MESMO indice organico
--   em 4-19s por pagina. Medido em 5/5 tentativas: 24-27 resultados cada.
--
-- Default TRUE: o ramo web fica ativo. Se um dia voltar a degradar, desligar
-- aqui ou pelo admin (Configuracoes > Busca Manual) — a busca segue funcionando
-- so com o ramo news, que e o alicerce (~30 resultados, estavel).
--
-- Medicoes completas em workdesk/AUDITORIA_2026-07-30.md.

INSERT INTO system_config (key, value, description, category, value_type)
VALUES (
  'manual_search_web_enabled',
  'true',
  'Ativa o ramo web (indice organico) na busca manual — portais locais e comunicados que nao entram no indice de noticias. Desligar se a fonte degradar; a busca continua funcionando so com noticias.',
  'pipeline',
  'boolean'
)
ON CONFLICT (key) DO NOTHING;
