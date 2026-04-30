# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 30 Nisan 2026 sabah-öğle sonrası (oturum, ~05:00–14:30)
**Son canlı sürüm:** v16.21 (DB migration, kod push'u yok)
**Bugün toplam:** **17 sürüm push** (v16.00 → v16.20) + 1 doc commit + **5 DB migration** (v16.16 trigger, v16.17 RLS pilot+rollback, v16.21 hassas tablolar) + 4 DB veri fix.

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §26 (29 Nis),
  §27 (30 Nis sabah, 9 alt bölüm) ⭐ +
  §28 (30 Nis öğleden sonra) ⭐ YENİ — RLS Migration Roadmap) +
docs/saha_model_28nis2026.md (13 senaryo) +
docs/DEVAM_NOTU.md (bu dosya, 30 Nis 14:30 yenilendi) +
docs/is_emri/00_BACKLOG_Master.md (Son Sürümler v16.01-v16.21 dahil)
oku.

Önceki chat kapandı/kapanacak — tüm bilgi docs/'ta.
```

**Yeni ortam değişiklikleri (30 Nis):**
- **Supabase MCP server bağlandı** (Claude canlı DB'den SELECT/UPDATE/INSERT yapabilir + apply_migration + get_advisors)
- **Supabase Auth aktif Buket için** (uzuniskender@gmail.com, custom auth fallback hala kodda ama plain text şifreler temizlendi)
- Claude Code VS Code uzantısı kuruldu (sabah rate limit oldu, gün ortasında PowerShell zip-apply'a geri dönüldü)
- localStorage debug flag (`UYS_DEBUG_MRP=true`) ile mrp.ts canlı log akışı

---

## 30 NİSAN ÖZETİ — 17 SÜRÜM + 1 DOC + 5 DB MIGRATION

### Bugünün dört büyük başarısı

1. **Sağlık raporu 13 PASS · 2 WARN → 17 PASS · 0 WARN · 0 FAIL** ⭐ (tarihte ilk)
2. **Saha krizi: 3 sipariş × 5 Mayıs termin** kurtarıldı (S26A_03150 + 03146 + 03151), 4 hammadde tedariği açıldı, 7 yuvarlama hatası IE düzeltildi
3. **MRP cutting override mantığı kök çözümü** (LEVHA skip + max(BOM,plan) + camelCase mapping) — gizli kalan eksikleri açığa çıkardı
4. **🆕 RLS Aşama 1 + Aşama 2A** — Supabase advisor 5 ERROR → 0, hassas tabloları authenticated-only

### Sürüm tablosu

| Sürüm | Konu | Kritiklik |
|---|---|---|
| v16.00 | Sağlık #15 sentinel `recipes`/`recs` tipo | 🔴 hotfix |
| v16.01 | MRP filtre `dbEksik` band-aid | 🟡 ara çözüm |
| v16.02 | Cutting override LEVHA skip | 🔴 saha kritik |
| v16.03 | Sentinel #16 sipariş-toplam HM | 🟢 koruma |
| v16.04 | Sentinel #23 — Hesapla UPDATE error | 🟢 koruma |
| v16.05 | Sipariş-bütünü PlanBekliyor (#20) | 🟢 mimari (**v16.20'ye kadar yarım kalmış kazası vardı, §27.9 bak**) |
| v16.07 | **KÖK ÇÖZÜM**: cutting override `max(BOM, plan)` | 🔴 büyük etki |
| v16.08 | `Math.ceil` IE.hm.miktarTotal yuvarlama | 🔴 saha kritik |
| v16.09 | Sentinel #17 — yuvarlama hatası | 🟢 koruma |
| v16.11 | hesaplaMRP debug log altyapısı | 🛠 araç |
| v16.12 | Sağlık raporu camelCase mapping (+41 vakası kök) | 🔴 büyük etki |
| v16.13 | Sentinel #15 `recipes`→`recs` (kazara silinmişti) | 🔴 kaza fix |
| v16.14 | Sentinel #16 + #17 geri ekle (yine kazara silinmiş) | 🔴 kaza fix |
| v16.15 | `scripts/saglik-syntax-check.cjs` prebuild hook | 🟢 yapısal koruma |
| **v16.16** *(DB)* | **PostgreSQL `updated_at` trigger 30 tabloya yayıldı** | 🟢 temizlik (#23 kapandı) |
| **v16.17** *(DB)* | **RLS Aşama 1**: 5 ERROR → 0 (RLS açılım + fonksiyon güvenlik) | 🟢 güvenlik |
| **v16.18** | **Supabase Auth email/şifre login** (yan yana, eski custom korundu) | 🔴 büyük (Buket admin migrate) |
| v16.19 | OperatorMain orders fix denemesi (build patladı, revert) | 🟡 atlanmış |
| **v16.20** | **DataManagement #16+#17 geri ekle + OperatorPanel orders destructure** (siyah ekran fix) | 🔴 saha kritik |
| **v16.21** *(DB)* | **Hassas tablolar authenticated-only** (uys_kullanicilar, uys_yetki_ayarlari) | 🟢 güvenlik (Aşama 2A) |

Doc commit: `e753e71` (DEVAM_NOTU + Backlog + Bilgi Bankası §27 ilk yazım).

---

## ANA ÇIKTILAR

### 1-4. (Sabah saatleri — §27'de detay)
- MRP Cutting Override kök çözümü (v16.02 + v16.07)
- IE Yuvarlama Hatası (v16.08)
- Sağlık Raporu CamelCase Mapping (v16.12)
- Sipariş-Bütünü PlanBekliyor (v16.05 → v16.20'ye kadar yarım)

### 5. v16.16 — `updated_at` Trigger 30 Tabloya Yayılım

`set_updated_at()` PL/pgSQL fonksiyonu zaten DB'de tanımlıydı (kim oluşturduğu commit history'sinde belirsiz). Sadece **bir tabloda** (uys_hm_tipleri) trigger'a bağlanmıştı. Migration ile kalan 29 tabloya `BEFORE UPDATE FOR EACH ROW` trigger eklendi.

**#23 "bug değil" yanılgısı:** Hesapla butonu `update({ mrp_durum: ... })` yazınca DB'ye doğru yansır, ama `updated_at` sabit kalır → biz "UPDATE atılmadı" sandık. Trigger eklendi → her UPDATE otomatik zaman damgalı. Saha açısından zarar yok ama gözlem rahatlar.

### 6. v16.17 — RLS Aşama 1: Yapı + Sertleştirme

Supabase advisor 5 ERROR + 45 WARN raporladı. Aşama 1 amacı: ERROR'ları kapatmak, sahaya zarar vermeden.

- **5 RLS olmayan tabloya RLS aç + allow_all policy** (uys_acik_barlar, uys_mrp_calculations, uys_mrp_rezerve, uys_pending_flows, uys_test_runs, uys_v15_31_silinen_hareketler)
- **`set_updated_at` search_path = public, pg_temp** (search_path injection korumasi)
- **`current_user_role` SECURITY DEFINER → INVOKER** (anon execute revoke)

Pilot: önce `uys_notes` (Buket "not yazabildim" ile doğrulama). Sonra 37 tabloya yayım denendi → operatör paneli SİYAH EKRAN → ROLLBACK → `allow_all` geri geldi. Allow_all rollback OperatorPanel sorunu çözmedi (orders is not defined RLS değil, kod hatasıydı — §27.9'a bak).

**Sonuç:** ERROR 5 → 0 ✅, WARN 45 → ~41 (kalan allow_all + bucket).

### 7. v16.18 — Supabase Auth Migration (Buket admin için)

Buket plain text "admin/test123" ile login yapıyordu. Supabase Auth'a `uzuniskender@gmail.com` user'ı oluşturdu (UUID b452596c-...). Frontend `useAuth.signIn`'de email path eklendi:

```ts
if (username.includes('@')) {
  return await supabase.auth.signInWithPassword({ email: username, password })
}
// ...mevcut custom auth (geriye uyumluluk)
```

`uys_kullanicilar.admin-temp` kaydına `auth_user_id` bağlandı. `sifre=NULL` yapıldı (plain text temizlik). DENEME kullanıcısı da `sifre=NULL` (artık login olamaz).

### 8. v16.20 — OperatorPanel Siyah Ekran (v16.05 baştan kırıkmış!)

Buket Operatör Paneli linkine tıkladığında `Uncaught ReferenceError: orders is not defined`. Bundle analizi gösterdi: `OperatorMain` component'inde `useMemo(() => computeOrderHammaddeEksik(orders, ...), [...])` çağrısı var ama `useStore()` destructure'da `orders` YOK.

**v16.05 baştan kırıkmış**, kimse fark etmemiş çünkü Buket admin olarak Operatör Paneli'ne hiç girmemiş. v16.20 ile destructure'a `orders` eklendi.

Plus v16.14 patch'inde DataManagement.tsx 17 sentinel'liydi ama working copy bir noktada 16'ya düştü → v16.19 push'u syntax-check ile patladı → revert → v16.20 ile DataManagement.tsx 17'li hali geri eklendi (v16.14 hali).

**Önemli ders (§27.9):** Yeni eklenen mantık (computeOrderHammaddeEksik gibi) **kullanılmadığı sayfalarda fark edilmez**. Sadece pilot test (admin tüm sayfaları gez) bunu yakalar.

### 9. v16.21 — RLS Aşama 2A: Hassas tablolar authenticated-only

`uys_kullanicilar` (2 satır, 1 Buket Auth bağlı) + `uys_yetki_ayarlari` (0 satır) tabloları sadece `authenticated` role'e açık. Anon erişim kapatıldı.

Saha etki: SIFIR. Buket Auth'lu erişir, operatörler bu tablolardan zaten okumuyordu. Anon key sahibi artık kullanıcı listesini ve şifre alanını göremez.

---

## SENTINEL TOPLAM: 17 (saglik-syntax-check ile yapısal korumalı)

- #1-11 önceden vardı
- #12, #13, #14 (29 Nis, v15.89)
- #15 (29 Nis, v15.99)
- **#16 (30 Nis, v16.03)** — sipariş-toplam HM (cutting override bypass)
- **#17 (30 Nis, v16.09)** — hm.miktarTotal=0 yuvarlama hatası

**v16.15 prebuild hook**: kontroller.push >= 17 + recipes referans yasağı. Kazara silme imkansız.

---

## RLS POLICY SON DURUM (30 Nis 14:30)

- **38 tablo**: `allow_all` (anon + authenticated tam yetki) — Aşama 2C/3'te role-bazlı ayrım yapılacak
- **2 tablo**: `authenticated_only` (uys_kullanicilar, uys_yetki_ayarlari) — Aşama 2A ✓
- **30 tablo**: `updated_at` trigger ✓
- Plus: `current_user_role` INVOKER, `set_updated_at` search_path sabitlendi, RLS olmayan tablolara açıldı

**Advisor:** 5 ERROR → 0 ✅ | 45 WARN → 41 (kalanı Aşama 3-4)

---

## YARIN İÇİN ÖNCELİKLER

### Kritik
- **§28 Aşama 2C**: Operatör Auth pilot — 1 operatöre Supabase Auth user oluştur, frontend sicil_hash ile yan yana test. Çalışırsa 88 operatör için strateji belirgin.
- **§28 Aşama 3**: 88 operatör Supabase Auth migration (hafta sonu / pazartesi sabah erken — saha kapalıyken)
- **#5 Sevkiyat Oluşturma Formu** — production-blocker. UYS v3'te liste var, oluşturma yok.
- **#21 2D bin-packing** — yüzey kesim plywood %30-40 fire azaltma

### Orta
- **§28 Aşama 2B**: chat-attachments bucket SELECT daraltma (operatör Auth migration sonrasında daha güvenli, şimdi öteleli)
- **#7 Toplu Sipariş Excel İmport** — polish
- **#8 PDF Çıktı (İş Emri + Sevk İrsaliyesi)** — Kalite Müdürü için zorunlu
- **§28 Aşama 4**: Tüm 38 tablo `allow_all` → role-bazlı policy yazımı (operatör Auth migration sonrası)

### Düşük
- **MRP Topbar tıklama filter** (v16.06 backlog) — Plan Bekleyen rozeti
- **Sağlık raporu version string** — DataManagement.tsx hala `'v15.99'` (kozmetik)

---

## BUGÜNÜN BİLİNEN GERÇEK WARN'LARI (KOD DEĞİL, SAHA AKSİYON)

Hiçbiri kalmadı — saha temiz, tüm tedarikler açıldı, stok yeterli.

Topbar (öğle sonrası):
- KESİM 0 · MRP 0 · TEDARİK 0 · PLAN BEKLEYEN 0
- Sağlık: 17/17 PASS

---

## ÖNEMLİ KURALLAR

- §18 Downloads hijyen
- §18.2 Yeni tablo konvansiyonu (+ updated_at trigger v16.16)
- §18.3 Durum string normalize
- §18.4 Artık yönetimi havuz tek standart
- §18.5 SQL `public.` prefix
- §20 RLS allow_all → **DEĞİŞTİ**: §28'de Aşama 1 ve 2A yapıldı, Aşama 3'te tüm tablolara role-bazlı policy
- §21 MRP formülü: Net = İhtiyaç − Stok − Yolda
- **§27 (30 Nis sabah, 9 alt bölüm)**: MRP cutting kök çözümü, patch hijyen krizi, OperatorPanel siyah ekran (yeni §27.9)
- **§28 (30 Nis öğleden sonra) — YENİ**: RLS Migration Roadmap (4 aşama)

---

## SİL UYARISI

⚠️ **Bu chat 30 Nis 2026 öğleden sonra kapanacak.** Bilgilerin tamamı:
- `docs/UYS_v3_Bilgi_Bankasi.md` §22-§26 + **§27 (9 alt bölüm) + §28 (yeni) ⭐⭐**
- `docs/saha_model_28nis2026.md`
- `docs/DEVAM_NOTU.md` (bu dosya — yenilendi)
- `docs/is_emri/00_BACKLOG_Master.md` (v16.01-v16.21 dahil)
- `scripts/saglik-syntax-check.cjs` (yapısal koruma)

Yarın yeni Claude oturumunda chat aramaya **gerek yok**.

İyi günler Buket. 🌞 — **17 sürüm + 5 DB migration + 4 DB fix + 5 saha krizi + RLS Aşama 1 + Auth migration** tek günde rekor.
