-- ============================================================================
-- IS EMRI #14 — Faz A — Migration 001 (v2)
-- ============================================================================
-- DUZELTME: order_id tipi uuid -> text (uys_orders.id text oldugu icin)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.uys_mrp_state_global (
  id           smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brut_ihtiyac jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_eksik    jsonb NOT NULL DEFAULT '{}'::jsonb,
  detay        jsonb,
  invalidated  boolean NOT NULL DEFAULT true,
  hesaplandi   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.uys_mrp_state_global IS
  'Global MRP cache (sirket geneli brut ihtiyac + net eksik). Singleton, id=1.';

INSERT INTO public.uys_mrp_state_global (id, invalidated, hesaplandi)
VALUES (1, true, NULL)
ON CONFLICT (id) DO NOTHING;


CREATE TABLE IF NOT EXISTS public.uys_mrp_state_order (
  order_id     text PRIMARY KEY REFERENCES public.uys_orders(id) ON DELETE CASCADE,
  brut_ihtiyac jsonb NOT NULL DEFAULT '{}'::jsonb,
  net_eksik    jsonb NOT NULL DEFAULT '{}'::jsonb,
  detay        jsonb,
  invalidated  boolean NOT NULL DEFAULT true,
  hesaplandi   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.uys_mrp_state_order IS
  'Order bazli MRP cache. CASCADE delete: order silinince cache otomatik temizlenir.';

CREATE INDEX IF NOT EXISTS ix_mrp_state_order_invalidated
  ON public.uys_mrp_state_order(invalidated)
  WHERE invalidated = true;


-- RLS
ALTER TABLE public.uys_mrp_state_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uys_mrp_state_order  ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all ON public.uys_mrp_state_global
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY allow_all ON public.uys_mrp_state_order
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
