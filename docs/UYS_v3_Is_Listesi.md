# UYS v3 — Test İş Listesi ve Yasak Kontrolleri

**Hazırlayan:** Buket
**Son güncelleme:** 25 Nisan 2026 (v15.47.2)
**Durum:** Tüm test senaryoları + yasak kontrolleri + pre-push hook + stok anomalisi raporu + termin kolonu + audit yorum temizleyici + geri alma UI'ları TAMAM ✅. v15.45-46: Hijyen Kuralı + iş emirleri arşivi. v15.47: İş Emri #3 Faz 1+5. v15.47.1: audit whitelist + §18.2. v15.47.2: durum string normalize + §18.3.

---

## 📋 Test Senaryoları (Otomatikleştirildi — v15.37 + v15.38 Test Modu)

### ✅ Senaryo 1 — Sipariş + Tam Akış
Reçetesi olan bir malzemeden 9999 adet sipariş gir.
Beklenen zincir: Sipariş Girişi → Kesim Planı otomatik → MRP otomatik → Tedarik otomatik → İhtiyaç teslim alınır → Parçalı üretim (farklı operatörler, duruşlar) → Stok hareketleri doğrulanır → Sevkiyat planlanır/sevk edilir → Stok hareketleri tekrar kontrol (HM + YM önemli).

### ✅ Senaryo 2 — Manuel İş Emri + Tam Akış
Reçetesi olan bir malzemeden 9999 adet İE gir. Aynı zincir.

### ✅ Senaryo 3 — Sipariş + Tedarik Sil + 2. Sipariş
9999 adet sipariş gir → Kesim planı → MRP → Tedarik → SİLMEK → MRP tekrar (ihtiyaç olmalı) → yeni tedarik oluştur → 2. Sipariş (tedarik gelmeden) → Kesim güncelle → MRP güncelle → Konsolidasyon → teslim → üretim.

### ✅ Senaryo 4 — İE + Tedarik Sil + 2. İE
Aynı akış, sipariş yerine İE.

### ✅ Senaryo 5 — Fire + Telafi + Duruş
Sipariş → Kesim → MRP → Tedarik → Teslim → **Fire'lı üretim (6 adet + 2 fire + 2 duruş)** → Fire log doğrula → Duruş kaydı doğrula → **Fire telafi İE otomatik oluşur** → Telafi için kesim + MRP + üretim.

### ✅ Senaryo 6 — Negatif Test (v15.38 YENİ)
Yasak kontrollerini test eder. 10 adım: 6 engel + 4 izin.
Saf `validations.ts` fonksiyonlarını sahte veriyle çağırır. Engel dönmezse FAIL.

---

## ✅ Yasak Kontrolleri (Parça 5 — TAMAMLANDI v15.38)

### Yasak 1: Stok olmadan üretim ✅
- **Kural:** q + f > maxYapilabilir → engel (admin bile bypass edemez)
- **Yer:** `OperatorPanel.save()` → `canProduceWO()` çağrısı
- **Hata mesajı:** "Hammadde stoğu yetersiz — girilen X adet, max Y adet yapılabilir."
- **Test:** Senaryo 6 adım 1, 2, 3

### Yasak 2: Duruş süresi > iş süresi ✅
- **Kural:** toplamDurus > toplamCalisma → engel. Çalışma 0 iken duruş girilemez.
- **Yer:** `OperatorPanel.save()` → `canDurus()` çağrısı
- **Test:** Senaryo 6 adım 4, 5, 6

### Yasak 3: Akış dışı silme ✅
- **Kural:** Bağlı log/stok/fire varsa İE silinemez. Log silme password ister.
- **Yer:** `WorkOrders.deleteWO()` + `topluSil()` + `deleteLog()` → `canDeleteWO()` çağrısı
- **Silme yerine:** "İptal Et" yönlendirmesi
- **Test:** Senaryo 6 adım 7, 8, 9, 10

---

## 🧹 Test Sonrası Temizlik Gereksinimleri

- **Sipariş ve iş emirleri silinmeli**
- **Kesim planları güncellenmeli**
- **Üretim logları silinmeli**
- **Personel hareketleri silinmeli**
- **Fire hareketleri silinmeli** (telafi İE'ler dahil)
- **Duruş logları silinmeli**
- **Personel performans kayıtları silinmeli**
- **Test öncesi durum = Test sonrası durum — hiçbir kalıntı olmamalı**

**ÇÖZÜM (v15.37):** `test_run_id` etiketi + cascade delete. Doğrulandı:
- TEST_20260424_04: 4 senaryo ALL_PASS, SQL temiz
- TEST_20260424_09: 5 senaryo ALL_PASS, SQL temiz
- TEST_20260425_XX (v15.38): 6 senaryo bekleniyor

---

## 🎯 JSON Raporu

Her test bitiminde otomatik JSON rapor indirilir. İçerik:
- Senaryo adı + test_run_id + süre + genel durum
- Her adımın OK/FAIL/SKIP + süre + delil
- Senaryo 6'da her adım `engellendi: true/false` + `sebep` delili içerir

---

## 👥 Admin + Operatör Testleri

**Admin giriş:** Tüm testler (S1-S6)
**Operatör giriş:** Sınırlı — sadece üretim girişi + duruş (RBAC dahilinde)
**Misafir:** Yazma engelli (guest mode)

**Not:** v15.38 Yasak 1 (stok) admin dahil tüm rollerde sıkıdır. Admin için özel bypass YOK.

---

## 📊 Sağlık Raporu Entegrasyonu

Test bitince manuel olarak:
- **Veri Yönetimi → 🩺 Rapor Oluştur** butonuna bas
- **11/11 PASS bekleniyor** (v15.39 ile SR #11 havuz satırı adaptasyonu tamamlandı ✅)
- SR #11 artık 3 durumu ayrı raporluyor:
  - Normal satır eksik bar_acilis (eski mantık)
  - Havuz satırı orphan (havuzBarId uys_acik_barlar'da yok)
  - Havuz satırı "tüketildi" işaretlenmemiş (durum='acik' kalmış)

---

## 📝 Notlar

- Her test senaryosu farklı reçete ile tekrar çalıştırılabilir
- Adet 9999 ile yapılan test tedarik+stok akışının çalıştığını gösterir
- Küçük adetlerle (örn. 10) stok zaten yeterli olabilir, tedarik/teslim adımı SKIP olur
- Senaryo 6 reçete gerektirmez (saf validation testi)
- **Önemli:** `_uretimGirisi` test helper'ı yasak kontrollerini BYPASS eder (Senaryo 5 -3 gösterimi kasıtlı — helper direkt DB insert yapar, UI save() yolundan geçmez). Yasak 1 gerçek koruma sadece UI katmanında (`save()`).
- **v15.41 ile (rapor okunabilirliği):** Bypass kullanan 6 üretim adımı (S1 #5, S2 #5, S3 #10, S4 #10, S5 #5 fire, S5 #9 telafi) artık `bypassNotu` taşıyor. Test Modu canlı log'unda adım kartının altında ℹ️ + gri italik açıklama görünür. JSON raporda da alan korunur. Mantık değişmedi; yalnız meta + UI rendering.
