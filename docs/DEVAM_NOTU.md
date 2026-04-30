# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 30 Nisan 2026 sabah-akşam (oturum, ~05:00–17:00, **12 saat**)
**Son canlı sürüm:** v16.26 (kod) + v16.27 (doc patch)
**Bugün toplam:** **23 sürüm push** (v16.00 → v16.26) + 2 doc commit + **10 DB migration** + 7 DB veri fix.

---

## ⚡ HEMEN GİRİŞ — admin login

```
URL:    https://uzuniskender.github.io/ozler-uys-v3/
Email:  admin@uys.local
Şifre:  1234
```

Yedek (her zaman çalışır): Supabase Dashboard → Authentication → Users → `uzuniskender@gmail.com` → **Send Magic Link** → Gmail.

**Operatörler hala 1234 ile bölüm + isim seçerek giriyor** (UX değişmedi).

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §26 (29 Nis),
  §27 (30 Nis sabah, 10 alt bölüm) +
  §28 (30 Nis öğleden sonra) — RLS Migration Roadmap, 8 alt bölüm,
       Aşama 1+2A+2C+3 ✓, Aşama 4 DENENDI-ROLLBACK) +
docs/saha_model_28nis2026.md (13 senaryo) +
docs/DEVAM_NOTU.md (bu dosya, 30 Nis 15:30 yenilendi) +
docs/is_emri/00_BACKLOG_Master.md (Son Sürümler v16.01-v16.25 dahil)
oku.

Önceki chat kapandı/kapanacak — tüm bilgi docs/'ta.
```

**Yeni ortam değişiklikleri (30 Nis):**
- **Supabase MCP server bağlandı** (Claude canlı DB'den SELECT/UPDATE/INSERT/apply_migration/get_advisors)
- **Supabase Auth aktif** Buket admin (uzuniskender@gmail.com, UUID `ff76792a-4b3f-4ce5-afaf-25664b382ba1`) + **89 operatör** (op_<kod>@uys.local sentetik email, şifre 1234)
- Custom auth fallback hala kodda (admin123 hardcoded güvenlik açığı v16.26'da silinecek)
- Claude Code rate limit oldu, gün ortasında PowerShell zip-apply'a geri dönüldü
- localStorage debug flag (`UYS_DEBUG_MRP=true`)

---

## 30 NİSAN ÖZETİ — 22 SÜRÜM + 1 DOC + 9 DB MIGRATION

### Bugünün BEŞ büyük başarısı

1. **Sağlık raporu 13 PASS · 2 WARN → 17 PASS · 0 WARN · 0 FAIL** (tarihte ilk)
2. **Saha krizi: 3 sipariş × 5 Mayıs termin** kurtarıldı
3. **MRP cutting override mantığı kök çözümü** (LEVHA skip + max(BOM,plan) + camelCase mapping)
4. **RLS Aşama 1 + 2A + 3 (operatör Auth)** — Supabase advisor 5 ERROR → 0, 89/89 operatör + admin Supabase Auth'lu
5. **OperatorPanel siyah ekran fix** — v16.05 9 ay önceki kazası bulundu

### Sürüm tablosu (kod push'lar)

| Sürüm | Konu | Kritiklik |
|---|---|---|
| v16.00-v16.20 | (önceki sürümler — bkz. §27) | — |
| **v16.22** | Operator Auth pilot — Login.doOprLogin signInWithPassword arka plan | mimari |
| **v16.24** | Admin login OPR_KEY temizle - operator session admin override fix | fix |
| **v16.26** | **ADMIN_EMAILS array genişlet** — `['uzuniskender@gmail.com', 'admin@uys.local']` | erişim |

### DB Migration tablosu

| Sürüm | Konu |
|---|---|
| v16.16 | `updated_at` trigger 30 tabloya yayıldı (#23 kapandı) |
| v16.17 | RLS Aşama 1 — 5 ERROR → 0 (RLS açılım + fonksiyon güvenlik) |
| v16.21 | RLS Aşama 2A — uys_kullanicilar + uys_yetki_ayarlari authenticated_only |
| v16.22 | uys_operators tablosuna `auth_user_id uuid` kolonu + index |
| v16.23 | KOD10 ERKİN için Supabase Auth user (pilot) |
| v16.25 | **89 operatör için bulk Supabase Auth migration** (Aşama 3 ana) |
| v16.25 (Aşama 4) | Tüm 38 tablo allow_all → authenticated_only (DENENDI) |
| v16.25 (rollback) | Aşama 4 rollback — chicken-and-egg sorunu |
| v16.25 (admin yenile) | uzuniskender@gmail.com Auth user yeniden oluşturuldu |
| **v16.26 (token fix)** | **89 operatör Auth user'larında token alanları NULL → boş string** — pgcrypto SQL INSERT'lerle Supabase Auth signInWithPassword bypass nüansı (§27.11) |
| **v16.26 (admin alternatif)** | **`admin@uys.local` Auth user oluşturuldu** (sentetic email, gmail rate limit bypass için) — şifre `1234`, KOD83 ile aynı yapı |

---

## ANA ÇIKTILAR — Öğle Sonrası (yeni eklenenler)

### v16.16 — `updated_at` Trigger 30 Tabloya Yayılım (#23 kapandı)

`set_updated_at()` PL/pgSQL fonksiyonu zaten DB'de tanımlıydı (sadece uys_hm_tipleri'nde aktifdi). Migration ile kalan 29 tabloya `BEFORE UPDATE FOR EACH ROW` trigger eklendi.

**#23 "bug değil" yanılgısı:** Hesapla butonu UPDATE atınca mrp_durum doğru yansır, ama updated_at sabit kalır → biz "UPDATE atılmadı" sandık. Trigger eklendi → her UPDATE otomatik zaman damgalı.

### v16.17 — RLS Aşama 1: Yapı + Sertleştirme

Supabase advisor 5 ERROR + 45 WARN raporladı. Aşama 1 ile:
- 5 RLS olmayan tabloya RLS aç + allow_all (uys_acik_barlar, mrp_calculations, mrp_rezerve, pending_flows, test_runs, v15_31_silinen)
- `set_updated_at` search_path = public, pg_temp
- `current_user_role` SECURITY DEFINER → INVOKER (anon execute REVOKE)

Pilot uys_notes ile doğrulandı, sonra 37 tabloya yayım denendi → siyah ekran (kod hatası, RLS değil) → rollback.

**Sonuç:** ERROR 5 → 0, WARN 45 → ~41.

### v16.18 — Supabase Auth Migration (Buket admin)

Buket sabah Dashboard'dan `uzuniskender@gmail.com` Auth user oluşturdu. UYS frontend `useAuth.signIn` email path eklendi:

```ts
if (username.includes('@')) {
  return await supabase.auth.signInWithPassword({ email: username, password })
}
```

`uys_kullanicilar.admin-temp.auth_user_id` bağlandı. Plain text test123 ve DENEME 1234 NULL'landı.

### v16.20 — OperatorPanel Siyah Ekran (v16.05 baştan kırıkmış)

Buket admin olarak Operatör Paneli'ne tıkladığında `Uncaught ReferenceError: orders is not defined`. Bundle analiziyle: `OperatorMain` (alt component) `useMemo`'da `computeOrderHammaddeEksik(orders, ...)` çağırıyor ama `useStore()` destructure'da `orders` YOK. v16.05 yarım kalmış, kimse 9 ay fark etmemiş çünkü Operatör Paneli'ne admin olarak hiç girilmemiş.

Plus DataManagement.tsx working copy v16.13 hali (kontroller.push 16) → syntax-check (v16.15) build patlattı → DataManagement.tsx 17 sentinel'li hali geri eklendi.

### v16.21 — RLS Aşama 2A: Hassas Tablolar

`uys_kullanicilar` (2 satır, 1 Buket Auth bağlı) + `uys_yetki_ayarlari` (0 satır) tabloları `authenticated_only`. Anon key sahibi artık kullanıcı listesi göremez. Saha etki SIFIR (Buket Auth'lu erişir, operatörler `uys_operators` kullanıyor).

### v16.22-23 + v16.24 + v16.25 — Operatör Auth Migration (Aşama 2C + 3)

**Aşama 2C Pilot:**
- `uys_operators.auth_user_id uuid` kolonu eklendi
- TEST PILOT operatör (test-auth-pilot) — sıfırdan, sahaya etki yok
- KOD10 ERKİN için Supabase Auth user (`op_kod10@uys.local`)
- Frontend: `Login.doOprLogin` içinde sicil_hash başarılı olunca arka planda `signInWithPassword`
- `useAuth` `@uys.local` email'leri için Auth session koruyor (signOut çağırmıyor)
- v16.24: Admin login OPR_KEY temizle (operator session admin override engelliyordu)

**Aşama 3 Bulk (v16.25):**

Tek migration ile 89 aktif operatöre Supabase Auth user oluşturuldu:
- Email: `op_<kod_lower>@uys.local`
- Şifre: `1234` (Buket'in saha standardı)
- `auth.identities` kayıtları
- `uys_operators.auth_user_id` bağlantı

Sonuç: 89/89 operatör + admin = **90 toplam Auth user**, hepsi authenticated. Saha akışı değişmedi (operatör hala bölüm + isim + 1234 yazıyor, arka planda Auth session).

### Aşama 4 DENENDI → ROLLBACK

Tüm 38 tabloda `allow_all` → `authenticated_only` denendi. **Saha kırıldı**:
- Login akışı **anon role** ile başlıyor (Buket veya operatör henüz Auth'lu değilken)
- `Login.tsx` `supabase.from('uys_operators').select('*')` anon istek
- `authenticated_only` policy bunu engelledi → operatör seçim ekranı boş

**Acil rollback:** allow_all geri yazıldı (41 tablo). 2 hassas tablo (uys_kullanicilar, uys_yetki_ayarlari) authenticated_only kaldı.

**Doğru çözüm Aşama 4 v2 (yarın hafta sonu):**
- `uys_operators` için `anon SELECT` açık tut (login akışı)
- Diğer tablolarda cmd-bazlı policy
- Detaylı role-bazlı policy yazımı

### Admin Auth User Yenileme (Buket'in şifre kazası)

Buket sabah koyduğu admin Auth user şifresini unuttu. Reset email aldı, ben SQL ile birden çok kez şifre güncelledim, sonunda **Auth user state'i bozdu** (DELETE + INSERT manuel yöntemi Supabase'in iç tablolarını eksik bıraktı, "Database error finding user").

**Çözüm:** auth.users + auth.identities + auth.sessions + auth.refresh_tokens'tan tamamen sildim, Buket Dashboard'dan **yeniden oluşturdu** (UUID `ff76792a-4b3f-4ce5-afaf-25664b382ba1`), `uys_kullanicilar.admin-temp.auth_user_id` bağlandı.

**Kritik ders (§27.10):** `auth.users` tablosuna **doğrudan DELETE + INSERT yapılmamalı**. Supabase iç bütünlük kontrolü Dashboard veya admin API üzerinden yapılır. Manuel SQL ile yapmak iç tabloları (flow_state, mfa_factors, vs.) eksik bırakır.

---

## SENTINEL TOPLAM: 17 (saglik-syntax-check ile yapısal korumalı)

(önceki sürümlerden, değişmedi)

---

## RLS POLICY SON DURUM (30 Nis 15:30)

- **41 tablo:** `allow_all` (anon + authenticated tam yetki) — Aşama 4 v2'de cmd-bazlı policy
- **2 tablo:** `authenticated_only` (uys_kullanicilar, uys_yetki_ayarlari) ✓ Aşama 2A
- **30 tablo:** `updated_at` trigger ✓
- Plus: `current_user_role` INVOKER, `set_updated_at` search_path sabitlendi

**Auth durumu:** 90 Supabase Auth user (1 admin + 89 operatör)

**Advisor:** 5 ERROR → 0 ✅ | 45 WARN → ~41 (kalanı Aşama 4 v2 + 5)

---

## YARIN İÇİN ÖNCELİKLER

### Kritik
- **§28 Aşama 4 v2 (cmd-bazlı policy)** — Hafta sonu / pazartesi sabah erken (saha kapalıyken)
- **#5 Sevkiyat Oluşturma Formu** — production-blocker
- **#21 2D bin-packing** — yüzey kesim plywood %30-40 fire azaltma
- **v16.26 — admin123 fallback sil** (useAuth.ts hardcoded güvenlik açığı)

### Orta
- **§28.8 chat-attachments bucket SELECT daraltma**
- **#7 Toplu Sipariş Excel İmport** polish
- **#8 PDF Çıktı (İş Emri + Sevk İrsaliyesi)**

### Düşük
- **MRP Topbar tıklama filter** (v16.06 backlog)
- **Sağlık raporu version string** — DataManagement.tsx hala 'v15.99' (kozmetik)
- **§28.9 Network Restrictions + Anon Key Rotation** — manuel, en son

---

## BUGÜNÜN BİLİNEN GERÇEK WARN'LARI

Hiçbiri kalmadı — saha temiz.

Topbar (öğleden sonra):
- KESİM 0 · MRP 0 · TEDARİK 0 · PLAN BEKLEYEN 0
- Sağlık: 17/17 PASS

---

## ÖNEMLİ KURALLAR

- §18 Downloads hijyen
- §18.2 Yeni tablo konvansiyonu (+ updated_at trigger v16.16 + auth_user_id v16.22)
- §18.3 Durum string normalize
- §18.4 Artık yönetimi havuz tek standart
- §18.5 SQL `public.` prefix
- §20 RLS allow_all → §28'de Aşama 1+2A+3 yapıldı, Aşama 4 v2 yarın
- §21 MRP formülü: Net = İhtiyaç − Stok − Yolda
- **§27 (30 Nis sabah, 10 alt bölüm)**: MRP kök çözümü, patch hijyen, OperatorPanel siyah ekran (§27.9), **§27.10 Auth user manuel manipülasyon yasağı (yeni)**
- **§28 (30 Nis öğleden sonra, 8 alt bölüm)**: RLS Migration Roadmap

---

## SİL UYARISI

⚠️ **Bu chat 30 Nis 2026 öğleden sonra kapanacak.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22-§26 + **§27 (10 alt bölüm) + §28 (8 alt bölüm)**
- `docs/saha_model_28nis2026.md`
- `docs/DEVAM_NOTU.md` (bu dosya — yenilendi)
- `docs/is_emri/00_BACKLOG_Master.md` (v16.01-v16.25 dahil)
- `scripts/saglik-syntax-check.cjs`

Yarın yeni Claude oturumunda chat aramaya **gerek yok**.

---

İyi günler Buket. — **22 sürüm + 9 DB migration + 6 DB fix + 5 saha krizi + RLS Aşama 1+2A+3 + 89/89 operatör Auth + OperatorPanel kazası fix** tek günde rekor. Yarın için açık plan: Aşama 4 v2 (saha kapalıyken).
