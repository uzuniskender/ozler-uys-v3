-- v16.80 — Supabase Data API degisikligi icin GRANT ifadeleri (30 Ekim 2026 deadline)
-- Tum public tablolara anon ve authenticated rolleri icin erisim izni
-- Kaynak: Supabase email 13 May 2026 — Data API access changes

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_acik_barlar TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_active_work TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_activity_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_audit_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_bildirimler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_bom_trees TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_attachments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_channels TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_mentions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_chat_reactions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_checklist TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_customers TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_dev_files TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_durus_kodlari TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_fire_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_hm_tipleri TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_izinler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_kesim_planlari TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_kullanicilar TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_logs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_malzemeler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_manuel_mudahale_log TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_mrp_calculations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_mrp_rezerve TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_mrp_state_global TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_mrp_state_order TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_operations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_operator_notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_operators TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_pending_flows TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_recipes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_session_memory TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_sevk_satirlari TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_sevkler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_stations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_stok_hareketler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_tedarikciler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_tedarikler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_test_runs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_v15_31_silinen_hareketler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_work_orders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_yedekler TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uys_yetki_ayarlari TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_problemler TO anon, authenticated;

-- View'lar icin ayri GRANT
GRANT SELECT ON public.v_hammadde_tuketim TO anon, authenticated;

-- Sequence'lar icin GRANT (id auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;