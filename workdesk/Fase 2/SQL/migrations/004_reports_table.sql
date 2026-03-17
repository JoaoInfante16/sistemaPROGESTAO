-- Migration 004: Tabela de relatórios + índices para analytics
-- Data: 2026-03-17
-- Descrição: Cria tabela reports para dashboards compartilháveis
--            e índices compostos para queries de analytics

-- Tabela de relatórios gerados (link público compartilhável)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID REFERENCES search_cache(search_id) ON DELETE SET NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  report_data JSONB NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE INDEX IF NOT EXISTS idx_reports_expires ON reports(expires_at);

-- Índices compostos para queries de analytics (crime summary, trends)
CREATE INDEX IF NOT EXISTS idx_news_cidade_tipo ON news(cidade, tipo_crime) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_news_cidade_data_tipo ON news(cidade, data_ocorrencia, tipo_crime) WHERE active = true;
