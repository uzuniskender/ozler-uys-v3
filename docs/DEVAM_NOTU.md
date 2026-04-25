# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.50a.6 sonrası — UX serisi kapanışı)
**Son canlı sürüm:** v15.50a.6

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §19 MRP Filtre Sözleşmesi + §18 ailesi 4 kalıcı kural) + docs/is_emri/00_BACKLOG_Master.md (üstteki ilerleme paneli) oku.
Son iş: v15.50a serisi (7 patch) ile MRP UX 3 kritik bug çözüldü, hesap layer'ı kanıtlandı.
Sıradaki: v15.50b (Faz 3 MRP Modal) — İş Emri #3'ün orijinal planı.
```

---

## Bugünün Final Raporu — 7 Sürüm (v15.50a serisi)

| Sürüm | Konu | Doğrulama |
|---|---|---|
| v15.50a   | hesaplaMRP termin gruplama + stok pool FIFO            | 4/4 birim test PASS |
| v15.50a.1 | MRP.tsx onClick event leak (Hesapla bypass) hotfix     | Manuel canlı |
| v15.50a.2 | MRP filtre v1 (mrp_durum yoksay) — REVİZE              | 11/11 → revize |
| v15.50a.3 | MRP tablo viewFilter default 'tum' (boş tablo fix)     | Manuel canlı |
| v15.50a.4 | MRP filtre 5 aşama (yanlış sözleşme) — REVİZE          | 10/10 → revize |
| v15.50a.5 | MRP filtre TEK KURAL (net>0) — DOĞRU SÖZLEŞME          | Canlı + 11/11 |
| v15.50a.6 | Topbar KESİM badge keyword fix (KESME LAZER yakalama)  | Canlı |

**Sayılar:** 7 patch · 0 rollback · 0 schema değişikliği · ~30 birim test PASS · 1 yeni kalıcı kural (§19).

---

## §19 MRP Filtre Sözleşmesi (TEK KURAL)

> **Sipariş MRP listesinde görünür ⇔ kilit açık VE hesaplaMRP'de net > 0 satırı var.**

`mrp_durum` kolonu, açık tedarik listesi, üretim yüzdesi → **filter'da kullanılmaz**. Detay: Bilgi Bankası §19.

**Tedarik silinirse otomatik geri açılır** — sözleşmenin kritik özelliği. Test fixture S10 ile garanti.

---

## Sıradaki — v15.50b (Faz 3 MRP Modal)

İş Emri #3 Faz 3 — orijinal plan halen geçerli:

- `pages/Orders.tsx` OrderDetailModal'a "MRP Hesapla" butonu (UI giriş noktası)
- `MRPModal.tsx` yeni component (snapshot + termin sütunu + tedarik aç akışı)
- `mrp.ts` refactor — termin gruplu çıktı ✅ YAPILDI v15.50a (Faz B P2 entegre)
- `uys_mrp_calculations` tablosuna snapshot insert (v15.47'de hazırlandı, henüz dolmuyordu)
- "Tedarik Aç" toplu seçim (RBAC: `tedarik_auto`)

**Tahmini:** 1.5-2 saat. v15.50b/c parçalarına bölünebilir.

**Faz B Parça 2 durumu:** Termin gruplama yapıldı (v15.50a). Geriye sadece UI tarafı kaldı (Modal içinde termin sütunu).

---

## Acil UX Backlog Durumu

| # | Sorun | Durum |
|---|---|---|
| 1 | "Tamamlananlar" gizleme yanlıştı (mrp_durum filtresi) | ✅ v15.50a.5 ile çözüldü (TEK KURAL) |
| 2 | "Sipariş seçili" rozeti vs Hesapla bypass | ✅ v15.50a.1 ile çözüldü |
| 3 | Kesim planı yokluğu sipariş sayfasında görünmüyor    | 🟡 Kısmen — Topbar KESİM düzeltildi (v15.50a.6), Siparişler sayfasındaki uyarı eksik kaldı, kullanıcıyla konuşma yarıda kaldı |

---

## Kontrol Listesi (yeni MRP/UI patch öncesi)

**§19 MRP filtresine dokunuyorsa:**
- [ ] Filter kararı `hesaplaMRP` net>0 sonucuna mı bakıyor?
- [ ] mrp_durum kolonu **filter'da** kullanılmıyor mu?
- [ ] Tedarik silindiğinde sipariş otomatik liste'ye dönüyor mu? (S10 garantisi)
- [ ] Kilitli siparişler arşivde mi?

**§18.3 durum string varyantları:**
- [ ] Kilit kontrolünde `'kapalı'`, `'kapali'`, `'iptal'`, `'İptal'`, `'tamamlandi'`, `'Tamamlandı'` hepsi sayılıyor mu?

**§18 hijyeni:**
- [ ] Patch teslim mesajında cleanup komutu var mı?
- [ ] §18.2 yeni tablo varsa karar matrisi
- [ ] §18.3 yeni durum string varsa statusUtils güncel
- [ ] §18.4 artık akışı manuel material kartı YASAK

---

## Komutlar

**Push sonrası temizlik:**
```powershell
Remove-Item "$env:USERPROFILE\Downloads\patch-v15-50a-*.zip","$env:USERPROFILE\Downloads\patch-v15-50a-*" -Recurse -Force -ErrorAction SilentlyContinue
```

---

## Önemli Ders (kalıcı not)

Bugün **sözleşmeyi yanlış sentezledim** ve 3 patch boşa attım (v15.50a.2 → v15.50a.4 → v15.50a.5). Ders:

> Müşteri net kural verdiğinde **birebir** uygulamak gerekir. "Sade tek kural" çıkarmaya çalışmak yanlış yola sürükler.

Doğru süreç:
1. Müşteriden kuralı **tablo halinde** al
2. Test fixture'ı tablodaki **her satır için** yaz
3. Patch yazmadan önce tabloyu **birebir** koda çevir
4. Patch teslim mesajında "uygulanan kural" tablosu göster (kullanıcı 30 saniyede kontrol edebilsin)
5. Onaylatmak için sürekli soru sormaktan vazgeç — **yapılması gereken bir şey varsa yap, durup sorma**

Bilgi Bankası §19'da bu ders kalıcı olarak not alındı.

---

İyi geceler Buket. v15.50a serisi 7 patch, 0 rollback. UX katmanı temizlendi, sıradaki Faz 3 (MRP Modal) için zemin hazır.
