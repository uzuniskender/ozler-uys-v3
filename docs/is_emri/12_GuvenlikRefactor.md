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

## ⚠️ ÖNEMLİ KISIT (27 Nis 2026 keşfedildi)

**Supabase'de Google OAuth provider DISABLED.** `auth.users` tablosu boş — kimse Google ile giriş yapmamış. Tüm kullanıcılar (admin dahil) `uys_kullanicilar` tablosu + plain text `sifre` ile custom auth path'inden giriyor.

Bu kısıt orijinal Faz 1 planını (`Admin Google OAuth pilot`) **geçersiz kılıyor**. Yeni gerçeklik:
- Admin Google OAuth ile login YAPMIYOR
- 4 rol (admin + uretim_sor + planlama + depocu) hepsi aynı custom auth path'inde
- Faz 1 ve Faz 2 doğal olarak birleşiyor → "Tüm AdminRole'leri Supabase Auth'a sıfırdan migrate"

`useAuth.ts`'in `signInWithGoogle` fonksiyonu çağrıldığında `validation_failed: Unsupported provider` hatası alır.

---

## YAKLAŞIM TERCİHİ

3 yaklaşım analiz edildi (detay: `docs/UYS_v3_Bilgi_Bankasi.md` §20):

| Yaklaşım | Açıklama | Süre | Risk |
|---|---|---|---|
| **A — Supabase Auth (email/password)** | Tüm rolleri `auth.users`'a taşı, RLS `auth.uid()` ile | 1.5 hafta | Düşük (standart yol) |
| B — Custom JWT Claims | Frontend kendi JWT'sini imzalar, RLS `jwt()` claim okur | 1.5 hafta | Yüksek (yanlış imp = felaket) |
| C — Edge Function Hibrit | Hassas işlemler Function üzerinden, frontend `from()` çağırmaz | 2 hafta | Düşük ama kapsamlı refactor |

**Seçilen: Yaklaşım A** (Supabase'in tasarlandığı yol). Email/password provider Supabase'de zaten default açık; Google OAuth açmaya gerek yok (gerekirse ayrı iş olarak ileride eklenir).

### Kapsam Dışı

- E2E encryption / at-rest encryption (Supabase'in sağladığı varsayılan kabul)
- Audit log (ayrı iş)
- 2FA (ayrı iş)
- Session timeout policy (ayrı iş)
- Google OAuth eklenmesi (ihtiyaç olursa ayrı iş)

---

## FAZ 1 — TÜM ADMINROLE'LER SUPABASE AUTH'A TAŞINIR (~5 GÜN)

**Hedef:** Mevcut 4 AdminRole (admin + uretim_sor + planlama + depocu) `uys_kullanicilar` custom auth + plain `sifre`'den Supabase Auth'a (email/password) taşınır. Operatörler Faz 2'de ele alınır.

**Pre-requisite:** v16.0.0 Faz 1.1a yapıldı (27 Nis 2026):
- `uys_kullanicilar.auth_user_id` uuid kolonu eklendi
- `idx_uys_kullanicilar_auth_user_id` index
- `public.current_user_role()` SQL helper fonksiyonu

Bu altyapı şu an boş duruyor (RLS policy'leri henüz yok). Faz 1 devam edince doldurulacak.

### Görev 1.1 — Pilot Hesap (Admin = Buket)

İlk **bir** kullanıcı için Auth hesabı manuel oluştur:

1. Supabase Studio → Authentication → Users → "Add user"
2. Email: `<admin için sentetik veya gerçek email>` + güçlü şifre
3. SQL ile `uys_kullanicilar.auth_user_id` set et:
   ```sql
   -- Auth user ID'yi al
   SELECT id FROM auth.users WHERE email = '<email>';
   -- Bağla
   UPDATE public.uys_kullanicilar
     SET auth_user_id = '<auth_user_id>'
     WHERE rol = 'admin';
   ```
4. `current_user_role()` test:
   ```sql
   SELECT public.current_user_role();
   -- Anonim çağrıda NULL dönmeli; auth ile çağrıda 'admin' dönmeli
   ```

### Görev 1.2 — Login.tsx Hibrit Akış

`signIn(username, password)` fonksiyonuna **fallback chain** ekle:
1. Önce `supabase.auth.signInWithPassword({ email, password })` dene
2. Başarısız olursa eski custom path (`uys_kullanicilar` + plain `sifre`) ile devam et
3. Geriye uyumluluk: hem yeni hem eski yöntemle giriş çalışır (transition period)

Test: Buket yeni Auth ile login → admin paneli normal çalışıyor mu?

### Görev 1.3 — Pilot RLS Policy

Hassas tablolarda **küçük adım** RLS sıkılaştır:
- `uys_operators.sifre` ve `uys_operators.sicil_hash` kolonları → admin hariç görünmez
- `uys_kullanicilar` tablosu → admin hariç görünmez

Önemli: `allow_all` policy'leri **henüz silmiyoruz**. Yeni kısıtlı policy'ler ekleniyor; allow_all hâlâ aktif olduğu için test sırasında eski akış çalışmaya devam ediyor (kademe kademe geçiş). Sahada hiçbir kullanıcı fark etmiyor.

### Görev 1.4 — Migration Script (3 AdminRole)

Mevcut `uys_kullanicilar` kayıtları (uretim_sor, planlama, depocu) için `auth.users` hesabı oluştur:
- Email: `<kullaniciAdi>@ozler.local` (sentetik email)
- Şifre: ilk girişte değiştirme zorunlu (DEFAULT_PASSWORD geçici)
- `auth_user_id` set et

Kullanıcılara duyuru: "Yarın UYS'ye girince yeni şifre belirleme ekranı çıkacak."

### Görev 1.5 — `allow_all` DROP (Faz 1 sonu)

Pilot + tüm AdminRole'ler Auth'a taşındıktan ve test edildikten sonra (en az 2 gün gözlem) hassas tablolardaki `allow_all` policy'leri silinir. RLS artık gerçek koruma yapar.

**Kabul kriteri:** Sahadaki dashboard, sipariş, kesim, MRP akışları aynen çalışmalı. Hiçbir kullanıcı değişikliği fark etmemeli (ilk login dışında — yeni şifre belirleme).

---

## FAZ 2 — OPERATOR ROLÜ (~3 GÜN)

**Pre-requisite:** v15.52a lazy migration tamamlanmalı (tüm operatörler hash'lenmiş olmalı).

**Hedef:** Operatörleri Supabase Auth'a taşı. Mevcut sessionStorage `OPR_KEY` deseni kalkar, gerçek JWT gelir.

### Görev 2.1 — Migration

Her operatör için `auth.users` hesabı: email `<sicilNo>@operator.ozler.local`, şifre = sicil_hash (bcrypt'e gerekirse migrate). İlk girişte v15.52a.1'in lazy migration mantığı korunur.

### Görev 2.2 — useAuth.operatorLogin Refactor

`sessionStorage.OPR_KEY` set etmek yerine `supabase.auth.signInWithPassword({ email, password })` çağır. JWT otomatik header'a eklenir, RLS doğal olarak operator'ı tanır.

### Görev 2.3 — Operatör RLS Policy

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

### Görev 2.4 — Test (Sahada Pilot)

Bir bölüm seç (örn. KESİM), 2-3 operatöre yeni Auth akışıyla giriş yaptır. Diğer bölümler eski akışla devam eder.

**Kabul kriteri:** Bir günlük pilot — üretim, fire, duruş, mesaj, izin akışları aynen çalışıyor.

---

## FAZ 3 — TÜM TABLOLAR İÇİN RLS YAYILIMI (~2 GÜN)

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

## FAZ 4 — TEMİZLİK + DOKÜMAN (~1 GÜN)

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
| Faz 1: Tüm AdminRole'leri Auth'a | 5 gün | 5 gün |
| Faz 2: Operator Auth'a | 3 gün | 8 gün |
| Faz 3: RLS Yayılımı | 2 gün | 10 gün |
| Faz 4: Temizlik | 1 gün | 11 gün |

**Toplam:** ~11 gün (tam zamanlı bir Claude oturumunun yapacağı varsayımıyla). Buket'in günlük iş yüküyle **3-4 hafta'ya yayılır**.

**Pre-requisite checklist:**
- [x] v15.52a lazy migration başlatıldı (tüm operatörler hash'lenmiş olmalı — Faz 2 öncesi kontrol)
- [x] v16.0.0 Faz 1.1a altyapı kuruldu (auth_user_id kolonu + current_user_role helper)
- [ ] Faz 1 başlangıcı için zaman ayrılmalı (en az 1 hafta yarım gün, gözleme açık)

---

*Bu spec 27 Nis 2026'da hazırlandı, aynı gün revize edildi (Google OAuth disabled keşfi sonrası). RLS audit sonucu (`allow_all` keşfi) Bilgi Bankası §20'de detaylı.*
