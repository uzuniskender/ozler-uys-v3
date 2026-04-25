# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.44 sonrası)
**Son canlı sürüm:** v15.44 (Geri alma UI'ları + manuel plan havuz önerisi)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.44 geri alma UI'ları + manuel plan havuz önerisi TAMAM. Backlog'da blocker yok.
```

---

## v15.44 — Üç UI İşi Tek Patch

### İş 1: Hurda geri alma UI (admin only)
**Yer:** Warehouse.tsx → "Hurdaya Gönderilen" alt tab → her satıra "↩ Geri Al" butonu (kehribar renkli, küçük).
**RBAC:** `acikbar_hurda_geri_al` (DEFAULTS'ta boş array → admin only).
**Aksiyon:** `barModel.ts.acikBarHurdadanGeriAl(barId, kullaniciId, kullaniciAd)`:
1. `uys_acik_barlar.durum` 'hurda' → 'acik', hurda_* alanları NULL
2. `uys_fire_logs` ilgili 'bar_hurda' kaydı **SİLİNMEZ** — `not_` alanına `[İPTAL: tarih kullanıcı]` prefix eklenir → audit trail korunur
3. fire_log id'si artık deterministik: `'fire-bar-hurda-' + acikBarId` → idempotent + geri alma sırasında bulunabilir
4. Confirm dialog ile kullanıcı onayı gerekir

### İş 2: Havuz geri alma UI (admin only)
**Yer:** Warehouse.tsx → yeni "Tüketilmiş Bar" alt tab'ı (`tab='tuketildi'`). 'tuketildi' durumlu açık barları listeler.
**RBAC:** `acikbar_havuz_geri_al` (admin only).
**Aksiyon:** `barModel.ts.acikBarTuketimGeriAl(barId, kullaniciId, kullaniciAd)`:
1. `uys_acik_barlar.durum` 'tuketildi' → 'acik', tuketim_* alanları NULL
2. **Stok hareketlerine DOKUNULMAZ** — eğer üretim gerçekten yapıldıysa stok zaten düşmüştür
3. Confirm dialog'da NET uyarı: *"Stok hareketleri korunur, manuel düzeltme gerekirse Stok sayfasından yapın"*
4. Yanlış işaretleme senaryosu için tasarlandı (double-counting riski yok)

### İş 3: Manuel plan'da havuz önerisi
**Yer:** CuttingPlans.tsx → KesimOlusturModal `kaydet()` artık yeni planId'yi `onSaved(planId)` callback'ine iletiyor. Parent CuttingPlans bu ID ile otomatik plan'daki havuz tarama mantığının aynısını çalıştırıyor.
**Mantık:**
- yeniPlan.durum === 'bekliyor' kontrol
- Plandaki HM için durum='acik' bar varsa
- Plandaki en küçük parça boyu havuz barından küçük/eşit ise → HavuzOneriModal aç
- Eski otomatik plan'la birebir aynı UX

### Etkilenmeyen
- DB şeması: değişmedi (sadece deterministik fire_log ID'si yeni hurda kayıtlarında kullanılır, eski kayıtlar olduğu gibi kalır)
- Mevcut hurda yapma akışı: aynı (sadece fire_log ID'si artık deterministik)
- Tüketim mantığı: aynı (barModelSync, acikBarTuket dokunulmadı)
- Validation kuralları: aynı

---

## Doğrulama (Apply + push sonrası)

### Test 1: Hurda geri alma
1. Açık Bar Havuzu → Detay → bir barı hurdaya gönder
2. "Hurdaya Gönderilen" alt tab → bar listede görünmeli, sağda "↩ Geri Al" butonu (admin'sen)
3. Geri Al → confirm dialog → onay → bar listeden gitmeli, "Açık Bar Havuzu"nda görünmeli
4. Reports → Fire Analizi → ilgili kayıt hala görünür ama `not_` alanı `[İPTAL: ...]` prefix ile başlar

### Test 2: Havuz geri alma (eğer tüketilmiş bar varsa)
1. "Tüketilmiş Bar" alt tab'ı → tüketilmiş barlar listede
2. "↩ Geri Al" → confirm dialog → uyarı mesajını oku → onay → bar açık havuza döner
3. Stok sayfası → ilgili HM stok değişmemiş olmalı (dokunulmadı)

### Test 3: Manuel plan havuz önerisi
1. Manuel Plan → bir HM seç (havuzunda açık bar olan, parça boyu uygun)
2. İE seç + bar oluştur + kaydet
3. Kaydet sonrası HavuzOneriModal otomatik açılmalı
4. Önerilen havuz barını seç + onayla → plan yeniden optimize olmalı

### Push doğrulama
- Pre-push hook 3/3 yeşil olmalı
- audit-columns warning sayısı 3 (önceki gibi, bu patch yeni warning eklemedi)

---

## Sırada (Belirgin Blocker Yok)

Backlog temizlendi. Olası yönler kullanıcı tercihine bağlı:

- Toplu senaryo farklı reçetelerle çalıştırılabilir hale getir
- Operator + Admin için test kapsamı (S1-S5 tüm rollerde tekrar)
- (yeni iş ihtiyacı geldikçe)

---

## Komutlar

**Apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-44
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push** (kod-only patch, schema değişikliği YOK):
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.44: hurda+havuz geri alma UI + manuel plan havuz onerisi"
git push
```

Pre-push hook 3/3 yeşil bekleniyor.

---

**v15.44 patch'i hazır.**
