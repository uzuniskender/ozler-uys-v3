# ÖZLER UYS v3 — BİLGİ BANKASI v14
**Son güncelleme:** 17 Nisan 2026 (akşam)

---

## 1. Temel Bilgiler

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase** | `kudpuqqxxkhuxhhxqbjw` (Frankfurt) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Test sayfası** | `#/test` — 12 adımlı otomatik smoke test |

---

## 2. Bugün Çözülen Bug'lar (17 Nisan — v14 serisi)

| # | Bug | Root cause | Fix |
|---|---|---|---|
| 1 | Fire-only giriş reddediliyordu | `q<=0 && !durus` kontrolü fire'ı yoksayıyor | 4 yerde `q<=0 && f<=0 && !durus` |
| 2 | Üretim girişi stok hareketi yazmıyor, sevkiyat -1 stok | Kodda `kaynak: 'uretim'` gönderiliyordu ama DB'de `kaynak` kolonu yok → Supabase sessiz reddediyor | 6 insert'ten `kaynak` alanı çıkarıldı |
| 3 | Fire girişinde auto-close çalışmıyor, "Başlamadı"da kalıyor | `update({durum, tamamlanma_tarih})` — `tamamlanma_tarih` DB'de yok, sessiz reddediyor | 3 yerden `tamamlanma_tarih` çıkarıldı |
| 4 | Log saat görünmüyor | Store log mapper'da `saat` alanı okunmuyor | `ProductionLog.saat` + mapper eklendi |
| 5 | Reports detay satır tıklama İE'ye gitmiyor | Route path `/work-orders` tirelidir, kodda `/workorders` yazılmıştı | Path düzeltildi |
| 6 | Negatif değer girilebiliyor | Input'larda min=0 yok, save'de negatif kontrol yok | min=0 + save validasyonu |
| 7 | Sipariş modalında ürün arama yok | Klasik select dropdown | SearchSelect ile kod/ad araması + seçim özeti |
| 8 | "Yeni BileşenÇELİK" prefix bug | Reçete/BOM default malad='Yeni Bileşen', kod yanına concat olmuş | Default boş |
| 9 | **İE listesinde durum hep "Başlamadı"** | UI `pct`'ye bakıp kendi durum türetiyor, DB'deki `durum` alanını ignore ediyor + `pct` fire'ı saymıyor (sadece qty) | `wKapasite` fire dahil yeni helper, 3 yerde DB durumu önceliklendirildi |

---

## 3. Anthracite Lessons (İleride Tekrar Etmemek İçin)

**Supabase insert/update'te var olmayan kolon gönderilince sessizce yok sayılır** — hata dönmez, exception yoktur. Bu yüzden 2 büyük bug (kaynak, tamamlanma_tarih) saatlerce sürdü. Kural: Yeni bir kolon adı kullanırken **önce `information_schema.columns` ile DB'de var mı doğrula**.

**UI'da hesaplanan durum + DB'de yazılan durum çakışırsa UI hep haklı sanılır** — DB'de ne yazdığı kimsenin umurunda değil. Senin bug #9 tam böyleydi: DB tamamlandi yazsa da UI pct=0 diye "Başlamadı" gösteriyordu. Kural: Durum gibi **kritik statüleri tek noktada yönet** — ya hep DB alanı, ya hep türetilmiş, karma değil.

**Test DB'ye doğrudan yazıyorsa gerçek kodu test etmemiş olur** — `/test` sayfası 12/12 yeşil geçti ama canlı UI'da bug sürdü, çünkü React kod yolunu değil Supabase tablosunu test ediyordu. Gerçek smoke test için Playwright gibi bir araç gerekir.

---

## 4. Deploy Durumu

Son bundle: **v14.9** (`index-DmLqhHOI.js` lokal — GitHub Actions farklı hash üretiyor). 
SQL tarafında hiç beklenen fix yok — tüm fix'ler koddaydı.

`/test` sayfası canlıda aktif (`https://uzuniskender.github.io/ozler-uys-v3/#/test`) — kritik akışı tek tıkla doğrular.

---

## 5. Bekleyen İşler

1. **Sipariş sevk durumu güncelleme** — sevkiyat yapıldıktan sonra order.durum = "sevk edildi" / "tamamlandı" yazmıyor, bakılacak
2. **Stok hareketleri ekranı** — YMH100115 için -1 olmuş, tarihsel temizlik gerekiyor olabilir
3. **Supabase RLS** — `allow_all` → `authenticated-only` (güvenlik)
4. **B8 MRP stoktan ver** — önce stoktan, eksiği tedarik
5. **B9 Test DB ayrı Supabase**
6. **Malzeme tablosu iyileştirmeleri** — ölçü sütunları birleştir, sticky header, sayfalama, zebra
7. **Logları tıklayınca saat gösterimi çalışıyor** ama eski kayıtlarda saat boş
8. **Playwright ile gerçek E2E testi** — UI'dan başlayan test (bugün anladığımız gibi DB-only test yetmiyor)

---

## 6. RBAC + Önceki İşler Devam Ediyor

- `uys_kullanicilar` + `uys_yetki_ayarlari` (aktif)
- 4 rol × 80+ aksiyon
- KullaniciPanel + YetkiPanel → DataManagement

---

## 7. Diğer Projeler (Devam Ediyor)

- CBAM Q1-Q4 2025 raporlandı, O3CI portal bekliyor
- GFB/çevre izni Dilovası — Kapasite raporu var, PTD hazır
- İSG machine instructions TL-ISG-001→016, sıradaki TL-ISG-017
- Libya order documentation — ürün detayı bekleniyor
- Compaco Romania 8D — RAPIDO-UNI Panel 150x270 keyhole
- Sertifikalar: TS EN 12810-1, TS EN 74-3, EN 1090-2, ISO 45001, ISO 14001

---

## 8. Yeni Chat İçin Hızlı Giriş

1. Bu dosyayı (`OZLER_UYS_BILGI_BANKASI_v14.md`) yükle
2. `ozler-uys-v3-full.zip`'i yükle (son kaynak kod)
3. İlk iş olarak sorulacaklar: deploy durumu, test sonuçları, kalan bekleyen işler

**Önemli uyarılar:**
- Supabase'de yeni bir kolon adı kullanmadan önce `information_schema.columns` ile doğrula
- Durum/statü gibi kritik alanlar için UI ya hep DB okur ya hep türetir — karışık olmasın
- `/test` sayfası var ama DB-only; UI akışı için Playwright eklenebilir
- Passwords sohbette yazılmaz, sadece kodda
