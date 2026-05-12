-- v16.72 — uys_orders.state kolonu + uys_session_memory
-- Sipariş state machine: plan_bekliyor | uretilebilir | uretiliyor | tamamlandi | kapali | iptal
ALTER TABLE public.uys_orders ADD COLUMN IF NOT EXISTS state TEXT DEFAULT 'plan_bekliyor';

CREATE TABLE IF NOT EXISTS public.uys_session_memory (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
