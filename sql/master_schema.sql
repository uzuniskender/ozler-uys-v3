-- ════════════════════════════════════════════════════════════════
-- ÖZLER UYS v3 — MASTER SQL ŞEMASI (2026-04-17)
-- ════════════════════════════════════════════════════════════════
-- Yeni Supabase projesine uygulanacak tek dosya.
-- Tüm tablolar + RLS + realtime + temel veriler.
-- Idempotent — birden fazla çalıştırılabilir.

-- ════ 1. ANA TABLOLAR ════

-- 1.1 Müşteriler
CREATE TABLE IF NOT EXISTS public.uys_customers (
  id text PRIMARY KEY,
  ad text,
  kod text,
  updated_at timestamptz DEFAULT now()
);

-- 1.2 Malzemeler
CREATE TABLE IF NOT EXISTS public.uys_malzemeler (
  id text PRIMARY KEY,
  kod text UNIQUE,
  ad text,
  tip text,
  hammadde_tipi text,
  birim text DEFAULT 'Adet',
  boy numeric DEFAULT 0,
  en numeric DEFAULT 0,
  kalinlik numeric DEFAULT 0,
  uzunluk numeric DEFAULT 0,
  cap numeric DEFAULT 0,
  ic_cap numeric DEFAULT 0,
  min_stok numeric DEFAULT 0,
  op_id text,
  op_kod text,
  revizyon integer DEFAULT 0,
  revizyon_tarihi text,
  onceki_id text,
  aktif boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- 1.3 HM Tipleri
CREATE TABLE IF NOT EXISTS public.uys_hm_tipleri (
  id text PRIMARY KEY,
  kod text,
  ad text,
  aciklama text,
  sira integer DEFAULT 0,
  olusturma text,
  updated_at timestamptz DEFAULT now()
);

-- 1.4 Operasyonlar
CREATE TABLE IF NOT EXISTS public.uys_operations (
  id text PRIMARY KEY,
  kod text,
  ad text,
  bolum text,
  updated_at timestamptz DEFAULT now()
);

-- 1.5 İstasyonlar
CREATE TABLE IF NOT EXISTS public.uys_stations (
  id text PRIMARY KEY,
  kod text,
  ad text,
  op_ids jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 1.6 Operatörler
CREATE TABLE IF NOT EXISTS public.uys_operators (
  id text PRIMARY KEY,
  kod text,
  ad text,
  bolum text,
  aktif boolean DEFAULT true,
  sifre text,
  updated_at timestamptz DEFAULT now()
);

-- 1.7 Duruş Kodları
CREATE TABLE IF NOT EXISTS public.uys_durus_kodlari (
  id text PRIMARY KEY,
  kod text,
  ad text,
  kategori text,
  updated_at timestamptz DEFAULT now()
);

-- 1.8 Tedarikçiler
CREATE TABLE IF NOT EXISTS public.uys_tedarikciler (
  id text PRIMARY KEY,
  kod text,
  ad text,
  adres text,
  tel text,
  email text,
  not_ text,
  updated_at timestamptz DEFAULT now()
);

-- 1.9 BOM Ağaçları
CREATE TABLE IF NOT EXISTS public.uys_bom_trees (
  id text PRIMARY KEY,
  mamul_kod text,
  mamul_ad text,
  ad text,
  rows jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 1.10 Reçeteler
CREATE TABLE IF NOT EXISTS public.uys_recipes (
  id text PRIMARY KEY,
  rc_kod text,
  ad text,
  bom_id text,
  mamul_kod text,
  mamul_ad text,
  satirlar jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 1.11 Siparişler
CREATE TABLE IF NOT EXISTS public.uys_orders (
  id text PRIMARY KEY,
  siparis_no text,
  musteri text,
  tarih text,
  termin text,
  not_ text,
  urunler jsonb DEFAULT '[]'::jsonb,
  mamul_kod text,
  mamul_ad text,
  adet integer DEFAULT 1,
  recete_id text,
  mrp_durum text DEFAULT 'bekliyor',
  durum text DEFAULT '',
  sevk_durum text DEFAULT 'sevk_yok',
  oncelik integer DEFAULT 0,
  olusturma text,
  updated_at timestamptz DEFAULT now()
);

-- 1.12 İş Emirleri
CREATE TABLE IF NOT EXISTS public.uys_work_orders (
  id text PRIMARY KEY,
  order_id text,
  rc_id text,
  sira integer DEFAULT 0,
  kirno text,
  op_id text,
  op_kod text,
  op_ad text,
  ist_id text,
  ist_kod text,
  ist_ad text,
  malkod text,
  malad text,
  hedef numeric DEFAULT 0,
  mpm numeric DEFAULT 1,
  hm jsonb DEFAULT '[]'::jsonb,
  ie_no text,
  wh_alloc numeric DEFAULT 0,
  hazirlik_sure numeric DEFAULT 0,
  islem_sure numeric DEFAULT 0,
  durum text DEFAULT 'bekliyor',
  bagimsiz boolean DEFAULT false,
  siparis_disi boolean DEFAULT false,
  mamul_kod text,
  mamul_ad text,
  mamul_auto boolean DEFAULT false,
  operator_id text,
  not_ text,
  olusturma text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_work_orders_order_id ON public.uys_work_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_uys_work_orders_malkod ON public.uys_work_orders(malkod);

-- 1.13 Üretim Logları
CREATE TABLE IF NOT EXISTS public.uys_logs (
  id text PRIMARY KEY,
  wo_id text,
  tarih text,
  saat text,
  qty numeric DEFAULT 0,
  fire numeric DEFAULT 0,
  operatorlar jsonb DEFAULT '[]'::jsonb,
  duruslar jsonb DEFAULT '[]'::jsonb,
  not_ text,
  malkod text,
  ie_no text,
  operator_id text,
  vardiya text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_logs_wo_id ON public.uys_logs(wo_id);
CREATE INDEX IF NOT EXISTS idx_uys_logs_tarih ON public.uys_logs(tarih);

-- 1.14 Stok Hareketleri
CREATE TABLE IF NOT EXISTS public.uys_stok_hareketler (
  id text PRIMARY KEY,
  tarih text,
  malkod text,
  malad text,
  miktar numeric DEFAULT 0,
  tip text DEFAULT 'giris',
  log_id text,
  wo_id text,
  aciklama text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_stok_malkod ON public.uys_stok_hareketler(malkod);

-- 1.15 Kesim Planları
CREATE TABLE IF NOT EXISTS public.uys_kesim_planlari (
  id text PRIMARY KEY,
  ham_malkod text,
  ham_malad text,
  ham_boy numeric DEFAULT 0,
  ham_en numeric DEFAULT 0,
  kesim_tip text,
  durum text DEFAULT 'bekliyor',
  satirlar jsonb DEFAULT '[]'::jsonb,
  tarih text,
  gerekli_adet numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 1.16 Tedarikler
CREATE TABLE IF NOT EXISTS public.uys_tedarikler (
  id text PRIMARY KEY,
  malkod text,
  malad text,
  miktar numeric DEFAULT 0,
  birim text DEFAULT 'Adet',
  order_id text,
  siparis_no text,
  durum text DEFAULT 'bekliyor',
  geldi boolean DEFAULT false,
  teslim_tarihi text,
  tedarikci_id text,
  tedarikci_ad text,
  not_ text,
  tarih text,
  updated_at timestamptz DEFAULT now()
);

-- 1.17 Sevkler
CREATE TABLE IF NOT EXISTS public.uys_sevkler (
  id text PRIMARY KEY,
  order_id text,
  siparis_no text,
  musteri text,
  tarih text,
  kalemler jsonb DEFAULT '[]'::jsonb,
  not_ text,
  updated_at timestamptz DEFAULT now()
);

-- 1.18 Operatör Notları
CREATE TABLE IF NOT EXISTS public.uys_operator_notes (
  id text PRIMARY KEY,
  op_id text,
  op_ad text,
  tarih text,
  saat text,
  mesaj text,
  okundu boolean DEFAULT false,
  cevap text,
  cevaplayan text,
  cevap_tarih text,
  updated_at timestamptz DEFAULT now()
);

-- 1.19 Aktif Çalışmalar
CREATE TABLE IF NOT EXISTS public.uys_active_work (
  id text PRIMARY KEY,
  op_id text,
  op_ad text,
  wo_id text,
  wo_ad text,
  baslangic text,
  tarih text,
  updated_at timestamptz DEFAULT now()
);

-- 1.20 Fire Logları
CREATE TABLE IF NOT EXISTS public.uys_fire_logs (
  id text PRIMARY KEY,
  log_id text,
  wo_id text,
  tarih text,
  malkod text,
  malad text,
  qty numeric DEFAULT 0,
  ie_no text,
  op_ad text,
  operatorlar jsonb DEFAULT '[]'::jsonb,
  not_ text,
  telafi_wo_id text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fire_logs_telafi_wo_id ON public.uys_fire_logs(telafi_wo_id);

-- 1.21 Checklist
CREATE TABLE IF NOT EXISTS public.uys_checklist (
  id text PRIMARY KEY,
  tip text DEFAULT 'gorev',
  baslik text,
  aciklama text,
  atanan text,
  oncelik text DEFAULT 'normal',
  durum text DEFAULT 'bekliyor',
  tarih text,
  termin text,
  kategori text,
  resimler jsonb DEFAULT '[]'::jsonb,
  tamamlanma text,
  olusturan text,
  notlar text,
  updated_at timestamptz DEFAULT now()
);

-- 1.22 İzinler
CREATE TABLE IF NOT EXISTS public.uys_izinler (
  id text PRIMARY KEY,
  op_id text,
  op_ad text,
  baslangic text,
  bitis text,
  tip text DEFAULT 'yıllık',
  durum text DEFAULT 'bekliyor',
  saat_baslangic text,
  saat_bitis text,
  onaylayan text,
  onay_tarihi text,
  not_ text,
  olusturan text DEFAULT 'admin',
  updated_at timestamptz DEFAULT now()
);

-- 1.23 Kullanıcılar
CREATE TABLE IF NOT EXISTS public.uys_kullanicilar (
  id text PRIMARY KEY,
  ad text,
  kullanici_ad text,
  sifre text,
  rol text DEFAULT 'planlama',
  aktif boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- 1.24 Yetki Ayarları (RBAC)
CREATE TABLE IF NOT EXISTS public.uys_yetki_ayarlari (
  id text PRIMARY KEY,
  rol text,
  aksiyon text,
  izin boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

-- 1.25 Ekip Notları
CREATE TABLE IF NOT EXISTS public.uys_notes (
  id text PRIMARY KEY,
  sayfa text NOT NULL,
  baslik text,
  icerik text NOT NULL,
  yazan text,
  etiketler jsonb DEFAULT '[]'::jsonb,
  tarih text NOT NULL,
  saat text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_uys_notes_sayfa ON public.uys_notes(sayfa);

-- ════ 2. RLS POLİCY ════
-- Tüm tablolarda allow_all (client-side RBAC kullanılıyor)

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name LIKE 'uys_%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON public.%I;', t.table_name);
    EXECUTE format('CREATE POLICY "allow_all" ON public.%I USING (true) WITH CHECK (true);', t.table_name);
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated;', t.table_name);
  END LOOP;
END $$;

-- ════ 3. REALTIME ════

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name LIKE 'uys_%'
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t.table_name);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ════ BİTTİ ════
-- Şimdi uygulamaya gidip "Veri Yönetimi > JSON Yedek Yükle" ile backup'ı yükle.
