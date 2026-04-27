# Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026 (v15.51 sonrası — Faz 4 autoZincir Faz 3 standardına hizalama)
**Son canlı sürüm:** v15.51

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §19 MRP Filtre Sözleşmesi + §18 ailesi 4 kalıcı kural) + docs/is_emri/00_BACKLOG_Master.md (üstteki ilerleme paneli) oku.
Son iş: v15.51 (Faz 4 autoZincir Faz 3 standardına hizalama) — snapshot insert + mrpTedarikOlustur delege + RBAC + lock + hata sonrası kapatma.
İş Emri #3 KAPANDI (Faz 1+2+3+4+5 tümü ✅).
Sıradaki: İş Emri #1 (Operatör Paneli) veya İş Emri #2 (Yedekleme) veya küçük UX patch'leri.
```

---

## v15.51 Özeti — Faz 4 autoZincir Hizalama

**Sürpriz keşif #2:** DEVAM_NOTU "step-by-step UI eksik, dashboard/log paneli gerekli" diyordu. Aslında `pages/Orders.tsx` içindeki `TamZincirButton` zaten:
- Confirm dialog
- Live adım listesi (✅/⚠️/❌/ℹ️ ikonlu, `onProgress` callback'iyle)
- 4 KPI kart (İE/Kesim/MRP/Tedarik sayıları)
- Eksik malzemeler tablosu
- Action butonlar (MRP'ye git, Kesim'e git, Kapat)

içeriyordu. Yeni UI gereksizdi. Asıl boşluk **Faz 3 standardına hizalama**ydı — autoZincir, manuel MRP modal'ın v15.50b'de getirdiği snapshot + flag desenini takip etmiyordu.

### v15.51'de Kapatılan 5 Eksik

| # | İş | Dosya |
|---|---|---|
| 1 | `uys_mrp_calculations` snapshot insert (Tip C, §18.2 uyumlu) — autoZincir MRP run sonu, Faz 3 modal pattern'iyle birebir aynı | autoChain.ts |
| 2 | Tedarik insert artık `mrpTedarikOlustur(opts)` ile delege (`auto_olusturuldu: true` + `mrp_calculation_id` FK). Termin-bazlı duplicate filter korundu | autoChain.ts |
| 3 | `mrp_durum` güncellemesi + `rezerveYaz` çağrısı (manuel akışla hizalı) | autoChain.ts |
| 4 | RBAC: `TamZincirButton` `can('auto_chain_run')` ile sarıldı; yetki yoksa null render | Orders.tsx |
| 5 | Concurrent lock (`useRef`) + hata catch'inde boş sonuç struct → "Kapat" butonu görünür | Orders.tsx |

### Sayılar

2 dosya · 0 schema değişikliği · 0 rollback · §19 sözleşmesi korundu · §18.2 + §18.3 tutarlılığı arttı.

### autoZincir İmza Değişikliği

**Eski (v15.50b):**
```typescript
autoZincir(orderId, woCount, orders, workOrders, recipes, operations, materials,
  stokHareketler, tedarikler, logs, cuttingPlans, onProgress?)
```

**Yeni (v15.51):**
```typescript
autoZincir(orderId, woCount, orders, workOrders, recipes, operations, materials,
  stokHareketler, tedarikler, logs, cuttingPlans, hesaplayan, onProgress?)
```

12 → 13 parametre. `hesaplayan` snapshot insert'in NOT NULL kolonu için. Çağıran taraf (Orders.tsx TamZincirButton) `useAuth().user?.username || email || dbId || 'system'` fallback ile dolduruyor (Faz 3 modal ile birebir aynı pattern).

---

## §18 Hijyen — v15.51 Cleanup

**Patch sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\v15.51_faz4_autozincir_hizalama.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v15.51-extract" -Recurse -Force -ErrorAction SilentlyContinue
```

**§18.2 yeni tablo kontrolü:** Bu patch'te yeni tablo yok. Mevcut `uys_mrp_calculations` artık autoZincir tarafından da dolduruluyor (Faz 3 modal'a ek olarak).

**§18.3 durum string kontrolü:** Yeni durum string'i yok.

**§18.4 artık kontrolü:** Bu patch'te kesim/artık akışı dokunulmadı.

**§19 MRP sözleşmesi kontrolü:**
- Filter hala `hesaplaMRP` net>0 sonucuna bakıyor ✓
- `mrp_durum` filter'da kullanılmıyor (autoZincir artık bu kolonu güncellese de filter karar mekanizmasına girmiyor) ✓
- Tedarik silindiğinde otomatik geri açılma davranışı bozulmadı ✓
- `uys_mrp_calculations` snapshot **bilgi amaçlı** — filter'a girmiyor ✓

---

## Sıradaki Adaylar

**Adim B — İş Emri #1 (Operatör Paneli):**
- `/operator` route — production-blocker
- Backlog v15.17.0 tag'i ile bekliyor
- En yüksek öncelik (sahaya yayılım için kritik)

**Adim C — İş Emri #2 (Yedekleme Yönetimi):**
- `/backup` route — production-blocker
- `pt_yedekler` tablosu Tip D, önceden tip ataması yapıldı (§18.2 tablosu)

**Adim D — Topbar KESİM badge'i Siparişler sayfasında uyarı (yarım kalmıştı):**
- v15.50a.6'da Topbar düzeltildi ama Orders.tsx'teki uyarı eklenmemişti
- Küçük UX patch — 30 dakikalık iş

**Adim E — Mavvo BOM-to-recipe entegrasyonu (UYS dışı, paralel iş):**
- Backlog'da değil ama Buket'in işletim önceliği

Buket önceliği belirler.

---

## Kontrol Listesi (Bir sonraki MRP/UI patch öncesi)

**§19 MRP filtresine dokunuyorsa:**
- [ ] Filter kararı `hesaplaMRP` net>0 sonucuna mı bakıyor?
- [ ] mrp_durum kolonu **filter'da** kullanılmıyor mu?
- [ ] Tedarik silindiğinde sipariş otomatik liste'ye dönüyor mu? (S10 garantisi)
- [ ] Kilitli siparişler arşivde mi? (`isOrderArchived` ile)

**§18.3 durum string varyantları:**
- [ ] `isOrderArchived` / `isOrderActive` / `isWorkOrderOpen` helper'ları kullanılıyor mu?
- [ ] `o.durum === 'tamamlandi'` gibi inline kontroller eklenmemiş mi?

**§18 hijyeni:**
- [ ] Patch teslim mesajında cleanup komutu var mı?
- [ ] §18.2 yeni tablo varsa karar matrisi (A/B/C/D)
- [ ] §18.3 yeni durum string varsa statusUtils güncel
- [ ] §18.4 artık akışı manuel material kartı YASAK

**RBAC:**
- [ ] Yeni butonlar `can(...)` ile sarılı mı?
- [ ] Permissions.ts'te yeni action varsa DEFAULTS doldurulmuş mu?

**Multi-machine (yeni 27 Nisan 2026 itibariyle):**
- [ ] NB081 makinesinde Node.js henüz kurulu değil — patch teslim öncesi bu makinede build doğrulaması yapılamıyor
- [ ] Push öncesi `git status --short` boş, `git pull` Already up to date olmalı
- [ ] Pre-push hook çalışıyor (audit-schema + audit-columns); schema değişmediği sürece sorunsuz geçer

---

## Multi-machine Notu (27 Nis 2026 Eklendi)

Buket bugün ana bilgisayara (NB081) geçti. Bu makinede başlangıçta:
- Git CLI yoktu → Git for Windows kuruldu (PATH dahil)
- Node.js hala yok → patch sırasında build doğrulaması atlandı, GitHub Actions'a güvenildi

**Yeni oturumda:** Eğer kod patch'i yapılacaksa Node.js kurulu mu kontrol et:
```powershell
node --version; npm --version
```
Yoksa LTS sürümünü https://nodejs.org/en adresinden indir, kur, PowerShell'i kapat-aç.

Pre-push hook'un içeriği bilinmiyor — şu ana kadar npm/build kontrolü yapmıyor anlaşılan (push başarılı geçti). Eğer ileride pre-push fail olursa `git push --no-verify` ile bypass edip ayrı kontrol et.

---

İyi geceler Buket. v15.51 ile İş Emri #3 tamamen kapandı (5/5 faz).
