-- Fase 2: adicionar coluna `estado` em news
-- Motivo: bug de mistura de cidades homonimas (São José/SC vs São José/SP).
-- Sem estado, o feed nao tinha como distinguir cidades com mesmo nome em estados diferentes.
-- Nullable pra backfill gradual; notícias antigas ficam NULL e podem ser limpas na migration de reset.

-- UP
ALTER TABLE news ADD COLUMN IF NOT EXISTS estado TEXT;

CREATE INDEX IF NOT EXISTS idx_news_cidade_estado ON news(cidade, estado) WHERE active = true;

-- DOWN
-- DROP INDEX IF EXISTS idx_news_cidade_estado;
-- ALTER TABLE news DROP COLUMN IF EXISTS estado;
