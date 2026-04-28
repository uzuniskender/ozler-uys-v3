# Saha Model — UYS v3 (28 Nisan 2026, öğleden sonra)

**Hazırlayan:** Buket × Claude (sohbet sonu kayıt)
**Amaç:** Buket'in kafasındaki saha modelini yazılı hale getirmek. Kod doğrulama + Madde 15 onay sistemi tasarımı için referans.

13 senaryo, soru-cevap formatında konuşuldu. Her senaryo:
1. Olay (saha tetiği)
2. Beklenti (sistem ne yapsın)
3. Otomatik akış / manuel müdahale ayrımı
4. Kod durum kontrolü (ne mevcut, ne yok)

---

## SENARYO 1 — SİPARİŞ GELDİ

**Tetik:** Müşteri sipariş verdi. UYS'de "Sipariş/İş Emri Ekle" butonu (manuel veya Excel toplu).

**Otomatik zincir:**
1. İş emri oluşur (taslak: hedef = sipariş adeti)
2. Kesim planı hesaplanır
3. Kesim planı çıkışı sipariş adetinden FARKLIYSA → modal:
   ```
   "Önerilen: 55 üret (50 müşteriye + 5 stoğa)"
   [✓ Kabul Et]  [Düzenle]
   ```
   - Default: kabul et (otomatik 55)
   - Düzenle → Kullanıcı serbest girer
     - Çıkıştan az (50) → fark otomatik fire (5 fire)
     - Çıkış kadar (55) → fark stoğa (50 müşteri + 5 stok)
4. MRP çalışır (gerçek hedefe göre)
5. Tedarik oluşur (gerçek hedefe göre)

**Kullanıcı kontrol:** Kesim planı düzenlenebilir. Düzenleme → MRP otomatik tekrar → Tedarik otomatik düzeltilir.

**Tedarik düzeltmesi:**
- Bekleyen tedarik + ihtiyaç düştü → sistem dokunmaz, kullanıcı tedarikçiyle konuşur
- Gelmiş tedarik + ihtiyaç düştü → fazla mal stoğa girer, sistem dokunmaz

**Üretim:** Hammadde geldikten sonra İE "Üretilebilir" durumuna geçer. Operatör üretir. Bar artıkları otomatik fire (kesim planı bilgisinden).

**Sevkiyat:** Mamul stoğa girer girmez sevkiyat kartı oluşur (idempotent). Termin + müşteri + önerilen miktar (sipariş kalanı). Kullanıcı "+ Yeni Sevkiyat" — tarih + miktar girer. Kısmi sevk olabilir, kart sipariş kalanı sıfırlanana kadar açık. Sevk geçmişi satır satır görünür.

**Sipariş kapanışı:** Tüm kalemler 0/0 sevk → tamamlandı. Stok için üretilen fazla mamul (5 adet) mamul stoklarında kalır. Sevkiyat ekranında stok mamulleri görünmez.

---

## SENARYO 2 — MANUEL İE AÇILDI (Siparişsiz, Stok İçin)

**Tetik:** "Sipariş/İş Emri Ekle" → "Müşteri yok" tiki. orderId=null, bagimsiz=true, siparis_disi=true.

**Otomatik zincir:** Senaryo 1 ile AYNI (kesim plan + MRP + tedarik). TEK FARK: Bar çıkışı hedef'ten farklıysa MODAL AÇILMAZ — hedef otomatik bar çıkışına eşitlenir (zaten stok için, hepsi stoğa).

**Üretim sonu:** Mamul stoğa girer. Sevkiyat ekranı YOK (müşteri yok). İleride sipariş gelirse stoktan kullanılır.

**Manuel İE kapanışı:** Üretim hedef'e ulaştığında durum=tamamlandı.

**ÖNEMLİ:** Manuel İE açılırken **termin alanı zorunlu** (Senaryo 12 FIFO için).

---

## SENARYO 3 — TEDARİK GELDİ

**Tetik:** Tedarikler sayfası → "Geldi" butonu. Tarih + miktar girilir.

**Kısmi geliş (geldi < sipariş):**
- [✓ Devam ediyor] → tedarik AÇIK kalır, kalan beklenir
- [✓ Kapat (geldi miktarda dondur)] → tedarik kapanır, kalan İPTAL
  - MRP otomatik tetiklenir → eksik varsa yeni tedarik açılır

**Fazla geliş (geldi > sipariş):**
- [✓ Hepsini kabul] → fazla stoğa girer
- [✓ Sadece sipariş kabul, fazla iade] → iade kaydı (ayrı süreç)

**Otomatik zincir:** Stok hareketi → MRP yeniden çalışır → Etkilenen İE'lerin efektif durumu güncellenir (Plan Bekliyor → Üretilebilir, v15.79) → Topbar [PLAN BEKLEYEN N] güncellenir → Operatör paneli yeşil kart → Tüm sayfalar realtime sync.

**Stok hala yetmezse:** MRP otomatik yeni tedarik açar.

**Mamul stoğunda zaten var (yeni sipariş geldiğinde):**
- Modal: "Mamul stoğunda X serbest, Y rezerv var"
- Kullanıcı serbest stok ve/veya rezerv stoktan kullanım miktarı girer
- Rezerv stoğa dokunulursa → ALINANIN YERİNE EK İE açılır
  - örn. Y siparişi 50, X'in rezervinden 20 alındı → IE-X-002 hedef=20 açılır
- Her sipariş kendi İE'sini izler (order_id ile bağlı)

**STOK MODELİ (Senaryo 3'te netleşti):**
```
Mamul stok = Serbest stok + Rezerv stok (sipariş bazlı, order_id ile)

Serbest stok:
  • Senaryo 1 fazla üretim (50 müşteri + 5 stok → 5 serbest)
  • Senaryo 2 manuel İE üretimi (zaten siparişsiz)
  • Sipariş iptal sonrası rezerv'in serbest'e dönüşü

Rezerv stok:
  • İE üretim bitiminde otomatik order_id'ye rezerve edilir
  • Sevkiyat anında düşer (asla serbest'e dönmez)
  • Sipariş iptal/azalma → fark serbest stoğa döner

Manuel müdahale:
  • Kullanıcı rezerv stoğa dokunabilir (X'ten al, Y'ye ver)
  • Sistem engellemez, sadece sonuçları yönetir (yeni İE açar)
```

---

## SENARYO 4 — SİPARİŞ ARTTI

**Tetik:** Sipariş düzenle, adet artır. siparisDelta ARTIS hesaplar.

**TEK KURAL (durum dağılımı yok):**
- IE.hedef = IE.hedef + artış (her İE için)
- İE durumu otomatik:
  - hedef ≤ üretildi → tamamlandı
  - hedef > üretildi → üretimde
- Tamamlanmış İE bile artırılabilir (durum geri "üretimde"ye düşer)

**Mamul stok kontrolü:**
- Mamul stoğunda SERBEST varsa → MODAL aç (Senaryo 3 ile aynı)
- "Sipariş X arttı. Mamul stoğunda Y serbest var. ○ Stoktan ver ○ Üret ○ Karma"

**Otomatik zincir:** Senaryo 1 ile aynı.

**KESİM PLANI KURALI (Senaryo 4'te netleşti — TÜM senaryolar için):**
```
• Plan = (hedef - üretilen) KALAN için açılır
• Plan idempotent: aynı koşulda aynı sonuç
• Üretim ilerledikçe yeni plan çalıştırılırsa daha az miktar gösterir
• Hedef değişiminde otomatik yenilenir
• Kullanıcı her zaman manuel "Kesim Planı Yenile" tıklayabilir
```

---

## SENARYO 5 — SİPARİŞ AZALDI

**Tetik:** Sipariş düzenle (adet azalt veya termin değiştir). siparisDelta AZALIS / TERMIN / KALEM_SIL.

**TEK KURAL (adet azalması):**
- IE.hedef = max(yeni sipariş adet, üretildi)
  - örn: sipariş 50→30, üretim 35 → IE.hedef = 35 (geri sıfırlanmaz)
- Sipariş kalemi = yeni adet (örn 30)
- Fazla üretim (örn 5) → SERBEST STOĞA (Senaryo 1 ile aynı kural)

**İE durumu:**
- üretildi >= hedef → tamamlandı
- üretildi < hedef → üretimde
- hedef = 0 + üretildi = 0 → iptal

**Mamul stok rezerv:**
- Sipariş azaldıysa → fazla rezerv OTOMATİK serbest stoğa geçer
- örn: Y rezerv 50, sipariş Y 50→30 → rezerv 30, serbest +20

**Termin değişimi:**
- Adet aynı, sadece termin değişti
- TAM ZINCIR tetiklenir (kesim planı + MRP + tedarik)

**Kalem sil veya 0:**
- Üretim 0 → İE iptal
- Üretim varsa → IE.hedef = üretildi, durum=tamamlandı, mamul SERBEST stoğa

**Sipariş kapanmışsa (sevk tamam):** düzenleme DISABLED. İade için ayrı süreç (backlog).

**⚠️ DİKKAT:** v15.74'teki "AZALIS BLOCK" kuralı (üretildi > yeni adet → engel) saha modeline TERS. Saha kuralı: fazla üretim engel değil, serbest stoğa. Düzeltme gerek.

---

## SENARYO 6 — SİPARİŞ İPTAL

**Tetik:** "İptal Et" butonu (sipariş veya kalem bazlı).

**Detaylı onay modalı:** Etkilenecekler gösterilir (X İE iptal, Y kesim planı, Z tedarik açık vs).

**Üretim 0:** İE iptal, kesim planı silinir, tedarik kullanıcı manuel.

**Üretim var, sevk yok:** IE.hedef = üretildi'de dondurulur (tamamlandı), mamul rezerv → SERBEST stoğa, sipariş kapanır.

**Üretim var, kısmi sevk var:** Sevk edilen → İADE SÜRECİ (ayrı senaryo). Kalan rezerv → SERBEST.

**Üretim tam, sevk 0:** Üretim dokunulmaz, mamul rezerv → SERBEST stoğa.

**UI:** Sipariş arşive düşer (isOrderArchived — v15.79 mevcut). Geçmiş kayıtlar korunur.

**GENEL KURAL (Senaryo 5+6):** AZALMA / İPTAL → fazla üretim her zaman SERBEST stoğa.

---

## SENARYO 7 — TEDARİK YAKLAŞAN TERMİN / GECİKME / İPTAL

**3 alt-durum:**

**Durum 1 — Yaklaşan termin (proaktif uyarı):**
- Termin - bugün ≤ N gün (eşik ayarlanabilir, default 5 gün)
- 🔔 Bildirim merkezine SARI uyarı: "Tedarik X — termin Y gün içinde, kontrol edin"
- Tedarik satırı normal renkte (henüz problem yok)

**Durum 2 — Gecikme (termin geçti):**
- Tedarikler sayfasında satır KIRMIZI
- 🔔 Bildirim KIRMIZI
- İE efektif durum DEĞİŞMEZ ("Tedarik yolda" kalır)

**Durum 3 — İptal:**
- Tedarikler sayfası → "İptal Et" butonu
- Detaylı onay modalı
- Otomatik MRP → yeni tedarik OTOMATİK açılır (boş tedarikçi)
- Kullanıcı tedarikçi/tarih/teslim bilgilerini sonradan girer

---

## YENİ ÖZELLİK: 🔔 BİLDİRİM MERKEZİ (Senaryo 7'den çıktı)

**Topbar'a yeni badge:** 🔔 Bildirimler (sistem uyarıları). Mevcut chat/operatör mesajından AYRI.

**Uyarı tipleri:**

SARI (proaktif, bilgilendirme):
- Tedarik yaklaşan termin (≤ N gün)
- Sevkiyat yaklaşan termin
- Düşük mamul stoğu eşiği
- Manuel mamul giriş + açık sipariş eşleşmesi (Senaryo 11)
- Stok arttı + açık tedarik fazla görünüyor (Senaryo 11)
- Fire çıktı + telafi açıldı (Senaryo 9)
- Manuel rezerv'e dokunma sonrası (Senaryo 10)

KIRMIZI (reaktif, aksiyon gerekli):
- Tedarik termin geçti
- Tedarik iptal
- Stok kritik altında
- Diğer kritik olaylar

**Davranış:**
- Sayı: okunmamış uyarı
- Tıklanınca panel açılır (uyarı listesi + aksiyon butonu)
- Kullanıcı aksiyon aldıktan sonra okundu işaretlenir
- Eşikler kullanıcı tarafından ayarlanabilir (parametre)

---

## SENARYO 8 — ÜRETİM GİRİLDİ (Normal, Fire'sız)

**Tetik:** İki yol birden çalışıyor (mevcut, dokunulmaz):
- A) "İşe Başla" → activeWork → "Bitir" → entry modal otomatik açılır
- B) Direkt entry modal → manuel zaman/miktar

**Form alanları:** Operatör(ler), zaman aralıkları, üretim, fire, duruşlar, mesaj.

**canProduceWO yasak kontrolü:** Hedef + fire > maxYapilabilir → ENGEL (mevcut).

**Otomatik zincir (kaydet sonrası):**
- uys_logs kaydı
- Hammadde stok hareketleri (BOM patlatması, çıkış)
- Mamul stok hareketi (giriş):
  - İE order_id var → otomatik o siparişe REZERV
  - İE bagimsiz/siparis_disi → SERBEST stoğa
- activeWork temizlenir
- İE %ilerlemesi güncellenir
- Hedef ulaştıysa → durum=tamamlandı (otomatik)
- Bar havuzu güncellenir (acikBar, tüketildi/açık)

**Sevkiyat kartı (sipariş bağlı İE'de):** İdempotent kontrol, kart yoksa açılır, varsa "hazır miktarı" güncellenir.

**Üretim engel kuralları (mevcut, dokunulmaz):**
- Stok yetersiz → ENGEL (canProduceWO, v15.38)
- Hedef aşımı → ENGEL
- Duruş süresi > iş süresi → ENGEL
- Bar modeli → ENGEL (havuz tükendi → yeni bar mecburi)

---

## SENARYO 9 — FİRE ÇIKTI (Telafi)

**İki fire tipi ayrımı:**
- Tip A: Bar artığı (otomatik fire) — Senaryo 1
- Tip B: Üretim hatası (manuel fire) — BU SENARYO

**Tetik:** Operatör entry modal'da "Fire" alanı doldurulur.

**Stok hareketleri:**
- uys_logs: qty=üretildi, fire=fireAdet
- uys_fire_logs: kayıt (qty, malkod, woId, logId, vs)
- uys_stok_hareketler:
  - Mamul GİRİŞ: sadece SAĞLAM olanlar (üretildi - fire)
  - Hammadde ÇIKIŞ: tüm üretim için BOM patlatması (fire dahil)

**Otomatik telafi (fireTelafiAkisi v15.76):**
- Telafi İE açılır: order_id = orijinal sipariş, hedef = fire adedi
- Senaryo 1 zinciri tetiklenir (kesim + MRP + tedarik)
- Bar çıkışı farklıysa Senaryo 1 modalı açılır

**Recursive telafi:** Telafi İE'de fire çıkarsa → telafinin telafisi otomatik açılır.

**🔔 Bildirim:** Her fire kaydında SARI bildirim. "X İE'de Y fire, telafi açıldı, hammadde durumu Z."

**BACKLOG — FİRE RAPORLAMA:**
- Fire oranı raporu (operatör/makine/malzeme/sipariş)
- Fire sebep analizi (kategori, Pareto)
- Fire trend (aylık grafik)
- Fire bütçe/eşik (% aşımı bildirim)
- Fire kayıt formuna sebep alanı (yeni)

---

## SENARYO 10 — MANUEL STOK ÇIKIŞI (Madde 15 onay sisteminin kalbi)

**Kapsam:** Sevkiyat, üretim BOM çıkışı, fire dışındaki tüm stok çıkışları (numune/demo/iade/transfer/sayım/kalite testi).

**Tetik (A+B paralel):**
- A) Stok Hareketleri sayfası → "+ Çıkış" butonu (genel)
- B) Mamul/Hammadde Stok sayfası → satıra tıkla → "Çıkış Yap" (spesifik)

**Form (zorunlu):** malzeme, miktar, sebep dropdown, açıklama, tarih.
**Form (opsiyonel):** kim için, belge no.

### MAMUL STOK MANUEL ÇIKIŞ — 2 AŞAMA

**Aşama 1 — Serbest stoktan (kayıt yeter, kontrol yok):**
- Çıkış miktarı ≤ serbest stok
- Kayıt zorunlu (sebep + açıklama)
- Toast başarı

**Aşama 2 — Rezerv stoğa dokunma (uyarı + sebep zorunlu):**
- Çıkış miktarı > serbest
- UYARI MODALI:
  ```
  "Bu çıkış için 5 adet REZERV stoktan kullanılacak.
   
   Stok dağılımı:
     Serbest: 20 (otomatik)
     X firması rezerv: 50 (kullan: ___)
     Y firması rezerv: 30 (kullan: ___)
   
   Kullanıcı manuel dağıtım yapar.
   
   Sebep (zorunlu): [dropdown]
   Açıklama (zorunlu): [textarea]
   
   [⚠ Onayla ve Devam Et]   [İptal]"
  ```
- Onaylanırsa OTOMATİK:
  - Rezerv'ten kullanılan miktarın yerine EK İE açılır (her etkilenen sipariş için)
  - Senaryo 1 zinciri her ek İE için
  - 🔔 Bildirim: "X ve Y siparişleri için ek üretim açıldı"

### HAMMADDE STOK MANUEL ÇIKIŞ — 2 AŞAMA

**Aşama 1 — Üretim ihtiyacı dışı (serbest):**
- Çıkış ≤ (stok - MRP ihtiyacı)
- Kontrol yok, kayıt yeter

**Aşama 2 — Üretim ihtiyacına dokunma:**
- Çıkış > serbest
- UYARI MODALI:
  ```
  "Bu çıkış üretim için planlanan hammaddeye dokunacak.
   Stok: 100, MRP ihtiyacı: 80, Serbest: 20
   Talep edilen: 30 (10 üretim havuzundan)
   
   Devam ederse:
     • MRP yeniden çalışacak
     • 10 adetlik yeni tedarik açılacak
     • İE'ler 'Plan Bekliyor' durumuna düşebilir"
  ```
- Sebep + açıklama zorunlu
- Onaylanırsa: stok düşer → MRP otomatik → yeni tedarik otomatik (F-21)

---

## SENARYO 11 — MANUEL STOK GİRİŞİ

**Tetik:** Senaryo 10 simetrisi (A+B birlikte, "+ Giriş" butonu).

**Form:** Sebep dropdown (sayım fazlası/iade/transfer/hata düzeltme/diğer).

**KURAL:** Tüm manuel giriş = SERBEST stoğa.

**Hammadde girişi sonrası:**
- Stok güncel
- MRP otomatik
- Açık tedarik fazla görünüyorsa → 🔔 SARI bildirim:
  "X malzeme stok arttı, açık tedarik fazla. Tedarikçiyle konuşup azaltmak ister misiniz?"
- Sistem otomatik tedarik düzeltmesi YAPMAZ (Senaryo 3.2 kuralı)

**Mamul girişi sonrası:**
- +SERBEST stok
- Sistem açık siparişler arasında bu mamulu arar
- Eşleşen sipariş varsa → 🔔 SARI bildirim:
  "X mamul stoğa girdi. Açık siparişler bu mamulu istiyor (Sipariş Z, kalan 20). Stoktan kullanmak ister misiniz?"
- Sistem otomatik rezerve etmez

---

## SENARYO 12 — 2 SİPARİŞ AYNI MALZEME (FIFO + Manuel Müdahale)

**TAHSİS HİYERARŞİSİ:**
1. Termin sırası (en yakın önce)
2. Aynı termin → uys_orders.oncelik (yüksek önce)
3. Aynı öncelik → giriş tarihi (önce gelen önce, fall-back)

**Manuel İE:** Termin alanı zorunlu. FIFO'da sipariş'lerle aynı kuralla yarışır.

**Otomatik FIFO tahsisi:**
- MRP her stok değişiminde yeniden çalışır
- Tahsis termin sırasına göre yapılır
- Eksik miktar için tedarik otomatik açılır (en geç termin'li sipariş için)

**Manuel müdahale (Senaryo 3.11 simetrisi):**
- Hammadde tahsisi'ne de dokunulabilir
- Modal: "Sipariş X'in 20 hammaddesini Sipariş Y'ye aktar?"
  - Sebep + açıklama zorunlu
  - Onay → tahsis aktarılır
  - Etkilenen sipariş için ek tedarik veya ek İE açılır

**Görünürlük (Senaryo 3.9 hammadde simetrisi):**
```
Hammadde stok kartında dağılım:
  Toplam stok
  Sipariş bazlı tahsis (termin + miktar)
  Manuel İE tahsisleri
  Serbest miktar
  Bekleyen tedarik (yolda)
```

**Tedarik geldiğinde:** Otomatik MRP → FIFO yeniden tahsis. Yeni stok en uzak termin'li sipariş'e gider.

### SİMETRİK MODEL — Mamul ↔ Hammadde

| | MAMUL | HAMMADDE |
|---|---|---|
| Otomatik bağlama | İE üretim → order_id rezerv | FIFO tahsis (termin) |
| Görünürlük | Stok kartında rezerv dağılımı | Stok kartında tahsis dağılımı |
| Manuel müdahale | Rezerv → başka sipariş | Tahsis → başka sipariş |
| Müdahale gereği | Sebep + açıklama zorunlu | Sebep + açıklama zorunlu |
| Sonuç | Etkilenen sipariş için EK İE | Etkilenen sipariş için ek tedarik/İE |

---

## SENARYO 13 — HAMMADDE ALTERNATİFİ

**ÖN KOŞUL: Malzeme kartı yeni alanlar:**
- Cins (demir / alüminyum / paslanmaz / vb)
- Kalite (S235JR / S275 / 6082-T6 / vb)
- Standart (EN 10025-2 vb) — opsiyonel
- Kaplama (galvanizli / boyalı / ham) — opsiyonel

**Alternatif tanımlama:**
- Malzeme detay sayfasında "Alternatifler" sekmesi (yeni)
- Tablo: alternatif malzeme + dönüşüm oranı
- ÇIFT YÖNLÜ OTOMATİK LİNK: 6000 kartına 12000 alternatif eklendi → 12000 kartına 6000 otomatik. Oran tersine yazılır (1→2 olan, ters yönde 0.5→1).
- Manuel tanımlama (sistem otomatik öneri yapmaz, kullanıcı bilerek eşleştirir).

**MRP seviyesi — alternatif HARİÇ:**
- MRP sadece "kalite + cins + çap × kalınlık" eşleşmesine bakar
- Boy fark etmez — kalite/cins eşleşen toplam stok'a bakar
- Eksik miktar için tedarik açar

**Kesim planı seviyesi — alternatif DAHİL:**
- Boy bazında otomatik en ekonomik dağıtım:
  1. Direkt boy önce (fire 0)
  2. Alternatif boylar fire'a göre sıralı (en az fire önce)
  3. Eksik için tedarik açılır

**Yeni tablo:** uys_malzeme_alternatifler (malzeme_id, alternatif_id, donusum_orani)

---

# ANA YAPISAL KARARLAR

| # | Karar | Mevcut durum |
|---|---|---|
| 1 | **Mamul stok rezerv/serbest ayrımı** | Kod tarafında YOK |
| 2 | **Hammadde stok tahsis dağılımı** | Kod tarafında YOK |
| 3 | **Manuel rezerv/tahsis müdahalesi** (Senaryo 3.11, 10.6, 12.4) | YOK |
| 4 | **🔔 Bildirim merkezi** | YOK, yeni özellik |
| 5 | **Kesim planı bar çıkışı modalı** ("55 mi 50 mi?") | Belirsiz, kontrol gerek |
| 6 | **Tedarik kısmi/fazla geliş kapat/iade** seçenekleri | Belirsiz |
| 7 | **Tedarik gecikme/yaklaşan termin** otomatik tespit | YOK |
| 8 | **Malzeme kartı kalite/cins alanları** | YOK |
| 9 | **Malzeme alternatifleri** (Senaryo 13) | YOK |
| 10 | **Kesim planı alternatif boy desteği** | YOK |
| 11 | **Manuel İE termin zorunlu** | Belirsiz |
| 12 | **v15.74 AZALIS BLOCK kuralı yanlış** | Saha modeline ters, düzeltme gerek |

---

# BACKLOG SENARYOLAR (ileride ele alınacak)

1. **İade akışı** (Senaryo 5.4, 6.5)
2. **Fire raporlama** (Senaryo 9.8)
3. **Çoklu admin oturumu** (önceki tespit)
4. **Operatör entry modal — kendini çıkaramama bug'ı** (Senaryo 8.2)

---

# MADDE 15 ONAY SİSTEMİ — Bu Spec'in Çıktısı

13 senaryo bittiğinde Madde 15 onay sistemi mimarisi netleşti. Tasarım girdileri:

**Aşamalı kontrol modeli:**
1. Serbest stok/tahsis → kontrol yok, kayıt yeter
2. Rezerv/tahsis stok → uyarı + sebep + sonuç (ek İE/tedarik)
3. Üretim ihtiyacına dokunma → uyarı + sebep + MRP yeniden çalışır

**Kullanıcı deneyimi:**
- Modal'lar etkilenecekleri gösterir
- Sebep dropdown + açıklama text zorunlu
- Onay sonrası otomatik aksiyon zinciri (ek İE/tedarik)
- 🔔 Bildirim merkezine kayıt (audit + bilgi)

**Veri modeli ihtiyaçları:**
- Mamul stok rezerv kavramı (yeni)
- Hammadde stok tahsis kavramı (yeni)
- Bildirimler tablosu (yeni)
- Manuel müdahale audit kayıtları (sebep + kim + ne zaman)

---

*Bu doküman 28 Nisan 2026 öğleden sonra hazırlandı. Buket'in kafasındaki saha modelini Claude ile soru-cevap halinde yazıya döktü. Kod doğrulama + Madde 15 tasarımı + yeni özellik geliştirmeleri için referans.*
