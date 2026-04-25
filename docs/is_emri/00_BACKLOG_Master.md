# UYS v3 — Master Backlog (İş Emri Listesi)

**Son güncelleme:** 25 Nisan 2026 (v15.46)
**Kaynak oturum:** "Günaydın" chat — eski monolit UYS (`ozleruretim` repo) ile karşılaştırma

---

## 📋 Kullanım

Bu dosya **iki kapsamı** birden tutar:

1. **Orijinal 21 maddelik backlog** — eski sistemde olup UYS v3'te olmayan tüm özellikler (4 kategori altında)
2. **Süzülmüş 10 öneri** — Claude'un production-blocker + kalite açısından önerdiği şortlist

Detaylı iş emirleri `docs/is_emri/01_*.md` ... `06_*.md` dosyalarındadır. Her dosya **bir veya birden fazla** öneriyi paketliyor — o yüzden 10 öneri 6 iş emrinde toplanıyor.

---

## 🟢 SÜZÜLMÜŞ 10 ÖNERİ — DETAYLI İŞ EMİRLERİ

### Production-Blocker (UYS v3 eski sistemin yerini alabilmesi için ZORUNLU)

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 1 | **Operatör Paneli** (`/operator` route) | `01_OperatorPaneli.md` | v15.17.0 | 🟡 Backlog |
| 2 | **Yedekleme Yönetimi** (`/backup` route) | `02_YedeklemeYonetimi.md` | v15.18.0 | 🟡 Backlog |
| 3 | **MRP Hesaplama Modal** | `03_UretimZinciri.md` Faz 3 | v15.21.0 | 🟡 Backlog (Faz B P2 ile örtüşür) |
| 4 | **Kesim Planı Optimizasyon** | `03_UretimZinciri.md` Faz 2 | v15.20.0 | 🟢 **TAMAM** (v15.48: algoritma + UI önizleme + birim test) |
| 5 | **Sevkiyat Oluşturma Formu** | `04_Sevkiyat.md` | v15.23.0 | 🟡 Backlog |
| 6 | **autoZincir** (Sipariş→İE→Kesim→MRP→Tedarik) | `03_UretimZinciri.md` Faz 4 | v15.22.0 | 🟢 **Kısmi yapıldı** (autoChain.ts mevcut) |
| 7 | **Toplu Sipariş Excel İmport** | `05_VeriOperasyonlari.md` Bölüm 1 | v15.24.0 | 🟡 Backlog |

### Kalite/Audit/Operasyonel İhtiyaç

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 8 | **PDF Çıktı (İş Emri + Sevk İrsaliyesi)** | `05_VeriOperasyonlari.md` Bölüm 2 | v15.25.0 | 🟡 Backlog |
| 9 | **Stok Onarım** | `05_VeriOperasyonlari.md` Bölüm 3 | v15.24.1 | 🟡 Backlog |
| 10 | **Üst Bar Durum Göstergeleri** (KESİM/MRP/TEDARİK 🔴/🟢) | `03_UretimZinciri.md` Faz 5 | v15.19.0 | 🟢 **TAMAM** (v15.47 + 3 hotfix: statusUtils ile sağlam) |

### Bonus İş Emri (10 öneri dışı)

| # | Özellik | İş Emri | Tag | Durum |
|---|---------|---------|-----|-------|
| 11 | **Problem Takip Geliştirme** (KPI, sekmeler, tarihçe, yorum) | `06_ProblemTakip.md` | v15.17–v15.18 | 🟢 **Kısmi yapıldı** (UI v15.x'te mevcut) |

---

## 📚 ORİJİNAL 21 MADDELİK BACKLOG (Referans)

10 önerinin nereden geldiğini görmek için orijinal liste de korundu. Çıkarılan 11 maddenin gerekçesi de aşağıda.

### 🔵 Kategori A — Yönetimsel
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| A1 | Operatör Paneli | ✅ Önerildi (#1) | Production-blocker |
| A2 | Yedekleme Yönetimi | ✅ Önerildi (#2) | Risk-averse için kritik |
| A3 | İstek Takip Sistemi | ❌ Çıkarıldı | GitHub Issues bu işi yapar |
| A4 | Görev Listesi | ❌ Çıkarıldı | GitHub Issues bu işi yapar |
| A5 | Sistem Test Motoru | ❌ Çıkarıldı | UYS v3'te Playwright E2E (9/9 green) zaten var |

### 🟠 Kategori B — Üretim Zinciri
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| B6 | autoZincir | ✅ Önerildi (#6) | Production-blocker |
| B7 | MRP Hesaplama Modal | ✅ Önerildi (#3) | Üretim planlamanın kalbi |
| B8 | Kesim Planı + Optimizasyon | ✅ Önerildi (#4) | BOM kuralı: en az fire, en çok parça |
| B9 | Sevkiyat Oluşturma Formu | ✅ Önerildi (#5) | UYS v3'te liste var, oluşturma yok |
| B10 | Üst Bar Durum Göstergeleri | ✅ Önerildi (#10) | Düşük çaba, yüksek değer |
| B11 | Fire → Sipariş Dışı İE Teklifi | 🟢 **Yapıldı** | v15.x fireTelafi.ts mevcut |
| B12 | Toplu Tedarik Modal | ❌ Çıkarıldı | UYS v3'te tedarik akışı zaten yapılandırılmış |

### 🟡 Kategori C — Veri İşlemleri
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| C13 | Toplu Sipariş Excel İmport | ✅ Önerildi (#7) | Günlük sipariş hacmine pratik |
| C14 | PDF Çıktı | ✅ Önerildi (#8) | Kalite Müdürü için zorunlu kağıt belge |
| C15 | Stok Onarım | ✅ Önerildi (#9) | Audit için kritik |
| C16 | Stok Sayım | ❌ Çıkarıldı | Yıllık 1-2 kez kullanım |
| C17 | BOM PDF Doğrulama | ❌ Çıkarıldı | Düşük frekans + ayrı bir araç (BOM-Mavvo) zaten yapıyor |
| C18 | JSON Veri Aktar | ❌ Çıkarıldı | UYS v3'te Veri Yönetimi sayfası zaten var |

### 🟢 Kategori D — UI / Mod
| # | Özellik | Karar | Gerekçe |
|---|---------|-------|---------|
| D19 | Misafir Modu | ❌ Çıkarıldı | UYS v3 RBAC'a "viewer" rolü eklemek 5 dakika |
| D20 | Çakışma Yönetimi | ❌ Çıkarıldı | UYS v3 realtime sync (CLIENT_ID + 7 tablo) yeterli |
| D21 | Raporlara Grafik (Recharts) | ❌ Çıkarıldı | Nice-to-have, tablolar okunabilir |

---

## 🎯 ÖNERİLEN İŞLEM SIRASI

Production-blocker olduğu için **Operatör Paneli (#1)** ve **Yedekleme (#2)** en öncelikli. Sonrasında üretim zinciri (#3-#6-#10), sonra sevk (#5), en son veri operasyonları (#7-#8-#9).

```
Faz 1 (Production-Blocker):
  01 → Operatör Paneli (v15.17.0)
  02 → Yedekleme Yönetimi (v15.18.0)

Faz 2 (Üretim Zinciri — birbirine bağlı):
  03 → Üretim Zinciri (v15.19 → v15.22)
       ├─ Faz 1+5: Veri modeli + Üst Bar (v15.19.0)
       ├─ Faz 2: Kesim Optimizasyon (v15.20.0)
       ├─ Faz 3: MRP Modal (v15.21.0) ← Faz B Parça 2 ile entegre
       ├─ Faz 4: autoZincir (v15.22.0)
       └─ Faz 6: Test (v15.22.1)

Faz 3 (Sevk):
  04 → Sevkiyat Formu (v15.23.0)

Faz 4 (Veri Operasyonları):
  05 → Bölüm 1 Toplu Sipariş (v15.24.0)
  05 → Bölüm 3 Stok Onarım (v15.24.1)
  05 → Bölüm 2 PDF (v15.25.0)
```

**NOT:** Bu sıralama zorunlu değil. Buket önceliği değiştirebilir; her iş emri **bağımsız apply edilebilir**.

---

## 🔗 İLİŞKİLİ DOSYALAR

- **`docs/faz_b_plan.md`** — Sipariş Termin Farkındalığı (3 parça, P1 v15.42'de yapıldı, P2/P3 backlog)
- **`docs/UYS_v3_Bilgi_Bankasi.md`** — Sürüm geçmişi + mimari + öğrenilenler
- **`docs/UYS_v3_Is_Listesi.md`** — Test senaryoları + yasak kontrolleri (operasyonel)

İş emirleri ile Faz B arasında örtüşme noktaları:
- **İş Emri #3 Faz 3 (MRP)** ↔ **Faz B Parça 2 (MRP termin-gruplu)** — birlikte yapılırsa MRP hem termin gruplu hem de net ihtiyaç gösterir.
- **İş Emri #3 Faz 2 (Kesim)** ↔ **Faz B Parça 3 (Kesim manuel kalem seçimi)** — UI bileşeni paylaşılabilir.

---

## ⏱ TAHMİNİ TOPLAM SÜRE

| Faz | Süre |
|---|---|
| Faz 1: Operatör + Yedek | 1.5–2 hafta |
| Faz 2: Üretim Zinciri | 2–3 hafta |
| Faz 3: Sevk | 1 hafta |
| Faz 4: Veri Op. | 1.5–2 hafta |
| **Toplam** | **6–8 hafta** (full-time) |

Bu tahminler diğer bir Claude oturumunun (paralel chat / Claude Code) yapacağı varsayımıyla. Buket'in mevcut iş yükü düşünülürse 3-4 ay'a yayılır.

---

*Bu Master Backlog v15.46 itibariyle günceldir. Her iş emri tamamlandıkça yukarıdaki "Durum" kolonu güncellenmelidir.*
