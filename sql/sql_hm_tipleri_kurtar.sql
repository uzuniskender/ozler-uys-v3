-- ═══ HM Tipleri Kurtarma — 18 Nisan 2026 ═══
-- 4 aktif tip malzeme kartlarından tespit edildi:
--   PROFİL (159), BORU (116), LEVHA (30), SAC (4)
-- Kod alanı malzemelerdeki hammadde_tipi stringiyle BIR BIR eşleşmeli (büyük harf!)

INSERT INTO public.uys_hm_tipleri (id, kod, ad, aciklama, sira, olusturma, updated_at)
VALUES
  ('hmt_profil',  'PROFİL',  'Profil',  'Kutu/köşebent/U/T profiller',  1, '2026-04-18', now()),
  ('hmt_boru',    'BORU',    'Boru',    'Dikişli/dikişsiz borular',     2, '2026-04-18', now()),
  ('hmt_levha',   'LEVHA',   'Levha',   'Kalın çelik levhalar',         3, '2026-04-18', now()),
  ('hmt_sac',     'SAC',     'Sac',     'İnce sac/rulo',                4, '2026-04-18', now())
ON CONFLICT (id) DO NOTHING;

-- Doğrulama
SELECT kod, ad, sira FROM public.uys_hm_tipleri ORDER BY sira;
