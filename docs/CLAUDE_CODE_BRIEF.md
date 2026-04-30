# Claude Code İş Özeti — UYS v3 (1 Mayıs 2026'dan itibaren)

> Bu dosya **Claude Code** (VS Code uzantısı) için brief'tir. Claude Code Anthropic'in API entegrasyonu ile çalışır, terminal'de `claude code` komutu ile veya VS Code'da bypass mode ile.
>
> Bu farklı, **Claude.ai sohbeti** (Buket'in kullandığı) ile koordinasyonlu çalışır. Genel kural: **büyük sürüm sıçramaları + saha test + DB tarafı işler Claude.ai sohbetinde**, **rutin frontend patch + dosya editleme + büyük refactor Claude Code'da**.

---

## 🔓 ACİL BİLGİ — sistem girişi

```
URL:    https://uzuniskender.github.io/ozler-uys-v3/
Email:  admin@uys.local
Şifre:  1234
```

Yedek (her zaman çalışır): Supabase Dashboard → Auth → Users → `uzuniskender@gmail.com` → **Send Magic Link**.

---

## 30 Nisan 2026 Bugün — Açılış Bilgisi

12 saatlik sprint:
- **23 sürüm + 10 DB migration + 7 DB veri fix**
- **Sağlık 13 PASS · 2 WARN → 17/17 PASS · 0 WARN · 0 FAIL** (tarihte ilk)
- **89/89 operatör + admin gerçek Supabase Auth'lu** (token boş string nüansı çözüldü, §27.11)
- **5 saha krizi çözüldü** (S26A_03150 + 03146 + 03151)
- **OperatorPanel 9 ay önceki kazası** bulundu+düzeltildi (v16.05 destructure eksik)
- **RLS Aşama 1 + 2A + 3 ✓**, Aşama 4 v2 hafta sonu için
- **Advisor 5 ERROR → 0**

**Bugün KAÇIRMA listesi:**
- DEVAM_NOTU.md (12 saatlik tam özet, sürüm/DB tabloları)
- UYS_v3_Bilgi_Bankasi.md §27 (11 alt bölüm) + §28 (8 alt bölüm)
- 00_BACKLOG_Master.md (Son Sürümler v16.01-v16.26)

---

## 1 Mayıs İçin Öncelikler

### A — Bekleyen v16.x (kod patch, Claude Code uygun)

#### A.1 — admin123 fallback sil (5 dk, **küçük güvenlik**)

`src/hooks/useAuth.ts` satır ~115-125 civarı:

```ts
// Eski admin şifre kontrolü (geriye uyumluluk)
const ADMIN_PASS = 'admin123'
const customPass = localStorage.getItem('uys_admin_pass')
if (password === ADMIN_PASS || (customPass && password === customPass)) {
  // ...
}
```

**Bu blok tamamen silinmeli.** v15.x kalıntısı, hardcoded şifre güvenlik açığı. Magic Link + admin@uys.local artık var, gerek yok.

#### A.2 — Sağlık raporu version string güncelle (kozmetik)

`src/pages/DataManagement.tsx` satır ~848:
```ts
setReport({ timestamp: ..., version: 'v15.99', ... })
```
→ `version: 'v16.26'` veya dinamik (package.json'dan)

#### A.3 — MRP Topbar tıklama filter (#v16.06 backlog)

Topbar'daki **Plan Bekleyen** rozeti tıklayınca **`/workorders?statusFilter=PlanBekliyor`** route'una git (şu an tüm IE'leri gösteriyor).

`src/components/layout/Topbar.tsx`'te `navTo('/work-orders?statusFilter=PlanBekliyor')`.

`src/pages/WorkOrders.tsx`'te `useSearchParams` ile filter parse et.

### B — Büyük işler (Claude.ai sohbeti tercih, Claude Code yardımcı)

#### B.1 — RLS Aşama 4 v2 (cmd-bazlı policy, **hafta sonu / pazartesi sabah erken — saha kapalıyken**)

Detay: Bilgi Bankası §28.6.

Strateji:
- `uys_operators` için **anon SELECT açık** (login akışı için, chicken-and-egg)
- Diğer 40 tablo: `authenticated_only` (anon erişim kapalı)
- `uys_kullanicilar` + `uys_yetki_ayarlari` zaten authenticated_only ✓ (Aşama 2A)

Risk: dün 30 Nis Aşama 4 (toptan authenticated_only) sahayı kırdı. Bu sefer **tek tablo bazında dikkatli + her birinden sonra UI test**.

Test ortamı önce: `cowgxwmhlogmswatbltz` (Playwright DB).

#### B.2 — #5 Sevkiyat Oluşturma Formu (production-blocker)

UYS v3'te sevkiyat **listesi** var, **oluşturma formu yok**. Sahada hala eski monolit kullanılıyor sevk için. Bu kapatılırsa UYS v3 saha tamamen migrate olur.

Tahmini iş: 4-6 saat, frontend (Shipment.tsx + form component) + Supabase INSERT (uys_sevkler + uys_sevk_satirlari).

#### B.3 — #21 2D bin-packing (yüzey kesim, plywood)

Mevcut `boykesimOptimum` 1D bin-packing → plywood %30-40 fire fazla. 2D rectangular bin-packing algoritması (Guillotine cut variant) gerekli.

Tasarım: 2 saat. Kod: 1 hafta.

#### B.4 — #8 PDF Çıktı (İş Emri + Sevk İrsaliyesi)

ISO 9001/14001/45001 audit'lerde Buket'in elinden çıkması zorunlu. Mevcut PDF kütüphanesi var (`pdf-lib` veya `jsPDF`).

---

## Claude Code Workflow Kuralları (yeni)

### Kural 1 — Patch hijyen (§27.7)

- Full-file replace: **canlı repo'dan dosyayı çek, üzerine işle** (eski snapshot'tan başlama)
- Buket'e PowerShell'den `git show HEAD:src/...` ile dosyayı zip'leyip iste
- Yarım kalan değişiklikler **commit edilmemeli**, push'lanmamalı
- v16.15 syntax-check.cjs prebuild hook çalışıyor: `kontroller.push >= 17` + `recipes` yasağı
- Eğer build patlarsa `git revert HEAD --no-edit` ile geri al

### Kural 2 — Auth user manipulation (§27.10)

- `auth.users` tablosuna **DELETE + INSERT yapma** (iç tablolar bozulur)
- Yeni Auth user = Dashboard veya admin API
- Mevcut user = sadece `encrypted_password` UPDATE OK
- SQL INSERT yaparken token alanları **`''`** (boş string), NULL DEĞİL (§27.11)

### Kural 3 — Test önce, deploy sonra

- Frontend patch + push → Actions yeşil bekle (3-5 dk)
- GitHub Pages CDN propagation → 5-30 dk (kontrolümüz dışı)
- Test: Buket'in tarayıcı, sıkı temizlik (Application → Clear site data) + Ctrl+Shift+R
- Çalışmıyorsa **revert**, kafadan tahmin yapma

### Kural 4 — Saha öncelikli

- Saha çalışırken (operatörler login durumdayken) breaking değişiklik **YASAK**
- Büyük işler hafta sonu / saat 06:00 sabah erken (saha kapalı)
- Sahaya etki edebilecek SQL → önce test ortamında dene (`cowgxwmhlogmswatbltz`)

---

## Bilinen Çözüm Dahil Backlog

| # | İş | Durum | Tahmin |
|---|---|---|---|
| #5 | Sevkiyat Oluşturma Formu | 🔴 **Production-blocker** | 4-6 saat |
| #7 | Toplu Sipariş Excel Import polish | 🟡 v15.98 bulk fix var | 1-2 saat |
| #8 | PDF Çıktı (IE + Sevk İrsaliyesi) | 🟡 ISO audit için zorunlu | 3-4 saat |
| #12 | RLS Tam Uygulama | 🟢 **Aşama 1+2A+3 tamam, 4 v2 sırada** | 1 gün |
| #20 | Sipariş-bütünü PlanBekliyor | ✅ v16.05+v16.20 | — |
| #21 | 2D bin-packing | 🟡 plywood fire azaltma | 1 hafta |
| #22 | Sağlık #16 sentinel | ✅ v16.03 | — |
| #23 | Hesapla mrp_durum updated_at | ✅ v16.16 (#23 "bug değil", trigger fix) | — |
| - | admin123 hardcoded sil | 🔴 güvenlik açığı | 5 dk |
| - | MRP Topbar tıklama filter | 🟡 v16.06 backlog | 30 dk |

---

## Ortam Bilgisi

### Supabase
- **Production proje:** `lmhcobrgrnvtprvmcito` (`ozler-uys-v3`, Frankfurt)
- **Test ortamı:** `cowgxwmhlogmswatbltz` (`ozler-uys-test`, Playwright E2E için)
- Anon key: bundle'da public (Aşama 5'te key rotation hedef)

### GitHub
- Repo: `uzuniskender/ozler-uys-v3`
- Branch: `main`
- Build: GitHub Actions → GitHub Pages
- URL: `https://uzuniskender.github.io/ozler-uys-v3/`

### Lokal makine
- USERPROFILE: `iskender.uzun` (ana) veya `Iskender` (yedek)
- Repo path: `Documents\GitHub\ozler-uys-v3`
- PowerShell 5 + ASCII-only komut konvansiyonu

### Gizli yedek
- Supabase MCP server bağlandı (Claude.ai sohbet için canlı DB erişimi: SELECT/UPDATE/INSERT/apply_migration/get_advisors)

---

*Bu brief 30 Nis 2026 ~17:00'da Claude.ai sohbeti tarafından hazırlandı. Sonraki Claude Code oturumu önce DEVAM_NOTU.md + Bilgi Bankası §27+§28 oku, sonra bu brief'i. Plus saha aktifse breaking değişiklik yapma.*
