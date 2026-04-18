-- Fase 2: Tabela executive_cache
-- Cache por cidade+estado+range_days do resumo executivo gerado via GPT
-- a partir das estatísticas do período.
--
-- Por que cache separado: dashboard regenera muito (cada view do user) e o
-- relatório executivo é caro (chamada GPT). Invalidação é por evento (pipeline
-- dispara quando salva nova notícia natureza='estatistica') + TTL 24h como
-- fallback pra capturar saída de estatísticas antigas pela janela móvel.
--
-- UP

CREATE TABLE IF NOT EXISTS executive_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  range_days INT NOT NULL, -- 30, 60, 90 tipicamente
  data JSONB NOT NULL,     -- { indicadores: [...], resumo_complementar: string, fontes: [...] }
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- generated_at + 24h (TTL fallback)

  CONSTRAINT executive_cache_unique UNIQUE (cidade, estado, range_days)
);

CREATE INDEX IF NOT EXISTS executive_cache_lookup ON executive_cache (cidade, estado, range_days);
CREATE INDEX IF NOT EXISTS executive_cache_expires ON executive_cache (expires_at);

-- DOWN
-- DROP TABLE IF EXISTS executive_cache;
