# Yeni Oturum Devam Notu

**Tarih:** 26 Nisan 2026 (v15.50b sonrası — Faz 3 MRP Modal entegrasyonu)
**Son canlı sürüm:** v15.50b

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §19 MRP Filtre Sözleşmesi + §18 ailesi 4 kalıcı kural) + docs/is_emri/00_BACKLOG_Master.md (üstteki ilerleme paneli) oku.
Son iş: v15.50b (Faz 3 MRP Modal entegrasyonu) — uys_mrp_calculations snapshot insert + RBAC kontrolleri + isOrderArchived helper.
Sıradaki: İş Emri #3 Faz 4 (autoZincir UI) veya İş Emri #1 (Operatör Paneli) veya İş Emri #2 (Yedekleme).
```

---

## v15.50b Özeti — Faz 3 MRP Modal Entegrasyonu

**Sürpriz keşif:** Faz 3'ün tahmin edilen scope'unun büyük kısmı zaten yapılmıştı. `pages/Orders.tsx` içindeki `OrderDetailModal` zaten:
- MRP tab + "MRP Hesapla" butonu (`can('orders_mrp')` ile)
- `runMRP()` — hesaplaMRP + mrp_durum update + rezerveYaz
- Termin sütunu sonuç tablosunda
- Per-row + Tedarik + Toplu Tedarik butonları
- Excel export
- TamZincirButton (autoZincir entrypoint)

DEVAM_NOTU'nun "MRPModal.tsx yeni component" planı yanıltıcıydı — yeni component yaratmak overkill, mevcut Modal'ın **eksik 4 noktasını** kapatmak doğru iş çıktı.

### v15.50b'de Kapatılan 4 Eksik

| # | İş | Dosya |
|---|---|---|
| 1 | `uys_mrp_calculations` snapshot insert (Tip C, §18.2 uyumlu) — runMRP sonu, JSONB `{malkod: miktar}` formatında 4 alan (brut/stok/acik/net) | Orders.tsx OrderDetailModal.runMRP |
| 2 | Tedarik insert'lerine `mrp_calculation_id` + `auto_olusturuldu` bağlantısı | Orders.tsx (per-row) + mrp.ts (mrpTedarikOlustur opts) |
| 3 | RBAC: Toplu Tedarik → `tedarik_auto`, Per-row + Tedarik → `mrp_supply` | Orders.tsx (2 yer) |
| 4 | `isOrderArchived` helper (§19 opsiyonel iyileştirmesi) — MRP.tsx inline set'i kaldırıldı | statusUtils.ts + MRP.tsx |

### Sayılar

5 dosya · 0 schema değişikliği · 0 rollback · §19 sözleşmesi korundu · §18.3 statusUtils tutarlılığı arttı.

---

## §18 Hijyen — v15.50b Cleanup

**Patch sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-50b*.zip","$env:USERPROFILE\Downloads\patch-v15-50b*" -Recurse -Force -ErrorAction SilentlyContinue
```

**§18.2 yeni tablo kontrolü:** Bu patch'te yeni tablo yok (mevcut `uys_mrp_calculations` doldurulmaya başlandı). Tablo zaten Tip C — STORE_WHITELIST ve DATA_MGMT_WHITELIST'te (audit-schema.cjs).

**§18.3 durum string kontrolü:** Bu patch'te yeni durum string'i yok. `isOrderArchived` mevcut `ORDER_INACTIVE_STATES` listesini reverse logic ile kullanıyor.

**§18.4 artık kontrolü:** Bu patch'te kesim akışı dokunulmadı.

**§19 MRP sözleşmesi kontrolü:**
- Filter hala `hesaplaMRP` net>0 sonucuna bakıyor ✓
- `mrp_durum` filter'da kullanılmıyor (sadece bilgi rozeti) ✓
- Tedarik silindiğinde otomatik geri açılma davranışı bozulmadı ✓
- `uys_mrp_calculations` snapshot **bilgi amaçlı** — filter'a girmiyor ✓

---

## Sıradaki Adaylar

**Adim A — İş Emri #3 Faz 4 (autoZincir UI):**
- `autoChain.ts` mevcut (autoChain.ts mevcut, UI yok — Backlog #6 "kısmi yapıldı")
- TamZincirButton zaten Orders.tsx'te entrypoint var
- Eksik: dashboard / log paneli (autoZincir tetiklenince ne yaptığını gösteren step-by-step UI)

**Adim B — İş Emri #1 (Operatör Paneli):**
- `/operator` route — production-blocker
- Backlog v15.17.0 tag'i ile bekliyor

**Adim C — İş Emri #2 (Yedekleme Yönetimi):**
- `/backup` route — production-blocker
- `pt_yedekler` tablosu Tip D, önceden tip ataması yapıldı (§18.2 tablosu)

**Adim D — Topbar KESİM badge'i Siparişler sayfasında uyarı (yarım kalmıştı):**
- v15.50a.6'da Topbar düzeltildi ama Orders.tsx'teki uyarı eklenmemişti
- Küçük UX patch — 30 dakikalık iş

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

---

İyi geceler Buket. v15.50b ile İş Emri #3 Faz 3 kapsamı kapandı.
