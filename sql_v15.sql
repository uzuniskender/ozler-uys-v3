-- ═══ v15: Sipariş sevk durumu + Yardım notları ═══
-- Supabase SQL Editor'da sırayla çalıştır. Idempotent.

-- 1) orders.sevk_durum kolonu
ALTER TABLE public.uys_orders
  ADD COLUMN IF NOT EXISTS sevk_durum text DEFAULT 'sevk_yok';

-- Mevcut kayıtları recalc etmeye gerek yok, "sevk_yok" default doğru
-- (sevkler varsa uygulama açılışta otomatik günceller)

-- 2) Ekip notları tablosu (sayfa bazlı not defteri)
CREATE TABLE IF NOT EXISTS public.uys_notes (
  id text PRIMARY KEY,
  sayfa text NOT NULL,
  baslik text,
  icerik text NOT NULL,
  yazan text,
  etiketler text[],
  tarih text NOT NULL,
  saat text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_notes_sayfa ON public.uys_notes(sayfa);

ALTER TABLE public.uys_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON public.uys_notes;
CREATE POLICY "allow_all" ON public.uys_notes USING (true) WITH CHECK (true);
GRANT ALL ON public.uys_notes TO anon, authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.uys_notes;
