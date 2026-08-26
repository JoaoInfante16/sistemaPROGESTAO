-- ============================================
-- 032 — Preferencias de notificacao por usuario
-- ============================================
-- Data: 2026-08-11
-- Status: APLICADA em 16/08. Verificado em 26/08: user_notification_prefs existe,
--         com a coluna estatisticas.
--
-- POR QUE
-- Hoje o push vai para TODOS os aparelhos ativos, sem filtro nenhum:
-- `pushService.ts` seleciona `user_devices` por `last_seen` e manda. Nao existe
-- preferencia por usuario, por cidade nem por assunto. O cliente de
-- Florianopolis recebe push de Porto Alegre, e "homicidios cairam 12%"
-- (natureza = estatistica) chega com a mesma urgencia de "homicidio no Centro".
--
-- Medido em 11/08, ultimos 21 dias: 30 noticias, media 2,0/dia, pico 5, e
-- **4 aparelhos registrados**. Nao ha problema de volume — ha problema de
-- relevancia. Por isso esta migration traz preferencia e NAO traz digest.
--
-- NULL = TUDO, E ISSO E O PONTO
-- `cidades` e `categorias` nulos significam "todas". Quem ja tem aparelho
-- registrado continua recebendo exatamente o que recebe hoje, ate abrir a tela
-- de notificacoes pela primeira vez. **Migration nao pode calar ninguem em
-- silencio** — um usuario que para de receber alerta sem ter pedido nao vai
-- reclamar, vai so achar que o produto parou de funcionar.
--
-- Array e nao tabela de juncao: sao no maximo algumas dezenas de cidades por
-- usuario, sempre lidas inteiras, nunca cruzadas em relatorio. Tabela de
-- juncao aqui seria normalizacao que ninguem usa.

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- NULL = todas as cidades. Array vazio = nenhuma (o usuario desmarcou tudo,
  -- que e diferente de nunca ter escolhido).
  cidades TEXT[] DEFAULT NULL,

  -- NULL = todos os assuntos. Valores: seguranca, patrimonial, operacional,
  -- fraude, institucional (ver `taxonomia.ts`, que e a fonte).
  categorias TEXT[] DEFAULT NULL,

  -- Noticia com `natureza = 'estatistica'` e numero/balanco, nao ocorrencia.
  -- Sai ligada pra nao mudar o comportamento de quem ja usa.
  estatisticas BOOLEAN NOT NULL DEFAULT true,

  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON COLUMN user_notification_prefs.cidades IS
  'NULL = todas. Array vazio = nenhuma. A diferenca importa: NULL e "nunca escolheu".';

-- ============================================
-- VERIFICACAO (rodar depois)
-- ============================================
-- Esperado: a tabela existe e esta vazia (ninguem escolheu ainda).
--
-- SELECT count(*) FROM user_notification_prefs;
--
-- E o teste que importa de verdade: um usuario SEM linha aqui tem que
-- continuar recebendo push de tudo.

-- ============================================
-- DOWN
-- ============================================
-- DROP TABLE IF EXISTS user_notification_prefs;
