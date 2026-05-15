-- v16.83 — İş Emri Hazırlama modülü (2025-05-15)
-- Tablolar: uys_rapido_bom, uys_ie_hazirlama, uys_ie_hazirlama_kalemler,
--           uys_ie_hazirlama_log, uys_ie_log

CREATE TABLE IF NOT EXISTS public.uys_rapido_bom (
  id TEXT NOT NULL PRIMARY KEY,
  urun_kodu TEXT NOT NULL,
  urun_adi TEXT NOT NULL,
  is_istasyonu TEXT,
  hammadde_kodu TEXT,
  hammadde_adi TEXT,
  kesim_olc_mm NUMERIC,
  birim_adet NUMERIC,
  hm_uzunluk_mm NUMERIC,
  aciklama TEXT,
  olusturma TEXT,
  guncelleme TEXT,
  aktif BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.uys_ie_hazirlama (
  id TEXT NOT NULL PRIMARY KEY,
  siparis_no TEXT NOT NULL,
  musteri TEXT,
  siparis_tarihi TEXT,
  teslim_tarihi TEXT,
  olusturan TEXT,
  durum TEXT,
  ie_verildi_at TEXT,
  ie_verildi_by TEXT,
  not_ TEXT,
  olusturma TEXT
);

CREATE TABLE IF NOT EXISTS public.uys_ie_hazirlama_kalemler (
  id TEXT NOT NULL PRIMARY KEY,
  ie_id TEXT NOT NULL,
  urun_kodu TEXT NOT NULL,
  urun_adi TEXT,
  siparis_adeti NUMERIC NOT NULL,
  durum TEXT,
  iptal_neden TEXT,
  iptal_at TEXT,
  iptal_by TEXT,
  uys_siparis_no TEXT,
  siparis_acildi BOOLEAN,
  siparis_acildi_at TEXT,
  olusturma TEXT
);

CREATE TABLE IF NOT EXISTS public.uys_ie_hazirlama_log (
  id TEXT NOT NULL PRIMARY KEY,
  ie_id TEXT NOT NULL,
  kalem_id TEXT,
  tip TEXT NOT NULL,
  aciklama TEXT,
  siparis_no TEXT,
  urun_kodu TEXT,
  kullanici TEXT,
  tarih TEXT,
  saat TEXT
);

CREATE TABLE IF NOT EXISTS public.uys_ie_log (
  id TEXT NOT NULL PRIMARY KEY,
  ie_id TEXT NOT NULL,
  kalem_id TEXT,
  event TEXT NOT NULL,
  aciklama TEXT,
  uys_siparis_id TEXT,
  tarih TIMESTAMPTZ,
  kullanici TEXT
);
