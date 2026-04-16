-- ═══ UYS Realtime Publication — tüm tabloları dinle ═══
-- Supabase SQL Editor'da çalıştır. Idempotent.

-- Realtime için tüm uys_ tablolarını önce çıkar, sonra ekle (hata almadan tekrar çalıştırılabilir)
DO $$
DECLARE tbl_name text;
BEGIN
  -- Mevcut uys_ tablolarını publication'dan temizle
  FOR tbl_name IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename LIKE 'uys\_%' ESCAPE '\'
  LOOP
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.' || quote_ident(tbl_name);
  END LOOP;
END $$;

-- Hepsini birlikte ekle
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.uys_orders,
  public.uys_work_orders,
  public.uys_logs,
  public.uys_malzemeler,
  public.uys_operations,
  public.uys_stations,
  public.uys_operators,
  public.uys_recipes,
  public.uys_bom_trees,
  public.uys_stok_hareketler,
  public.uys_kesim_planlari,
  public.uys_tedarikler,
  public.uys_tedarikciler,
  public.uys_durus_kodlari,
  public.uys_customers,
  public.uys_sevkler,
  public.uys_operator_notes,
  public.uys_active_work,
  public.uys_fire_logs,
  public.uys_checklist,
  public.uys_izinler,
  public.uys_kullanicilar,
  public.uys_hm_tipleri,
  public.uys_yetki_ayarlari;

-- Doğrulama — şu sorguyla eklenen tabloları görebilirsin:
-- SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'uys_%' ORDER BY tablename;
