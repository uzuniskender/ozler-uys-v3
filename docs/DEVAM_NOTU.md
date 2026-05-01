# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 1 Mayıs 2026 akşam (İşçi Bayramı — saha kapalı, ideal pencere fırsatı kullanıldı)
**Son canlı sürüm:** v16.35 (kod) + DB Aşama 4 v2 + mrp_state + Smart Invalidation + Faz B kod-only altyapı
**Bugün toplam:** **14 kod sürümü** (v16.27 → v16.35) + **5 DB migration** (Faz A) + **Faz B kod-only altyapı** (DB değişikliği yok) + **BUG-v16.34-001 ÇÖZÜLDÜ** (v16.35)

> **30 Nisan tam günü** ayrıntıları için → Bilgi Bankası §27 (10 alt bölüm) + §28 (8 alt bölüm).
> 1 May'ın yeni öğrenmeleri **§27.12, §28.6.1, §28.6.2, §29 (1-6), §32 (1-7), §33** olarak Bilgi Bankası'nda.
> 1 May akşam Faz B + saha doğrulama notları aşağıda (yeni bölüm).

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
  §27 (30 Nis sabah, 12 alt bölüm),
  §28 (RLS Migration Roadmap, 8 alt bölüm + §28.6.1 + §28.6.2),
  §29 (PDF altyapı, 6 alt bölüm),
  §32 (İş Emri #14 Faz A, 7 alt bölüm — mrp_state cache + smart invalidation bug fix),
  §33 (1 May sprint tablosu),
  §32.8 (Faz A+B saha doğrulaması ve kapanışı))
+ docs/DEVAM_NOTU.md (bu dosya)
+ docs/is_emri/00_BACKLOG_Master.md
+ docs/is_emri/14_MimariRefactor.md (Faz A ✓ + Faz B ✓ TAMAMLANDI, Faz C iptal kararı bekleniyor)
+ docs/14B_SLICE2_NOTU.md ve docs/14B_SLICE3_NOTU.md (Faz B detayı)
```

---

## 1 MAY ÖZETİ — 13 SÜRÜM + 5 DB MIGRATION + FAZ B KOD-ONLY

### Bugünün BEŞ büyük başarısı

1. **RLS Aşama 4 v2 (✓ TAM TAMAMLANDI):** 43/43 tablo güvenli (sonra 45/45 oldu, mrp_state ile). 30 Nis Aşama 4 toptan rollback'inden sonra cmd-bazlı + role-bazlı ikili strateji ile chicken-and-egg çözüldü.

2. **PDF Altyapı (✓ İş Emri + Sevk Belgesi):** jsPDF + jspdf-autotable + DejaVu Sans (Türkçe) ile sıfırdan kuruldu. 2 belge tipi sahada kullanımda.

3. **Sevk Belgesi Mimari Kararı:** UYS v3'te "İç Sevk Belgesi" (yasal değil), DİA + MAVVO'da yasal e-İrsaliye. Profesyonel ayrım.

4. **İş Emri #14 Faz A (✓ TAMAMLANDI):** mrp_state cache altyapısı (2 tablo, 7 trigger), 7 caller cache wrap, smart invalidation bug fix.

5. **İş Emri #14 Faz B (✓ TAMAMLANDI):** order state machine kod-only altyapı — 10-state enum, stateMachine.ts (123 satır transition kuralları), state field types/store'a eklendi, UI rozet refactor (Orders state sütunu + detail + Sidebar). DB migration yok, frontend hesaplama. Saha gözlem 1 Mayıs akşam yapıldı: state rozeti DOĞRU çalışıyor (27 sipariş üzerinden doğrulama).

### Kod sürüm tablosu

| Sürüm | İş | Saha Test |
|---|---|---|
| v16.27 | admin123 sil + version str + Topbar 3-in-1 | ✅ |
| v16.27a | useAuth email path geri ekle | ✅ |
| v16.27c | Topbar.tsx satır 1 escape hotfix | ✅ |
| v16.28 | Login.tsx hash UPDATE refactor (OP2 ön hazırlık) | ✅ |
| v16.29 | jsPDF + DejaVu + İş Emri PDF | ✅ |
| v16.29a + 29b | package-lock.json regen | ✅ |
| v16.30 | Sevk Belgesi PDF + jenerik imza | ✅ |
| v16.30a | Sevk mapper genişletme (4 alan) | ✅ |
| v16.31 | IE #14 Faz A Slice 1+2: mrp_state cache altyapısı | ✅ |
| v16.32 | IE #14 Faz A Slice 3: 7 caller cache wrap | ✅ (smart invalidation bug fix sonrası) |
| v16.32 docs (acfa0b6) | docs: Faz A özeti §32 + 1 May sprint §33 + DEVAM_NOTU yenileme | — |
| **v16.33** | **IE #14 Faz B Slice 2: state field + stateMachine.ts altyapı** | ✅ |
| **v16.34** | **IE #14 Faz B Slice 3: UI rozet refactor (state sütunu + detail + sidebar)** | ✅ (saha gözlem 1 May akşam) |
| **v16.35** | **BUG-v16.34-001 fix: orderPct iptal İE filtreler + detail modal İPTAL rozeti** | ✅ (S26A_03051 sahada doğrulandı: %50 → %100, modal'da iptal İE'ler net) |

### DB Migration tablosu

| # | İçerik | Bölüm |
|---|---|---|
| 1 | RLS Aşama 4 v2 OP3 (40 tablo authenticated_only) | §28.6.1 |
| 2 | RLS Aşama 4 v2 OP2 (uys_operators policy ayrımı) | §28.6.2 |
| 3 | TEST-SEV-26-001 (test sevkiyat) | §29 |
| 4 | mrp_state tabloları + 7 trigger (Slice 1) | §32.2 |
| 5 | Smart invalidation (Migration v3 bug fix) | §32.6 |

> Faz B (v16.33 + v16.34) **DB migration eklemedi** — state hesabı frontend'de stateMachine.ts içinde yapılıyor, DB'ye yazılan `state` kolonu mevcut. Faz B saf kod refactor + UI rozet.

---

## RLS POLICY SON DURUM (1 May 2026)

| Kategori | Tablo | Policy |
|---|---|---|
| **authenticated_only (Asama 2A)** | 2 | uys_kullanicilar, uys_yetki_ayarlari |
| **authenticated_only (Asama 4 v2 OP3)** | 40 | Tüm üretim verileri |
| **authenticated_only (Faz A — mrp_state)** | 2 | uys_mrp_state_global, uys_mrp_state_order |
| **uys_operators (Asama 4 v2 OP2)** | 1 | anon SELECT only, authenticated full |
| **TOPLAM güvenli** | **45/45** | %100 |

---

## MRP STATE CACHE — SON DURUM (1 May 2026)

```
src/features/production/mrpCache.ts        — 5 fonksiyon (get/set Global/Order, clearAll)
src/features/production/mrp.ts             — hesaplaMRPCached() callback wrapper
DB: uys_mrp_state_global (singleton)       — global cache
DB: uys_mrp_state_order (PK = order_id)    — per-order cache, FK CASCADE
DB: 2 invalidation function + 7 trigger    — smart invalidation v3
```

**Cache wrap noktaları (7):** autoChain.ts:252, Orders.tsx:248+857, DataManagement.tsx:217+268, MRP.tsx:260+300.

**Cache'lenmeyen 6 nokta:** MRP.tsx:58/136 (useMemo, Slice 4 iptal), MRP.tsx:254 (ymSet), Orders.tsx:243 (toplu), testRunner.ts (test mode bypass), hammaddeTahsis.ts:80 (özel mod).

**Smart invalidation:** UPDATE'lerde sadece MRP-kritik kolonlar invalidate eder. `mrp_durum`, `sevk_durum`, `oncelik`, `not_` cache'i bayatlatmaz.

**Detay:** Bilgi Bankası §32.

---

## ORDER STATE MACHINE — SON DURUM (1 May 2026, Faz B)

```
src/features/order/stateMachine.ts  — 123 satır, 10-state enum + transition kuralları
src/types/index.ts                  — OrderState tip tanımı (+20 satır)
src/store/index.ts                  — state field zustand store entegrasyonu (+2 satır)
src/pages/Orders.tsx                — state sütunu rozet render (+6 satır)
src/components/layout/Sidebar.tsx   — state'e göre navigasyon (+4 satır)
DB: uys_orders.state                — USER-DEFINED enum (mevcut, yeni eklenmedi)
```

**State enum (10):**
yeni → recete_yok → plan_bekliyor → tedarik_bekliyor → uretilebilir → uretiliyor → tamamlandi → kapanma_bekliyor → kapali / iptal (terminal)

**"Tamamlandı" kuralı:** iptal olmayan tüm iş emirleri tamamlandığında geçiş. State machine "iptal" iş emirlerini paydadan düşer (saha doğrulamasında onaylandı).

**İptal:** her non-terminal state'ten erişilebilir, stok hareketleri korunur, açık İE'ler iptal status'a geçer.

**Detay:** docs/14B_SLICE2_NOTU.md, docs/14B_SLICE3_NOTU.md, Bilgi Bankası §32.8.

---

## 1 MAY AKŞAM — SAHA DOĞRULAMA SONUCU

### Faz A+B canlı gözlem (v16.34, 27 sipariş)

- State rozeti dağılımı tutarlı: Üretiliyor / Üretilebilir / Tamamlandı
- Üst bar sayaçları temiz: KESİM 0 / MRP 0 / TEDARİK 0 / PLAN BEKLEYEN 0
- mrp_state cache + smart invalidation canlıda doğru çalışıyor
- DB sorgu doğrulaması (Supabase MCP): state machine kararları DB tarafında doğru yazılıyor

### BUG-v16.34-001 (✅ v16.35 ile ÇÖZÜLDÜ — 1 May akşam)

- **Etki:** 27 siparişten 1'i (S26A_03051, iptal İE içeren tek kayıt)
- **Belirti 1:** İlerleme çubuğu iptal İE'leri paydadan düşmüyor → yanıltıcı %50 (gerçek: 2 tamamlandı / 2 aktif = %100)
- **Belirti 2:** Sipariş detay modal'ında iptal İE'ler "%0" gösteriliyor; "İPTAL" rozeti yok
- **State machine etkilenmemiş** — "Tamamlandı" kararı doğru
- **Düzeltme (v16.35, src/pages/Orders.tsx):**
  - `orderPct()` (satır 131): `&& w.durum !== 'iptal'` filter eklendi → iptal İE'ler ortalamadan düşürüldü
  - İE detay tablosu (satır 1073): iptal İE'ler `opacity-60` + line-through + üretilen "—" + kırmızı "İPTAL" rozeti
- **Test:** Sandbox 5/5 PASS (S26A_03051, hiç iptal yok regression, hepsi iptal edge case, hiç İE yok, 1 tamam + 1 iptal). Saha doğrulama: S26A_03051 satır %100 + modal İPTAL rozeti görünür.

---

## SONRAKİ OTURUM İÇİN ÖNCELİKLER

### 🔴 Kritik (sırada)

**MRP modal birleştirme (Faz 3 single-window):** Memory'de "v15.50a sonrası en yüksek öncelik" notu. Kullanıcı UX'i doğrudan etkiliyor. Mevcut çoklu pencere akışı tek pencerede toplanacak.

**Karar yetkisi:** Buket — MRP Faz 3 başlatılsın mı, yoksa BUG-v16.34-001 önce mi düzeltilsin?

### 🟡 Orta

- **#21 2D bin-packing tasarım dokümanı** (Brief B.3, plywood %30-40 fire kaynağı, kod yok 2 saatlik tasarım)
- **Faz C — Realtime subscription:** İptal değerlendirmesinde. mrp_state cache + smart invalidation saha ihtiyacını karşılıyor, Faz C marjinal getiri sağlıyor. **Karar gerekçesi DEVAM_NOTU'ya yazılmalı** (gelecekte "neden yapılmadı" sorusu çıkar).
- **Saglik-syntax-check genişletme** — `\n` literal taraması tüm `.tsx` (§27.12 TODO)
- **Şirket Profili sayfası** — DataManagement'a tab, hardcoded placeholder yerine DB'den
- **#5 Sevkiyat Formu kapanışı**
- **`admin@uys.local + 1234` saha doğrulama** — incognito test

### 🟢 Düşük

- Stok anomali raporu
- Operatör mesajları paneli
- Toplu sipariş girişi (Excel)
- İstek #18 (fire→sipariş dışı İE)
- İstek #19 (MRP stoktan ver)
- Kesim planı consolidation
- Multi-device single-session enforcement

---

## YENİ ÖĞRENMELER (1 May)

### 1. Literal `\n` escape kazası (§27.12)
3-in-1 birleşik patch'lerde tek-konu commit + her parça için ayrı build doğrulaması zorunlu.

### 2. Patch hijyen — package-lock.json (v16.29a)
`Remove-Item + npm install` pattern'i silme commit'e girme riski. Sandbox'ta lock file `npm install` ile yarat → patch olarak ver.

### 3. Mapper-Tipsiz alan kaybı (v16.30a)
DB kolon ekleme = (1) tip güncelle (2) mapper güncelle (3) UI/PDF kullan, üçü tek patch'te.

### 4. Sevk Belgesi mimari kararı (§29.4)
DİA = yasal, UYS = iç. Audit/yasal sahteciliği önleyen profesyonel separation.

### 5. Smart invalidation gerekliliği (§32.6, 1 May 12:23 keşif)
Saf "her UPDATE invalidate" trigger'ı **caller pattern'lerinde cache'i öldürür**. UPDATE'lerde MRP-kritik kolon kontrolü zorunlu (fonksiyon içinde erken-return — WHEN clause INSERT/UPDATE/DELETE'i tek seferde kapsayamaz).

### 6. Sandbox build kuralı (Memory #25)
TS/JS build/typecheck Buket'in makinesinde DEĞİL, claude.ai sandbox'ta. Her patch öncesi npm ci + npm run build doğrulaması yapılır, hata varsa Slice/patch düzeltilir. Sahaya inmeden build PASS şart.

### 7. Supabase MCP doğrudan kullanımı (Memory #16)
DDL + query'ler Supabase MCP tools (apply_migration, execute_sql) ile claude.ai'den uygulanır. Buket'e PowerShell SQL talimatı verilmez. Önce test projesi (`cowgxwmhlogmswatbltz`), prod (`lmhcobrgrnvtprvmcito`) onay sonrası.

### 8. Saha doğrulama önce, dokümantasyon kapanışı sonra (1 May akşam)
Faz tamamlandı işaretlenmeden önce canlıda gözlem yap. Edge case bug'lar (iptal İE) state machine'in doğru çalışıyor olduğunu **doğrulamayı engellemez** — kozmetik bug ayrı kuyruğa alınır, mimari kapanış yapılır. Eski yöntem: build PASS + sandbox test sonra "TAMAMLANDI" deniyordu, gerçek saha verisinde edge case yakalanamıyordu.

---

## ÖNEMLİ KURALLAR (Memory + Bilgi Bankası §30 IE-UYS-001)

- **IE-UYS-001 (Buket Kıbrıs):** view_range zorunlu, tam dosya read yasak, /compact major commit sonrası, /clear yeni faz, subagent'a delege, %50→commit+compact, %75→kapat, peak 16-22 TR ağır tarama yapma, Bypass Approvals kapalı.
- **Bitti deme kuralı:** Buket "bitti" demeden Claude.ai sohbeti "sprint sonu / günü kapatma" demez. Kalan saat tahmini yapmaz.
- **PowerShell:** ASCII-only, PS5 compatible. Multi-machine: önce `git pull`. Repo zip iste → sandbox build → patch zip teslim → Buket commit/tag/push.

---

## SİL UYARISI

Bu dosya sadece **son sprint odaklı**. 30 Nis bağlamı için → Bilgi Bankası §27 ve §28. Faz A detayları için → §32. Faz B detayları için → §32.8 + docs/14B_SLICE*_NOTU.md. Sprint tablosu için → §33.
