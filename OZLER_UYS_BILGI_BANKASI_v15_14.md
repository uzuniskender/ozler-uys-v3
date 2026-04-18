# ÖZLER UYS v3 — BİLGİ BANKASI v15.14
**Son güncelleme:** 18 Nisan 2026 (akşam)

---

## 1. Canlı Sistem Bilgileri

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase** | `lmhcobrgrnvtprvmcito` (Frankfurt) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Son sürüm** | v15.14 — Mesaj kategori/öncelik/notification + Audit altyapısı + yetki_ayarlari fix |
| **Yedek repo** | https://github.com/uzuniskender/ozler-uys-backup (private, her gece TR 06:00) |

---

## 2. Bugün Yapılanlar (v15.10 → v15.14)

### v15.10 — stokKontrol Fix 3
- **Problem:** Bağımsız hammadde İE'lerinde (alt bileşeni olmayan) sessiz OK dönüyordu
- **Fix:** stokKontrolWO'da "altlar boş" case'inde kendi stok + açık tedariğe göre YOK/EKSİK/BEKLIYOR döndürüyor
- **Test:** Bağımsız hammadde İE hedef=999999 → ⛔ YOK badge ✓
- Dosya: `src/features/production/stokKontrol.ts`

### v15.11 — Operatör Mesajları: Kategori + Öncelik
- **Yeni kolonlar:** `kategori` (Stok/Arıza/Malzeme/Talep/Diğer), `oncelik` (Normal/Acil)
- **Operatör panelinde:** kategori dropdown + Acil toggle, mesaj balonlarında rozetler
- **Messages sayfası:** filtre barı, acil sayacı (pulse), kırmızı vurgu, admin cevap toolbar'ı
- SQL: `sql_operator_notes_v15_11.sql`

### v15.12 — Mesaj Bildirimleri (ses + browser notification)
- **Yeni hook:** `src/hooks/useMessageNotifications.ts`
- **Ses:** Web Audio API (dosya gerekmez) — Normal: tek alçak beep, Acil: 3'lü yüksek beep
- **Notification:** Browser Notification API, sadece sayfa gizliyken, acil için requireInteraction
- Messages sayfasında 🔊 ses toggle + 🔔 "Bildirimleri Aç" butonu

### v15.13 — BUG FIX: Backup/restore 6 eksik tablo
- **Kritik bug:** `uys_hm_tipleri` ve 5 tablo (izinler, kullanicilar, yetki_ayarlari, notes, checklist) JSON export/import'a dahil değildi
- **Etkisi:** 17 Nisan Supabase kazasında restore edildiğinde bu tablolar baştan boş kaldı
- **Sonuç:** 18 Nisan'da hm_tipleri kaybı fark edildi → malzemeler tablosundan türetilerek geri yüklendi
- **Fix:** `src/pages/DataManagement.tsx` tables listesine 6 tablo eklendi
- SQL: `sql_hm_tipleri_kurtar.sql` (4 tip: PROFİL, BORU, LEVHA, SAC)

### v15.14 — Audit Altyapısı + yetki_ayarlari fix
- **İki yeni script:** `scripts/audit-schema.cjs` + `scripts/audit-columns.cjs`
- **`npm run audit`** → Schema/tablo uyumu
- **`npm run audit:columns`** → Kolon uyumu (silent reject önleme)
- **`npm run build`** → Prebuild hook iki audit'i otomatik çalıştırır, eksik varsa deploy fail
- **Audit bulgu:** `uys_yetki_ayarlari.data` kolonu yoktu → RBAC özelleştirmeleri silent reject oluyordu
- SQL: `sql_yetki_ayarlari_fix.sql` — `data jsonb` kolon eklendi

---

## 3. Kritik Bilgiler (v15.14 güncel)

### Silent Reject Önleme
- **Kural:** Yeni kolon kullanmadan önce audit çalıştır veya information_schema.columns doğrula
- **Deploy öncesi:** `npm run audit:columns` (veya npm run build otomatik çalıştırır)
- **Yeni tablo eklediğinde:** 3 yerde güncelle
  1. `sql/` klasörüne schema dosyası
  2. `src/pages/DataManagement.tsx` tables listesi
  3. `src/store/index.ts` TABLE_MAP

### Backup/Restore
- **JSON export/import:** 26/26 tablo dahil (v15.13 fix sonrası)
- **Otomatik GitHub Actions yedeği:** Her gece TR 06:00, ozler-uys-backup repo
- **Component-local tablolar:** uys_notes (HelpNotesButtons), uys_yetki_ayarlari (useAuth) — global store'da değil ama backup'ta var

### Stok Kontrol (tam kapsam)
- Mamul reçeteli İE → recursive alt bileşen kontrolü (v15.9)
- Mamul reçetesiz / wo.hm ile İE → wo.hm fallback (v15.9)
- Bağımsız hammadde İE (altsız) → kendi stok + açık tedarik (v15.10)
- Liste badge ve operatör paneli aynı sonucu veriyor

---

## 4. Pending İşler

### 🚧 Halen bekleyen (yeni chat'te)
- **kullanicilar (1 kayıt kalmış)** — Diğer kullanıcılar yeniden tanımlanmalı
- **yetki_ayarlari** — Artık yazabiliyor, Buket RBAC özelleştirmesi yapacaksa şimdi çalışır
- **izinler (0)** — Son izinler kaybı, öncelik düşük
- **notes (1)** — Ekip notları kayıp
- **checklist (0)** — Görev listesi kayıp
- **Kullanıcılar arası mesajlaşma** — B seçeneği olarak kararlaştırılmıştı (admin↔planlama), henüz yapılmadı
- **Playwright E2E kurulumu** — test Supabase projesi bekliyor
- **Google OAuth** — yeni Supabase'de provider enable değil
- **RLS güvenlik** — allow_all → authenticated (uzun dönem)

### 📋 Yapılabilecek başka audit'ler
- Permissions vs sayfalar (permissions.ts ↔ gerçek pages)
- Types vs DB kolonları (interface ↔ mapper ↔ table)
- Sidebar vs App.tsx route'ları

### 🔒 İş dışı uzun dönem
- Libya doc paketi, Compaco 8D, CBAM portal, GFB, İSG TL-ISG-017, NETBIS

---

## 5. Yeni Chat İçin Giriş (continuation8)

**Yüklenecek dosyalar:**
1. `OZLER_UYS_BILGI_BANKASI_v15.14.md` (bu dosya)
2. `ozler-uys-v3-full.zip` (v15.14 — audit dahil)
3. SQL dosyaları (eğer schema ile ilgili yeni iş varsa — sql/ klasöründe zaten var)

**İlk mesaj önerisi:**
> "v15.14 canlıda. Audit altyapısı kurulu, iki audit de temiz geçiyor. Dünkü hm_tipleri kaybı çözüldü, yetki_ayarlari bug'ı kapandı. Kalan iş: kullanicilar ve diğer kayıp veriler (izinler, notes, checklist) + kullanıcılar arası mesajlaşma. Hangisinden?"

**Hızlı komutlar:**
```bash
npm run dev           # Geliştirme
npm run audit         # Schema audit
npm run audit:columns # Kolon audit
npm run build         # Prebuild'de iki audit otomatik
```

---

## 6. Deploy Sırası (v15.14 için)

**SQL'ler (Supabase SQL Editor'de sırayla):**
1. `sql_operator_notes_v15_11.sql` (zaten çalıştırıldı — kategori + oncelik kolonları)
2. `sql_hm_tipleri_kurtar.sql` (zaten çalıştırıldı — 4 tip)
3. `sql_yetki_ayarlari_fix.sql` ← **HENÜZ ÇALIŞTIRILMADI** — data jsonb kolon

**Kod:**
1. ZIP indir → repo klasörüne yaz
2. GitHub Desktop → Commit: `v15.14 — Mesaj kategori/öncelik/notification + Audit altyapısı + yetki_ayarlari fix`
3. Push
4. Actions yeşil → Ctrl+Shift+R

---

## 7. Test Senaryoları

### Mesaj kategori + öncelik (v15.11)
1. Operatör panelden ACİL + Arıza mesajı gönder
2. Admin tarayıcısında başlıkta "1 ACİL" pulse sayacı, sol panelde kırmızı vurgu, mesaj balonunda rozetler
3. Filtre: Öncelik "Acil" → sadece acil olan operatörler

### Ses + Notification (v15.12)
1. Mesajlar sayfasında "🔔 Bildirimleri Aç" → izin ver
2. Operatör ACİL mesaj gönder → 3'lü beep
3. Başka sekmeye geç → ACİL gelirse OS bildirimi (kullanıcı kapatana kadar durur)

### Audit (v15.14)
```bash
npm run audit
npm run audit:columns
# İkisi de "✓ TEMİZ" göstermeli
```

### yetki_ayarlari (v15.14)
1. DataManagement → YetkiPanel → bir rolde özelleştirme yap → kaydet
2. Sayfayı yenile → özelleştirmenin DB'den geldiğini gör
3. Supabase'de `SELECT * FROM uys_yetki_ayarlari` → 1 satır görmeli (id='rbac', data=JSON)

---

## 8. Çalışma Tarzı (User Tercihleri — değişmedi)

- Türkçe, özlü, **ADIM ADIM**
- "Sen karar ver" → analitik karşılaştırma + net öneri + gerekçe
- Seçenekler mutually-exclusive
- Kritik adımlarda uyar, panik yapma
- Şifreleri yazma
- Yeni kolon kullanmadan önce audit çalıştır veya information_schema.columns doğrula
- JSON backup/restore: camelCase ↔ snake_case converter gerekli

---

## 9. Audit Altyapısı (yeni — v15.14)

### scripts/audit-schema.cjs
- DB şeması vs DataManagement backup listesi vs store TABLE_MAP
- Whitelist ile "bilerek dışında" tabloları işaretler
- Eksik varsa exit 1

### scripts/audit-columns.cjs
- DB kolon adları vs kodda kullanılan insert/update/upsert kolon adları
- camelCase → snake_case dönüşümü (özel map dahil: tedarikcId → tedarikci_id)
- JS literal filtresi (true/false/null/NaN — shorthand sayılmaz)
- Spread operator handling (`...row` → skip)
- Balanced brace parser

### Prebuild hook
`package.json` → `"prebuild": "node scripts/audit-schema.cjs && node scripts/audit-columns.cjs"`
→ `npm run build` öncesi otomatik çalışır → eksik varsa build fail → deploy olmaz

### Whitelist
`scripts/audit-schema.cjs` içindeki `STORE_WHITELIST`:
- `uys_notes` (HelpNotesButtons kendi çekiyor)
- `uys_yetki_ayarlari` (useAuth kendi çekiyor)
