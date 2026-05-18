-- ======================================================================
-- UYS v3 — Performance Index Migration
-- v17.16 | 2026-05-18
-- Hedef tabloları: uys_stok_hareketler, uys_logs, uys_work_orders
-- TEST: cowgxwmhlogmswatbltz | PROD: lmhcobrgrnvtprvmcito (ayrı onay)
-- ======================================================================
-- TEST uygulandı: 2026-05-18 (MCP apply_migration)
-- PROD uygulandı: —

-- ── uys_stok_hareketler ─────────────────────────────────────────────

-- StokLog.tsx (v17.05) server-side pagination ORDER BY tarih DESC + gte/lte range filter
CREATE INDEX IF NOT EXISTS idx_stok_hareketler_tarih
  ON public.uys_stok_hareketler (tarih DESC);

-- stokTuketim / stokHelper: WO bazlı hareket listeleme ve toplu silme
CREATE INDEX IF NOT EXISTS idx_stok_hareketler_wo_id
  ON public.uys_stok_hareketler (wo_id)
  WHERE wo_id IS NOT NULL;

-- bar_acilis log kaydına bağlı hareket lookup (acik_barlar / barModel)
CREATE INDEX IF NOT EXISTS idx_stok_hareketler_log_id
  ON public.uys_stok_hareketler (log_id)
  WHERE log_id IS NOT NULL;

-- Duplicate temizliği: idx_stok_hareket_rezerv ile aynı kolonlar (rezerv_order_id)
DROP INDEX IF EXISTS public.idx_stok_hareketler_rezerv_order;

-- ── uys_logs ─────────────────────────────────────────────────────────

-- "WO bazında tarihe göre sıralı log" composite — wo_id prefix eşleşmesi,
-- tarih DESC sort; ayrı idx_uys_logs_wo_id artık bu index kapsamında
CREATE INDEX IF NOT EXISTS idx_uys_logs_wo_id_tarih
  ON public.uys_logs (wo_id, tarih DESC);

-- fn_malkod_cascade_update trigger: UPDATE uys_logs SET malkod=NEW.kod WHERE malkod=OLD.kod
CREATE INDEX IF NOT EXISTS idx_uys_logs_malkod
  ON public.uys_logs (malkod)
  WHERE malkod IS NOT NULL;

-- ── uys_work_orders ──────────────────────────────────────────────────

-- fn_mrp_durum_check_on_wo trigger: WHERE order_id=X AND durum NOT IN (...)
-- autoChain / workOrderService: .neq('durum','iptal') sorguları
CREATE INDEX IF NOT EXISTS idx_uys_work_orders_durum
  ON public.uys_work_orders (durum);

-- fn_recipe_op_sync trigger: COALESCE(NULLIF(ist_id,''), ist_id) lookup
-- + kapasiteGruplari / istasyon bazlı WO sorguları
CREATE INDEX IF NOT EXISTS idx_uys_work_orders_ist_id
  ON public.uys_work_orders (ist_id)
  WHERE ist_id IS NOT NULL AND ist_id <> '';

-- ── Rollback ─────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_stok_hareketler_tarih;
-- DROP INDEX IF EXISTS public.idx_stok_hareketler_wo_id;
-- DROP INDEX IF EXISTS public.idx_stok_hareketler_log_id;
-- DROP INDEX IF EXISTS public.idx_uys_logs_wo_id_tarih;
-- DROP INDEX IF EXISTS public.idx_uys_logs_malkod;
-- DROP INDEX IF EXISTS public.idx_uys_work_orders_durum;
-- DROP INDEX IF EXISTS public.idx_uys_work_orders_ist_id;
-- -- idx_stok_hareketler_rezerv_order'ı geri yüklemek için:
-- CREATE INDEX idx_stok_hareketler_rezerv_order ON public.uys_stok_hareketler (rezerv_order_id);
