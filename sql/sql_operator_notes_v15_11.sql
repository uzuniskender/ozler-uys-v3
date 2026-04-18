-- ═══ v15.11 — Operatör Mesajları: kategori + öncelik ═══
-- UYS v3 Supabase'inde çalıştırılacak. Idempotent.

ALTER TABLE public.uys_operator_notes
  ADD COLUMN IF NOT EXISTS kategori text,
  ADD COLUMN IF NOT EXISTS oncelik text DEFAULT 'Normal';

-- Eski kayıtlarda oncelik boşsa 'Normal' yap (DEFAULT sadece yeni satırlarda uygulanır)
UPDATE public.uys_operator_notes
SET oncelik = 'Normal'
WHERE oncelik IS NULL OR oncelik = '';

-- Acil mesajlar için index (Messages sayfasında sıralama hızlansın)
CREATE INDEX IF NOT EXISTS idx_operator_notes_oncelik
  ON public.uys_operator_notes(oncelik)
  WHERE oncelik = 'Acil';

-- Kategori filtresi için index
CREATE INDEX IF NOT EXISTS idx_operator_notes_kategori
  ON public.uys_operator_notes(kategori);
