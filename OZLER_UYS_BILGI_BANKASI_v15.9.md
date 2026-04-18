# ÖZLER UYS v3 — BİLGİ BANKASI v15.9
**Son güncelleme:** 18 Nisan 2026 (öğleden sonra)

---

## 1. Canlı Sistem Bilgileri

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase** | `lmhcobrgrnvtprvmcito` (Frankfurt) |
| **Publishable key** | `sb_publishable_aVJ0v2zKTH4DzchuU2oEbw_YIFQs9YD` |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Son sürüm** | v15.9 — stokKontrol bug fix + otomatik yedekleme |
| **Yedek repo** | https://github.com/uzuniskender/ozler-uys-backup (private) |

⚠️ **Eski Supabase (kudpuqqxxkhuxhhxqbjw) 17 Nisan akşamı kazara silindi.** Yeni proje açıldı, veriler JSON backup'tan restore edildi. **Artık otomatik GitHub Actions yedeği aktif.**

---

## 2. Son Durum (v15.7 → v15.9)

### v15.0-15.4 (17 Nisan akşamı)
- **Sipariş sevk durumu** — orders.sevk_durum, renk kodlu badge
- **Yardım + Ekip Notları** — Topbar'da 📖 + 📝, 14 sayfa yardım, uys_notes tablosu
- **Recursive Stok Kontrol** — Kural: "Alt kırılımın herhangi bir kademesinde yeterli stok varsa OK"
- **MaterialSearchModal** — 6 ölçü filtreli arama, 8 yerde

### v15.5 (Playwright E2E altyapısı — askıda)
- 3 test dosyası hazır, ayrı test Supabase projesi gerekiyor
- Supabase kazası nedeniyle durdu

### v15.6-15.7 (Supabase kazası + kurtarma)
- Eski Supabase silindi → yeni Supabase açıldı
- master_schema.sql çalıştırıldı
- GitHub Secrets güncellendi (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **JSON Import bug fix** — DataManagement.tsx'e camelToSnake converter eklendi
- **Tedarikçi özel eşlemesi** — tedarikcId → tedarikci_id
- Tüm veriler restore edildi (uys_backup_2026-04-18.json)

### v15.8 (Problem Takip merge — 18 Nisan sabahı)
- Paralel "Günaydın" chat'inde eklenen Problem Takip sayfası v15.7 üzerine merge edildi
- 9 dosya: sql_problem_takip.sql, ProblemTakip.tsx, types, store, App, Sidebar, permissions, useRealtime, helpContent
- DataManagement.tsx'e "Problem Takip" backup entry eklendi (pt_problemler)
- Canlı, test edildi

### v15.9 (18 Nisan öğle sonrası) — İKİ BÜYÜK GÜVENCE

**9a) stokKontrol.ts bug fix**
- **Problem:** İş Emirleri listesindeki ⛔ YOK badge'i sessizce OK dönüyordu. Operatör paneli YOK gösteriyordu ama liste badge'i hiçbir şey göstermiyordu → iki yer çelişiyordu.
- **Teşhis:** `dogrudanAltBilesenler` sadece `mamulKod` üzerinden reçete arıyordu + yalnız `kirno` filtresi kullanıyordu. Operatör paneli ise `rcId` + `tip` kullanıyordu.
- **Fix (3 katmanlı):**
  1. Reçete arama: önce `wo.rcId`, sonra `mamulKod`
  2. `kirno` filtresi boş dönerse tip bazlı fallback (Hammadde/YarıMamul)
  3. Reçete bulunamazsa `wo.hm` fallback garanti
- **Test:** IE-MANUAL-MO46VM3J (PROFİL BOY KESİM 60x40x3 348,64MM, hedef 999999) → artık ⛔ YOK badge görünüyor ✓
- **Açık risk:** Reçete VE wo.hm ikisi de boş olan bağımsız İE'lerde hala sessiz OK dönebilir (ör. hammadde için İE açılırsa). Pratik senaryoda nadir, ertelendi.

**9b) Supabase otomatik GitHub Actions yedeği**
- Private repo: `uzuniskender/ozler-uys-backup`
- Workflow: `.github/workflows/backup.yml`
- Cron: `0 3 * * *` (UTC 03:00 = TR 06:00, mesai öncesi)
- Her gece `backups/YYYY-MM-DD/` klasörüne 3 dosya commit:
  - `roles.sql` — kullanıcı/rol tanımları
  - `schema.sql` — tablo yapısı
  - `data.sql` — veri
- Connection: Session pooler (port 5432), `SUPABASE_DB_URL` secret
- Workflow permissions: `contents: write` (yml içinde)
- Repo Settings → Actions → General → **Read and write permissions** aktif
- `git pull --rebase` commit ile push arasında (çakışma önleme)
- İlk yedek başarılı: 18 Nisan 2026, 3074 satır

---

## 3. Problem Takip Özellikleri (v15.8)

- Sol menüde "Problem Takip" (AlertOctagon ikonu) + açık problem sayısı badge
- Durum: Açık / Devam / Kapandı (kapatınca tarih otomatik)
- "+ Yeni Aksiyon Ekle" butonu: `— 18.04.2026 14:45 / Buket:` damgası yapıştırır, metin biriktir, silme
- Son değişiklik barı (ekip koordinasyonu)
- Geciken kayıtlar üstte, sonra Açık > Devam > Kapandı
- Yetkiler: Admin full, ÜretimSor/Planlama/Depocu ekle+düzenle, silme sadece Admin
- Backup: DataManagement'ta pt_problemler entry

---

## 4. Stok Kontrol Mantığı (v15.9 fix sonrası)

**Kural:** Alt kırılımın herhangi bir kademesinde yeterli stok varsa OK. Hiçbirinde yoksa YOK.

**`dogrudanAltBilesenler(malkod, recipes, wo?)` mantığı:**
```
1. Reçete ara:
   a) wo.rcId varsa önce onunla (kök İE için)
   b) mamulKod eşleşmesiyle fallback
2. Reçete bulunduysa:
   a) kirno-based top-level (kirno dolu ve '.' içermez, malkod !== mamulKod)
   b) kirno filtresi boş → tip-based fallback (Hammadde/YarıMamul)
3. Reçete yok veya satır çıkmadı → wo.hm fallback
   (wo.malkod === malkod ve wo.hm dolu)
4. Hiçbiri yok → boş liste (sessiz OK) ← hala risk
```

**Ekran gösterim noktaları:**
- İş Emirleri listesi: `stokBadgeEl(w)` → ⛔ YOK (kırmızı) / ⚠ EKSİK (sarı) / yok (OK)
- İş Emirleri detay modalı: `sk.satirlar` → tablo (Malzeme/Gerekli/Mevcut/Açık Ted./Durum)
- Operatör paneli: ayrı düz HM kontrolü (reçete satırlarından, tip bazlı) — bilgi amaçlı
- Üretim girişi (ProductionEntry): Hammadde DB Stoğu tablosu — bilgi amaçlı

---

## 5. Kritik Kurallar (güncel)

- **Supabase silent reject:** Var olmayan kolon sessiz yok sayılır — yeni kolon kullanmadan önce information_schema.columns ile doğrula
- **UI durum çakışması yasak:** DB öncelikli, pct fire dahil
- **DB-only testler UI bug yakalamaz:** Playwright E2E gerekli
- **JSON backup/restore:** camelCase ↔ snake_case converter gerekli (artık var)
- **Supabase silme felaket:** Free plan'da restore yok. **ARTIK ozler-uys-backup var.**
- **Paralel chat merge dikkat:** Eski ZIP üzerinden çalışan paralel chat, kendi yeni fix'lerini bozabilir — diff alıp seçerek merge
- **İki yerde iki stok kontrol:** Liste badge (stokKontrolWO, recursive) + Operatör paneli (tip bazlı düz). Farklı sonuç verirse fonksiyon uyumsuzluğu olabilir, kontrol et.

---

## 6. Bekleyen İşler

### 🚧 Yarıda kalmış
- **Playwright E2E kurulumu** — test Supabase projesi bekliyor
- **Google OAuth** — yeni Supabase'de provider enable değil
- **RLS güvenlik** — allow_all → authenticated

### 📋 Sıraya alınabilir
- **Stok kontrol Fix 3** — reçete VE wo.hm ikisi de boş İE'lerde hala sessiz OK; hammadde tipi ayrımıyla YOK uyarısı eklenebilir (düşük öncelik)
- Malzeme tablosu iyileştirmeleri (sticky header, sayfalama, zebra, ölçü birleştirme)
- Operatör mesajları paneli (tablo var, UI yok)
- Kesim planı birleştirme
- Toplu sipariş girişi (Excel)
- MRP iyileştirmeleri (İstek #18, #19)
- B8 stok kontrol canlı test (v15.9 fix ile %90 kapandı, başka senaryolar kaldı)

### 🔒 Uzun dönem
- Libya doc paketi, Compaco 8D, CBAM portal, GFB, İSG TL-ISG-017, NETBIS

---

## 7. Yeni Chat İçin Giriş (continuation7)

1. Bu dosyayı yükle (`OZLER_UYS_BILGI_BANKASI_v15.9.md`)
2. `ozler-uys-v3-full.zip` yükle (v15.9 — stokKontrol fix dahil)
3. `master_schema.sql` + `sql_problem_takip.sql` yükle (DB şeması)
4. `backup.yml` referans olarak (GitHub Actions yedek workflow'u, kurulu)

**İlk mesaj önerisi:**
"v15.9 canlıda. stokKontrol fix çalışıyor, Supabase otomatik yedek kurulu. Sıradaki iş ne olacak?"

### Hızlı Komutlar
```bash
npm install
npm run dev
npm run build
```

---

## 8. Çalışma Tarzı (User Tercihleri)

- Türkçe, özlü, **ADIM ADIM** (çok şey yazma aynı anda, tek adım sor cevap bekle)
- "Sen karar ver" → analitik karşılaştırma + net öneri + gerekçe
- Seçenekleri mutually-exclusive
- User'ın yazdığını 2. kez sorma
- Kritik adımlarda uyar, panik yapma
- Şifreleri yazma/gösterme
- Yeni kolon kullanmadan önce information_schema.columns doğrula
- JSON backup/restore: camelCase ↔ snake_case converter gerekli

---

## 9. Son Durum (18 Nisan 2026, öğleden sonra)

✅ Uygulama canlı, v15.9 deploy edildi  
✅ stokKontrol badge bug fix canlıda, IE-MANUAL-MO46VM3J ile doğrulandı  
✅ Supabase otomatik yedek aktif, ilk yedek 18.04.2026 başarılı  
✅ Tüm veriler restore edildi (JSON backup)  
✅ Problem Takip sayfası entegre, çalışıyor  
✅ DataManagement JSON import/export camelToSnake düzgün  
❌ Google OAuth hala çalışmıyor (düşük öncelik)  
🚧 Playwright E2E askıda (test Supabase projesi gerekiyor)  
🚧 Stok kontrol Fix 3 açık (nadir senaryo)  

---

## 10. Kurtarma Prosedürü (yeni Supabase silme senaryosu)

Eğer bir daha Supabase projesi silinir/kaybolursa:

1. **Yeni Supabase projesi aç** — region EU Central (Frankfurt)
2. **ozler-uys-backup** reposundaki en son `backups/YYYY-MM-DD/` klasörüne git
3. SQL Editor'de sırayla Run:
   - `roles.sql` (izinler)
   - `schema.sql` (tablo yapısı)
4. `data.sql` çok büyük olabilir, psql ile import:
   ```bash
   psql "postgresql://postgres.<NEW-PROJE-ID>:<PASSWORD>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres" -f data.sql
   ```
5. **GitHub Secrets güncelle** (ana repo ozler-uys-v3):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. **Backup repo Secrets güncelle** (ozler-uys-backup):
   - `SUPABASE_DB_URL` (yeni connection string)
7. Manuel yedek testi: Actions → Run workflow
8. Uygulamayı rebuild + redeploy
