-- pt_problemler: D4 (Kök Neden) ve D5 (Kalıcı Çözüm) alanları — v17.06
-- TEST: 2026-05-17 | PROD: —
-- Idempotent (tekrar çalıştırılabilir)

ALTER TABLE public.pt_problemler
  ADD COLUMN IF NOT EXISTS kok_neden    text,
  ADD COLUMN IF NOT EXISTS kalici_cozum text;
