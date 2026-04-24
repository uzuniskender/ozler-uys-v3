-- ═══════════════════════════════════════════════════════════════════════
-- UYS v3 — v15.34 / Commit 1: Açık Bar Hurda Alanları
-- Tarih: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════════
-- Supabase'de ZATEN çalıştırıldı (24 Nis 2026 sabah).
-- Bu dosya audit-columns.cjs'in kolon listesini görebilmesi için repoda
-- kalacak. Regex şartı: public.<tablo> prefix + ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.uys_acik_barlar
  ADD COLUMN IF NOT EXISTS hurda_tarihi        timestamp,
  ADD COLUMN IF NOT EXISTS hurda_sebep         text,
  ADD COLUMN IF NOT EXISTS hurda_kullanici_id  text,
  ADD COLUMN IF NOT EXISTS hurda_kullanici_ad  text;
