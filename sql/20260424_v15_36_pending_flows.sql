-- ═══════════════════════════════════════════════════════════════════════
-- UYS v3 — v15.36: Yarım İş Takibi (PendingFlow)
-- Tarih: 2026-04-24
-- ═══════════════════════════════════════════════════════════════════════
-- Amaç: Sipariş → Kesim → MRP → Tedarik akışında kullanıcı yarı kalan
-- süreci sonradan sürdürebilsin. Topbar badge + devam et / iptal et.
--
-- flow_type     : 'siparis' | 'manuel_ie' | 'ym_ie'
-- current_step  : 'siparis' | 'kesim' | 'mrp' | 'tedarik' | 'tamamlandi' | 'iptal'
-- state_data    : adım adım birikmiş state (orderId, siparisNo, ieIds, mrpSonuc vb.)
-- durum         : 'aktif' | 'tamamlandi' | 'iptal'
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.uys_pending_flows (
  id              text PRIMARY KEY,
  flow_type       text NOT NULL,
  current_step    text NOT NULL,
  state_data      jsonb DEFAULT '{}'::jsonb,
  user_id         text,
  user_ad         text,
  baslangic       timestamp DEFAULT now(),
  son_aktivite    timestamp DEFAULT now(),
  durum           text DEFAULT 'aktif',
  not_            text
);

CREATE INDEX IF NOT EXISTS idx_pending_flows_user_aktif
  ON public.uys_pending_flows (user_id, durum);

-- PostgREST cache yenileme
ALTER TABLE public.uys_pending_flows ADD COLUMN IF NOT EXISTS _tmp_rc int;
ALTER TABLE public.uys_pending_flows DROP COLUMN IF EXISTS _tmp_rc;
