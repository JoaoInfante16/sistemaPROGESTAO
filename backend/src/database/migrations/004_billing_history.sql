-- Billing History: stores monthly cost summaries
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month VARCHAR(7) NOT NULL UNIQUE,  -- '2026-04'
  total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
  total_scans INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB DEFAULT '{}',  -- { brightdata: 0.12, jina: 0.05, openai: 0.30 }
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_history_month ON billing_history(month DESC);
