-- v16.89 — Admin password sync (Plan B)
-- ─────────────────────────────────────────────────────────────────────────
-- Amaç:
--   Admin DataManagement'tan başka kullanıcının şifresini değiştirdiğinde
--   hem uys_kullanicilar.sifre (mevcut akış) hem de auth.users.encrypted_password
--   senkron olarak güncellenir.
--
-- Mimari:
--   Frontend RPC `supabase.rpc('admin_update_user_password', {...})` çağırır.
--   Function SECURITY DEFINER ile auth.users'a yazar. Yetki kontrolü
--   `current_user_role() = 'admin'` ile function içinde yapılır.
--   Service_role key frontend'e konulmaz.
--
-- ⚠️ Trade-off:
--   auth.users Supabase managed schema; gelecekteki Supabase upgrade'ler
--   encrypted_password kolonunu veya bcrypt format'ını değiştirirse bu
--   function kırılabilir. Bilinçli kabul edildi (Edge Function alternatifi
--   reddedildi).
--
-- TEST: cowgxwmhlogmswatbltz — bu migration ile
-- PROD: lmhcobrgrnvtprvmcito — ayrı onayla

-- pgcrypto: crypt() + gen_salt() (Supabase'de default; defensive ekleme)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_update_user_password(
  target_user_id text,
  new_password   text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_auth_user_id uuid;
  v_caller_role  text;
BEGIN
  -- 1) Şifre formatı temel kontrol (uzunluk)
  IF length(coalesce(new_password, '')) < 4 THEN
    RAISE EXCEPTION 'Şifre en az 4 karakter olmalı' USING ERRCODE = '22023';
  END IF;

  -- 2) Çağıran admin mi?
  v_caller_role := public.current_user_role();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Sadece admin başka kullanıcının şifresini değiştirebilir (mevcut rol: %)', coalesce(v_caller_role, 'NULL')
      USING ERRCODE = '42501';
  END IF;

  -- 3) Hedef kullanıcının Supabase Auth bağlantısı
  SELECT auth_user_id INTO v_auth_user_id
    FROM public.uys_kullanicilar
   WHERE id = target_user_id;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı Supabase Auth ile bağlı değil (auth_user_id NULL). Önce auth göçü yapılmalı.'
      USING ERRCODE = '23502';
  END IF;

  -- 4) auth.users.encrypted_password bcrypt hash ile güncelle
  UPDATE auth.users
     SET encrypted_password = crypt(new_password, gen_salt('bf')),
         updated_at = now()
   WHERE id = v_auth_user_id;
END $$;

REVOKE ALL    ON FUNCTION public.admin_update_user_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_password(text, text) TO authenticated;

COMMENT ON FUNCTION public.admin_update_user_password(text, text) IS
  'Plan B (v16.89): Admin başka kullanıcının auth.users.encrypted_password değerini günceller. Yetki: current_user_role() = admin. auth.users managed schema''sına doğrudan yazar — Supabase upgrade riski bilinçli kabul edildi.';
