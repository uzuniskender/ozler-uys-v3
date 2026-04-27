# İŞ EMRİ #12 — UYS v3 Güvenlik Refactoru (RLS Tam Uygulama)

## Bağlam

UYS v3'te **Row Level Security (RLS)** açık görünüyor ama gerçekte koruma yok. 8 tablo (operators, logs, fire_logs, active_work, operator_notes, stok_hareketler, work_orders, orders) tek `allow_all` policy'siyle (`cmd: ALL, qual: true, with_check: true`) korunuyor. Bu RLS'i tamamen kapalı tutmaktan farksız — anon key sahibi (yani frontend'i açan herkes) DB'deki tüm verileri okuyup yazabilir.

**Bu durum v15.52a.1 RLS audit'inde keşfedildi (27 Nis 2026).**

### Şu An Risk Düşük Çünkü

1. İç ağ kullanımı — sahaya internet açık değil
2. Operatörler teknik değil — F12 → Console hack senaryosu uzak
3. Niyet meselesi — kötü amaç yok
4. Veri zaten paylaşılır (Özler iç ağında herkes herkesi tanıyor)

### Ama Niye Düzeltilmesi Gerek

**İç tehdit (düşük olasılık ama ciddi):**
- Çalışan ayrılmadan önce kayıt manipülasyonu
- Operatör hatasını gizlemek için fire kaydı silme
- Yetkisiz veri okuma

**Audit/Belgelendirme:**
- ISO 27001 (Bilgi Güvenliği) — büyüme/EU müşteri taleplerinde gerekebilir
- Akkuyu NGS / IC İçtaş / büyük müşteri tedarikçi denetimleri
- ISO 9001 "süreç kontrolü" maddesi

---

## YAKLAŞIM TERCİHİ

3 yaklaşım analiz edildi (detay: `docs/UYS_v3_Bilgi_Bankasi.md` §20):

| Yaklaşım | Açıklama | Süre | Risk |
|---|---|---|---|
| **A — Supabase Auth** | Tüm rolleri `auth.users`'a taşı, RLS `auth.uid()` ile | 1 hafta | Düşük (standart yol) |
| B — Custom JWT Claims | Frontend kendi JWT'sini imzalar, RLS `jwt()` claim okur | 1.5 hafta | Yüksek (yanlış imp = felaket) |
| C — Edge Function Hibrit | Hassas işlemler Function üzerinden, frontend `from()` çağırmaz | 2 hafta | Düşük ama kapsamlı refactor |

**Seçilen: Yaklaşım A** (Supabase'in tasarlandığı yol; mevcut admin akışı [Google OAuth] genişletilir).

### Kapsam Dışı

- E2E encryption / at-rest encryption (Supabase'in sağladığı varsayılan kabul)
- Audit log (ayrı iş)
- 2FA (ayrı iş)
- Session timeout policy (ayrı iş)

---

## FAZ 1 — ADMIN TAM TAŞIMA (PILOT, ~2 GÜN)

**Hedef:** Mevcut admin akışını (Google OAuth) RLS-uyumlu hale getirmek. **Risk en düşük** — sadece 1-2 admin var, sahayı etkilemez.

### Görev 1.1 — auth.users vs uys_kullanicilar Senkron

`uys_kullanicilar` tablosuna `auth_user_id uuid` kolonu ekle. Admin Google OAuth ile login olunca:
- `auth.users.id` (UUID) ↔ `uys_kullanicilar.auth_user_id`
- Helper RPC: `current_user_role()` — `auth.uid()`'den `uys_kullanicilar.rol`'ü döner

### Görev 1.2 — Pilot RLS Policy (Düşük Riskli Tablolar)

İlk olarak **sadece okuma odaklı** tablolarda RLS sıkılaştır:
- `uys_operators` (sicil_hash sütunu hassas — admin hariç görünmez)
- `uys_kullanicilar` (şifreler — admin hariç hiç görünmez)

Hedef: Admin login ile okuyabilir + yazabilir, anon hiçbir şey yapamaz.

### Görev 1.3 — Test

- Admin login → operatör listesi açılıyor mu? ✓
- Anon (logout) → operator listesi sorgusu fail oluyor mu? ✓
- v15.52a Login.tsx hash migration hâlâ çalışıyor mu? ✓ (kritik regression)

**Kabul kriteri:** Sahadaki üretim kayıtları, kesim planları, MRP — hiçbiri etkilenmemeli.

---

## FAZ 2 — uretim_sor / planlama / depocu ROLLERİ (~3 GÜN)

**Hedef:** Custom auth (uys_kullanicilar tablo + plain text şifre) → Supabase Auth taşı.

### Görev 2.1 — Migration Script

Mevcut `uys_kullanicilar` kayıtları için `auth.users`'da hesap oluştur. Şifre: ilk girişte değiştirme zorunlu (DEFAULT_PASSWORD geçici). Email: `<kullaniciAdi>@ozler.local` (sentetik email — Supabase email validation için).

### Görev 2.2 — Login.tsx Refactor

`signIn(username, password)` → önce `auth.users`'da signInWithPassword dener, fallback olarak eski custom path. 1-2 hafta transition sonrası fallback kaldırılır.

### Görev 2.3 — RLS Policy Yayılımı

10+ tablo (orders, work_orders, recipes, materials vb.) için role-based policy:
```sql
CREATE POLICY "planlama_can_insert_orders" ON public.uys_orders
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'planlama'));
```

### Görev 2.4 — Test

3 admin/uretim_sor/planlama/depocu test hesabı + sahada bir kullanıcının onayıyla pilot.

**Kabul kriteri:** Sahadaki dashboard, sipariş, kesim, MRP akışları aynen çalışmalı. Hiçbir kullanıcı değişikliği fark etmemeli.

---

## FAZ 3 — OPERATOR ROLÜ (~3 GÜN)

**Hedef:** Operatörleri Supabase Auth'a taşı. Mevcut sessionStorage `OPR_KEY` deseni kalkar, gerçek JWT gelir.

### Görev 3.1 — Migration

Her operatör için `auth.users` hesabı: email `<sicilNo>@operator.ozler.local`, şifre = sicil_hash (bcrypt'e gerekirse migrate). İlk girişte v15.52a.1'in lazy migration mantığı korunur.

### Görev 3.2 — useAuth.operatorLogin Refactor

`sessionStorage.OPR_KEY` set etmek yerine `supabase.auth.signInWithPassword({ email, password })` çağır. JWT otomatik header'a eklenir, RLS doğal olarak operator'ı tanır.

### Görev 3.3 — Operatör RLS Policy

```sql
-- Operatör kendi loglarını yazabilir, başkasının yazamaz
CREATE POLICY "operator_own_logs" ON public.uys_logs
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'operator' AND operator_id = auth.uid());

-- Operatör kendi bölümünün WO'larını okuyabilir
CREATE POLICY "operator_dept_workorders" ON public.uys_work_orders
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'operator' 
    AND EXISTS (SELECT 1 FROM uys_operators WHERE auth_user_id = auth.uid() AND bolum = ist_bolum)
  );
```

### Görev 3.4 — Test (Sahada Pilot)

Bir bölüm seç (örn. KESİM), 2-3 operatöre yeni Auth akışıyla giriş yaptır. Diğer bölümler eski akışla devam eder.

**Kabul kriteri:** Bir günlük pilot — üretim, fire, duruş, mesaj, izin akışları aynen çalışıyor.

---

## FAZ 4 — TÜM TABLOLAR İÇİN RLS YAYILIMI (~2 GÜN)

8 ana tablo + diğer ~25 yardımcı tablo için RLS policy'leri tamamla. Pattern aynı: role-based + ownership-based.

### Önemli: `allow_all` Policy DROP

Her policy yazıldıktan sonra eski `allow_all` policy'si silinir. **Kademeli yapılmalı** — bir tablo için yeni policy yazıldıktan ve test edildikten sonra `allow_all` drop edilir.

### Audit Log

```sql
CREATE TABLE uys_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,  -- INSERT/UPDATE/DELETE
  user_id uuid REFERENCES auth.users(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Trigger ile hassas tablolarda her değişiklik kaydedilir. ISO 27001 audit için kritik.

---

## FAZ 5 — TEMİZLİK + DOKÜMAN (~1 GÜN)

- Eski `signIn(username, password)` (custom path) kaldır
- `uys_kullanicilar.sifre` kolonu DROP
- `uys_operators.sifre` kolonu DROP (lazy migration zaten v15.52a sonrası tamamlanır)
- Bilgi Bankası §20 güncelle: "Tehdit modeli güncel, RLS aktif"
- Penetrasyon testi notu (basit anon key denemesi)

---

## GENEL UYARILAR

1. **Sahada kesinti olmamalı.** Her faz ayrı patch, ayrı test, ayrı rollback senaryosu. Faz 1 → 2 → 3 → 4 → 5 sırası **zorunlu**.

2. **Rollback planı her fazda hazır:** Yeni policy fail olursa eski `allow_all`'ı geri ekle, kullanıcılar etkilenmesin.

3. **Senkronizasyon riski:** `auth.users` ↔ `uys_kullanicilar`/`uys_operators` arası tutarsızlık → RLS policy'leri yanıltıcı sonuç verebilir. Migration script idempotent olmalı.

4. **CLIENT_ID realtime hala çalışmalı:** Auth'a geçince `__client` payload'ı bozulmamalı.

5. **Test ortamı:** Memory'deki test Supabase (`cowgxwmhlogmswatbltz`) bu refactor için kullanılabilir. Önce orada provala.

---

## ÇIKTI BEKLENTİSİ

Her görev için:
- Migration SQL (idempotent, `public.` prefix kuralı [§18.5])
- Etkilenen kod dosyalarının tam içeriği
- RLS policy SQL'leri
- Test planı (E2E + manuel)
- Rollback komutları
- CHANGELOG

**Tag önerisi:** `v16.0.0` (major sürüm — auth modeli değişiyor).

**Faz sırası:** 1 → 2 → 3 → 4 → 5 (her faz tamamlanmadan sonraki faza geçilmeyecek)

---

## TAHMİNİ TOPLAM SÜRE

| Faz | Süre | Kümülatif |
|---|---|---|
| Faz 1: Admin Pilot | 2 gün | 2 gün |
| Faz 2: AdminRole'ler | 3 gün | 5 gün |
| Faz 3: Operator | 3 gün | 8 gün |
| Faz 4: RLS Yayılımı | 2 gün | 10 gün |
| Faz 5: Temizlik | 1 gün | 11 gün |

**Toplam:** ~11 gün (tam zamanlı bir Claude oturumunun yapacağı varsayımıyla). Buket'in günlük iş yükü düşünülürse **3-4 hafta'ya yayılır**.

**Pre-requisite:** v15.52a lazy migration tamamlanmalı (tüm operatörler hash'lenmiş olmalı) — Faz 3'e başlamadan önce.

---

*Bu spec 27 Nis 2026'da hazırlandı. RLS audit sonucu (`allow_all` keşfi) Bilgi Bankası §20'de detaylı.*
