# İŞ EMRİ #13 — UYS v3 Ana Akış Refactoru (Sipariş↔İE↔Kesim↔MRP↔Tedarik Zinciri)

**Tarih:** 27 Nisan 2026
**Kaynak:** Buket'in detaylı kullanım spec'i (22 madde)
**Önceki sorun:** "Bir aydır MRP'yi çözemedik" — parça parça yamalarla ilerlendiği için bütüncül akış oturmadı. Bu spec ana akışı baştan tasarlar.

## Temel İlke

> **Kullanıcı sadece butona tıklar. Sistem kullanıcıyı yönetir, kullanıcı sistemi değil.**

Mevcut sistemde kullanıcı zinciri atlatabiliyor (manuel İE açıp kesim planı yapmadan üretime geçebiliyor; aynı sipariş için 35 saniye içinde 2 ayrı tedarik açabiliyor; vb.). Bu refactor zincirin halkalarını **mecbur** kılar.

---

## 22 Maddenin Grup Halinde Organizasyonu

### Grup A — Sipariş/İE Birleştirme (Maddeler 1-5, 18)

**Hedef:** Ayrı "Yeni İE" butonu kalkar, tek "Yeni İş Emri" butonu (Siparişler sayfasında) zinciri başlatır.

| # | Madde |
|---|---|
| 1 | "Yeni İş Emri" sayfasındaki ayrı buton kaldırılacak. İE açma "Sipariş Ekle" üzerinden olacak. |
| 2 | Buton adı "Yeni İş Emri" olabilir (Sipariş Ekle yerine). |
| 3 | Modal 6 sütunlu tek tablo: Sipariş No / Müşteri / Ürün Reçetesi / Adet / Termin / Not. Sipariş No alt satırlarda çoklu olabilir. "Sipariş bağlı değil — tekil İE" tiki + otomatik İE numarası. "Müşteri yok" tiki = Stok için iş emri. |
| 4 | Birden fazla ürün tanımlanabilir (çoklu satır). |
| 5 | Modal geniş, sekme yok (tek tabloda hepsi görünür). |
| 18 | MRP sayfasında "Bağımsız İE / Sipariş" iki ayrı kavram olmaktan çıkar. Yapı birleşti. |

### Grup B — Zincir Akış (Maddeler 6-9, 17)

**Hedef:** Sipariş/İE girildiyse, kesim → MRP → tedarik zinciri **atlatılamaz**.

| # | Madde |
|---|---|
| 6 | Sipariş/İE girildi → kesim işi varsa **kesim planı modalı otomatik açılır**, plan oluşturulur. |
| 7 | MRP çalışır (ihtiyaç vs stok+yolda). Eksikse **tedarik sayfası açılır**. |
| 8 | Tedarik gerçekleştirilir. |
| 9 | İE "Plan Bekliyor" durumundan "Üretilebilir" durumuna geçer. |
| 17 | **İşlemler arasında boşluk yok.** Kullanıcı bir işi tamamlamadan diğerine geçemez. Geçemese sebebi modal'da yazılır. Yarım kalan iş "Taslak" olarak kaydedilir, dashboard + ekranda dikkat çekici şekilde hatırlatılır. Yeni iş emri açmak için taslak: ya beklet, ya iptal, ya tamamla. |

### Grup C — Sipariş Revizyonu (Maddeler 10-12)

**Hedef:** Sipariş miktarı değişince zincir otomatik güncellenir.

| # | Madde |
|---|---|
| 10 | Sipariş silinir/eksilir → kesim planı revize edilir. MRP fazla olur. Tedarik gelmemişse miktar düşürülür; gelmişse malzeme stoğa girer. |
| 11 | Sipariş miktarı artar → İE'ler "Plan Bekliyor" durumuna döner, kesim planı yapılır, MRP ihtiyacı artar, yeni tedarik belirlenir. |
| 12 | Yeni tedarik için belirlenen miktarlar temin edilir. |

### Grup D — Üretim Sonrası (Maddeler 13-14)

**Hedef:** Fire ve log izlenebilirliği.

| # | Madde |
|---|---|
| 13 | Fire çıktıysa fire İE açılır → yeni sipariş/İE adımları gerçekleşir. |
| 14 | Üretim sonrası hammadde/yarımamul stokları düşer, kayıtlar loglanır. **Tüm loglar kolay bulunabilir.** Stoğa giren ürün hangi İE'den geldiği net görünür. |

### Grup E — Stok Bütünlüğü (Maddeler 15-16)

**Hedef:** Yetkisiz/rastgele stok manipülasyonu engellenir.

| # | Madde |
|---|---|
| 15 | Çalışmış sistemden kullanıcı rastgele veri silemez. Depo hareketi mevcut iş emirlerini etkiliyorsa (ihtiyaç çıkıyorsa) kullanıcı uyarılır + tedarik sayfası otomatik açılır. Stok yeterliyse tedarik gerekmez. |
| 16 | Kesim planında: kesim ölçüsünden küçük, aynı hammaddeyi kullanan **artık ürünler** kullanıcıya sorulur. |

### Grup F — MRP Semantiği (Maddeler 19-22)

**Hedef:** MRP "tamam" / "eksik" kararı net ve tutarlı; çift tedarik açma engellenir.

| # | Madde |
|---|---|
| 19 | İE girildi + stok yeterli → MRP iş emrini "Tamamlananlar" sayfasına taşır (orada ayrı hesaplama yapar ama göreceği miktar yeterli olur). |
| 20 | İE girildi + stok yetersiz → MRP hesaplama yapar, tedarik oluşturur, tedarik adımına geçilir. |
| 21 | **MRP "tamamlandı" ne demek:** İhtiyaç < Stok + Yolda → Tamamlandı. İhtiyaç > Stok + Yolda → Tedarik oluşturur. |
| 22 | İçerideki sipariş + sonra gelen sipariş aynı malzemeyi kullanıyorsa **FIFO**: önceki sipariş stoğu önce kullanır, sonra gelen siparişin malzemesi eksik görünür. Önceki sipariş eksik DEĞİLDİR. |

---

## Bu Akşam Tespit Edilen Spesifik Bug'lar (Spec → Çözüm Eşleşmesi)

### Bug 1: Çift Tedarik Açma → Madde 21

**Olay (27 Nis):**
- 09:39'da S26A_02981_2 için 114 bar tedarik açıldı (autoZincir, `auto_olusturuldu=true`)
- 10:13'de aynı sipariş için 207 bar tedarik **daha** açıldı (`auto_olusturuldu=false`)
- 35 saniye arayla, aynı malkod (H0102C030093044), aynı termin

**Sebep:** `mrpTedarikOlustur` mevcut açık tedariği kontrol etmiyor. İkinci tıklama = ikinci tedarik kaydı.

**Çözüm:** `mrpTedarikOlustur`'a idempotent kontrol — aynı orderId + malkod + termin için zaten bekleyen tedarik varsa miktar farkını aç (delta) veya hiç açma.

### Bug 2: Manuel İE Bar Modeli Atlatma → Madde 6, 17

**Olay:** IE-MANUAL-MOCWJRK6 ve MOCWQYNL üretim girilmiş ama bar_acilis kaydı yok. Sebep: kullanıcı kesim planı oluşturmadan üretime geçti.

**Çözüm (v15.55'te yapıldı):** ProductionEntry'de hard block — kesim opsiyonlu WO + plan yok → engelle.

**Spec'e göre genişletme:** Kesim adımı atlanırsa "Taslak" durumu otomatik (madde 17), kullanıcı ya planı tamamlar ya iptal eder ya bekletir.

---

## Faz Sıralaması

| Faz | Grup | Tahmini Süre |
|---|---|---|
| **F0** | F-21 idempotent tedarik düzeltmesi (bu gece — 27 Nis 16:45'e kadar) | 45 dk |
| **F1** | F (19-22) MRP semantik tam tutarlılık | 1 gün |
| **F2** | A (1-5, 18) Sipariş/İE modal birleştirme | 2-3 gün |
| **F3** | B (6-9, 17) Zincir akış + taslak sistemi | 3-4 gün |
| **F4** | C (10-12) Sipariş revizyon mantığı | 2 gün |
| **F5** | D (13-14) Üretim sonrası fire akışı + log izlenebilirlik | 1-2 gün |
| **F6** | E (15-16) Stok bütünlüğü kilidi + kesim artığı sorma | 1-2 gün |
| **Toplam** | | **~10-14 gün** |

---

## Mimari Prensipler

1. **Atomic transactions:** Her zincir adımı ya tam başarılı, ya geri alınır. Yarım kayıt yasak.
2. **Idempotent operations:** Buton iki kez tıklanırsa ikinci tıklama hiçbir şey yapmaz veya sadece eksiği tamamlar.
3. **Pessimistic state:** "Açık tedarik" var sayılır — yeni tedarik açmadan önce kontrol edilir.
4. **Atlatılamazlık:** UI guard'lar + DB constraint'ler. UI atlatılırsa DB durdurur.
5. **İzlenebilirlik:** Her insert/update için `log_id`, `mrp_calculation_id`, `wo_id` gibi referanslar zorunlu.

---

## Kabul Kriterleri (Genel)

Refactor tamamlandığında:
- ✅ Aynı sipariş için 35 saniye içinde 2 ayrı tedarik açılamaz
- ✅ Manuel İE açan kullanıcı kesim adımını atlatamaz
- ✅ Sipariş silinince ilgili tedarik otomatik düzeltilir
- ✅ MRP "tamam" kararı her zaman aynı mantıkla verilir
- ✅ Stok yetersiz/yeterli değişimi otomatik tedarik akışı tetikler
- ✅ Sağlık Raporu Kontrol #11 (bar model tutarlılığı) sürekli pass

---

*Bu spec 27 Nis 2026 14:08'de hazırlandı. Kullanıcı (Buket) detaylı kullanım akışı verdi; bu doküman onun mühendislik spec'ine çevrilmiş halidir.*
