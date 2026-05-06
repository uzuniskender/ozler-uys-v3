-- v16.48: tedarik_id kolonu + index (referans bazlı dup guard)
ALTER TABLE public.uys_stok_hareketler
  ADD COLUMN IF NOT EXISTS tedarik_id TEXT
  REFERENCES public.uys_tedarikler(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS uys_sh_tedarik_id_idx
  ON public.uys_stok_hareketler(tedarik_id)
  WHERE tedarik_id IS NOT NULL;