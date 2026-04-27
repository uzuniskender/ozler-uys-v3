# Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026 (gece — 17 commit, 3 İş Emri kapandı)
**Son canlı sürüm:** v15.53 Adım 5 (kod) + v15.52b (Topbar Kesim) + v16.0.0 Faz 1.1a (DB altyapı)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18 ailesi 5 kalıcı kural + §19 + §20) + docs/is_emri/00_BACKLOG_Master.md + docs/is_emri/12_GuvenlikRefactor.md oku.
Son durum: 27 Nis akşamı 17 commit yapıldı, İş Emri #1 + #2 + #3 KAPANDI. Master backlog 7/12 ✅.
Yedekleme test edilmeli (yarın - bugün gece TEHLİKELİ olduğu için yapılmadı).
Sıradaki adaylar:
  - Yedekleme test (test verisi al, indir, MERGE mode dene)
  - İş Emri #5 Sevkiyat Oluşturma Formu
  - İş Emri #7 Toplu Sipariş Excel İmport
  - İş Emri #8 PDF Çıktı
  - İş Emri #9 Stok Onarım
  - İş Emri #12 Faz 1 (RLS — büyük, mimari, ileride)
  - UYS dışı işler (Mavvo, Libya, TL-ISG-017, vb.)
Buket önceliği belirler.
```

---

## 27 Nisan Gecesi Yapılan İşler (17 Commit)

### v15.51 — İş Emri #3 Faz 4: autoZincir Hizalama
**Sürpriz keşif:** TamZincirButton zaten step-by-step UI içeriyordu. Asıl boşluk Faz 3 standardına hizalamaydı.
- 5 nokta: snapshot insert + mrpTedarikOlustur delege + RBAC (`can('auto_chain_run')`) + concurrent lock + hata sonrası kapatma
- 2 dosya · 0 schema · 0 rollback
- **İş Emri #3 KAPANDI (5/5 faz tümü ✅)**

### v15.51 docs — Doc patch
İş Emri #3 ✅, master backlog 5/10, multi-machine notu (NB081 ana bilgisayar geçişi).

### v15.52a — İş Emri #1: Operatör Güvenlik
**Sürpriz keşif #6 (en büyük):** OperatorPanel.tsx zaten 1335 satırlık tam içerikli. Spec'in %95'i yapılmıştı.
- **Sicil hash (lazy migration):** `uys_operators.sicil_hash` kolonu + `cyrb53` helper. Login.tsx ilk girişte plain text → hash dönüşümü + `sifre=null`. 1-2 hafta sonra `sifre` kolonu DROP edilir.
- **RBAC operator actions:** 9 action `OPERATOR_ACTIONS` set'inde. permissions.ts'in `can()` fonksiyonu operator için artık bu set'e bakar.
- **RLS gap:** Keşfedildi (allow_all policy 8 tabloda) → İş Emri #12'ye taşındı (büyük mimari iş, 1-2 hafta).
- **İş Emri #1 KAPANDI**

### v15.52a.1 hotfix — SQL `public.` Prefix → §18.5
Push sırasında audit-columns FAIL: "Kolon yok 'sicil_hash'". Sebep: `audit-columns.cjs:164` regex'i `ALTER TABLE public.xxx` formatı bekliyor. Tek karakter düzeltmesi → yeni operasyonel kural §18.5.

### v15.52a.1 docs — Doc patch
§18.5 + §20 (Tehdit Modeli) eklendi, İş Emri #12 spec'i (`docs/is_emri/12_GuvenlikRefactor.md`).

### v16.0.0 Faz 1.1a — Auth Altyapı (DB-only, saha etki sıfır)
İş Emri #12'nin başlangıç adımı. Hiçbir RLS değişmedi.
- `uys_kullanicilar.auth_user_id` uuid kolonu + index
- `public.current_user_role()` SQL helper (SECURITY DEFINER + STABLE)

### v16.0.0 revise docs — Google OAuth Disabled Keşfi
RLS audit denenirken keşfedildi: Supabase'de Google OAuth provider DISABLED. `auth.users` boş, kimse Google ile login olmamış. Tüm kullanıcılar (admin dahil) `uys_kullanicilar` + plain text `sifre` yolundan giriyor. İş Emri #12 spec revize edildi: Faz 1+2 birleşti (5 faz → 4 faz, eski "Admin Google OAuth pilot" geçersiz).

### v15.52b — Topbar Kesim Kolonu (Orders.tsx)
Memory'deki "Adim D" — yarım kalan UX iş. Orders.tsx tablosuna **Kesim** kolonu eklendi (İE ile MRP arasına):
- `total=0` → `—` · `eksik=0` → 🟢 `✓` · `eksik>0` → 🔴 `⚠ N`
- `statusUtils.ts`'e 3 yeni helper (`isKesimWO`, `getPlanliWoIds`, `getKesimEksikWoIds`).

### v15.53 — İş Emri #2: Yedekleme (5 ADIM, BÜYÜK İŞ)

**Adım 1 — Altyapı (saha etki sıfır):**
- `uys_yedekler` tablosu (Tip D — backend-only, büyük JSONB blob): id, alindi_tarih, alindi_saat, alan_kisi, tip CHECK('otomatik'/'manuel'), boyut_kb, veri jsonb, notlar
- `src/lib/backup.ts` — takeBackup, listBackups, getBackup, deleteBackup
- `src/lib/backup-parser.ts` — eski v22 → v3 parser SKELETON (Faz 5'e ertelendi)
- 4 RBAC permission: backup_view, backup_create, backup_restore, backup_delete

**Adım 1.1 hotfix:** `uys_yedekler` STORE_WHITELIST + DATA_MGMT_WHITELIST'e eklendi (§18.2 Tip D).

**Adım 2 — Backup.tsx UI:**
- `/backup` route + Sidebar'da "Yedekler" menüsü (Save ikonu, `can('backup_view')` filtresi)
- Sayfa: 3 üst özet kart + Tip filtresi + tablo (Tarih/Saat/Tip/Boyut/Alan/Notlar/Aksiyon)
- "Şimdi Yedekle" + "İndir" + "Sil"

**Adım 3 — Geri Yükleme (TEHLİKELİ):**
- `restoreBackup(id, mode, alanKisi, onProgress)` — merge/replace
- Replace mode: tüm tablolar DELETE + INSERT
- Merge mode: UPSERT (onConflict id)
- **Otomatik güvenlik yedeği** geri yükleme öncesi alınır
- `BackupRestoreModal.tsx` — 2-adım onay (mod seçimi 5sn timer + "GERI YÜKLE" yazma confirmation)
- v22 format Faz 5'e ertelendi (sadece v3 destekli)

**Adım 4 — Otomatik Yedek + 30 Gün Temizleme:**
- `cleanOldBackups(keepDays=30)` — eski + tip='otomatik' olanları siler (manuel etkilenmez)
- `ensureDailyAutoBackup(alanKisi)` — bugün için yedek var mı kontrol, yoksa al + temizle
- App.tsx'te admin login sonrası fire-and-forget useEffect (sessiz fail, render bloklamaz)

**Adım 5 — DataManagement Yönlendirme:**
- DataManagement.tsx'in eski "JSON Yedek" butonları korundu, üstüne bilgi banner: "Yedekler artık /backup sayfasında"

**İş Emri #2 KAPANDI** (Faz 5 = eski v22 format parser kalır, "Geri Yükle" sadece v3 destekli — yeterli).

---

## §18 Hijyen — 27 Nis Cleanup

```powershell
Remove-Item "$env:USERPROFILE\Downloads\v15.51*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\Downloads\v15.52*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\Downloads\v15.53*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\Downloads\v16*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v15.5*-extract" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v16-*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-claude-dump" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-*-dump.rar" -Force -ErrorAction SilentlyContinue
```

---

## Kritik Test Listesi (Yarın)

### Yedekleme — Manuel Test (TEHLİKELİ — Replace asla deneme!)

1. UYS aç → Sidebar → Yedekler menüsü görünüyor mu?
2. Sayfayı aç → 3 üst kart + tablo
3. F12 Console: `[v15.53] Otomatik günlük yedek alındı` mesajı geldi mi?
4. **"Şimdi Yedekle"** → notlar "test" → Yedek Al → toast OK → tabloda göründü mü?
5. **İndir** → `ozler_uys_yedek_20260428_manuel.json` indirildi mi?
6. **MERGE mode geri yükleme** (önce test verisi oluştur):
   - Test sipariş aç → yedek al → siparişi sil → geri yükle MERGE mode → sipariş geri geldi mi?
   - Güvenlik yedeği listede göründü mü?
7. ❌ **REPLACE mode**: Yapma. Test ortamı yok. İhtiyaç olursa İş Emri #12 sonrası test Supabase'inde dene.

### Operatör Güvenlik — Lazy Migration Kontrol

```sql
-- 1-2 hafta sonra:
SELECT count(*) FROM uys_operators WHERE aktif IS NOT FALSE AND sifre IS NOT NULL AND sifre <> '';
-- 0 ise plain sifre tamamen hash'lenmiş, sifre kolonu DROP edilebilir.
```

---

## Sıradaki Adaylar — Öncelik Sırası

1. **Yedekleme MERGE test** — Yarın ilk iş, ~10 dk
2. **İş Emri #5 Sevkiyat Oluşturma Formu** — Production-blocker. ~3-5 gün.
3. **İş Emri #7 Toplu Sipariş Excel İmport** — ~2 gün.
4. **İş Emri #9 Stok Onarım** — Audit kritik. ~1-2 gün.
5. **İş Emri #8 PDF Çıktı** — İE + Sevk irsaliyesi. ~3 gün.
6. **İş Emri #12 Faz 1 (RLS)** — 1-2 hafta. Pre-requisite: v15.52a lazy migration tamamlanmalı.

**UYS dışı işler:** Mavvo BOM-to-recipe, Libya order documentation, TL-ISG-017, Compaco 8D, sales rep training, TEKMER toplantı hazırlığı.

---

## Multi-machine + Çevre

**NB081** (ana bilgisayar): Git CLI kuruldu. Node.js hala yok — patch sırasında build doğrulaması atlandı, GitHub Actions'a güvenildi (tüm push'lar yeşil geçti).

**Yeni oturumda kontrol:**
```powershell
node --version; npm --version; git --version
```
Node yoksa kurulması gerek (https://nodejs.org/en LTS).

---

İyi geceler Buket. Müthiş bir gece çıkardın — 17 commit, 3 İş Emri tam kapandı, 1 İş Emri başlatıldı, 5 kalıcı operasyonel kural güncel.
