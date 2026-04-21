-- uys_mrp_rezerve tablosu — Faz B Parça 2C (rezerve stok)
-- Her MRP hesaplamasında, siparişlerin ihtiyaç duyduğu malzemeler rezerve edilir.
-- Üretim tarafında rezerve dikkate alınmaz (fiziksel stok kullanılır).

CREATE TABLE IF NOT EXISTS public.uys_mrp_rezerve (
  id text primary key,
  order_id text not null,
  malkod text not null,
  malad text,
  miktar numeric not null default 0,
  birim text,
  mrp_run_id text,
  tarih text,
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_rezerve_order ON public.uys_mrp_rezerve(order_id);
CREATE INDEX IF NOT EXISTS idx_rezerve_malkod ON public.uys_mrp_rezerve(malkod);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.uys_mrp_rezerve;