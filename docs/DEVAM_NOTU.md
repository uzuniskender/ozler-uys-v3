# Yeni Oturum Devam Notu

**Tarih:** 25 Nisan 2026 (v15.41 sonrası)
**Son canlı sürüm:** v15.41 (Stok Anomalisi Rapor Düzeltmesi — bypassNotu sistemi)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md + docs/UYS_v3_Is_Listesi.md oku.
Son iş: v15.41 stok anomalisi rapor düzeltmesi TAMAM. Sırada audit-columns 4 trace edilemeyen çağrı.
```

---

## v15.41 — Neyin Düzeltildi

### Sorun
Test senaryolarında `_uretimGirisi` ve `_uretimGirisiFire` helper'ları doğrudan `supabase.from('uys_logs').insert(...)` yapıyor; UI'daki `OperatorPanel.save()` → `canProduceWO()` yolundan geçmiyor. Sonuç: Yasak 1 (stok kontrolü) atlanıyor, rapora `-3 stok` gibi anomalik değerler düşüyor — özellikle Senaryo 5'te (qty=6 + fire=2 = 8 hammadde tüketimi, 4 birim tedarik geldiyse -4 stok).

### Çözüm
Mantığı bozmadan rapor okunabilirliğini düzeltmek:

**`src/lib/testRunner.ts`:**
- `SenaryoAdim` tipine opsiyonel `bypassNotu?: string` alanı eklendi
- `BYPASS_NOTU_URETIM` sabit metni tanımlandı
- `adim()` helper fonksiyonu opsiyonel `meta?: { bypassNotu?: string }` parametresi alır
- 6 üretim adımı bypassNotu taşıyor: S1 #5, S2 #5, S3 #10, S4 #10, S5 #5 (fire), S5 #9 (telafi)

**`src/pages/TestMode.tsx`:**
- Canlı log render: kart `flex-col`, üst satır mevcut layout, alt satır `bypassNotu` varsa ℹ️ + gri italik açıklama (ml-5, text-[10px], italic, text-zinc-500)

### Etkilenmeyen Şeyler
- PASS/FAIL kararı: aynı
- Validation kuralları (`canProduceWO`, `canDurus`, `canDeleteWO`): aynı
- Helper davranışları: aynı
- DB şeması: değişmedi
- Senaryo 6 (negatif test): etkilenmedi (üretim adımı yok)

---

## Doğrulama (Apply + push sonrası)

1. **Test Modu çalıştır:** Senaryo 5 (Sipariş + Fire + Telafi)
2. **Canlı log kontrol et:** Adım 5 ("Fire'lı üretim") ve Adım 9 ("Telafi İE üretim") altında ℹ️ + "Test helper kullanır — UI'daki Yasak 1 (stok kontrolü) bypass edilir..." satırı görünmeli
3. **JSON rapor indir:** Bu iki adımda `"bypassNotu": "Test helper..."` alanı bulunmalı
4. **S6 (negatif test):** Hiçbir adımda bypassNotu OLMAMALI (üretim adımı yok)
5. **Pre-push hook:** `git push --dry-run` → 3/3 OK beklenir

---

## Sırada (Öncelik Sırasına Göre)

### 1. audit-columns trace edilemeyen 4 çağrı 🟡
Pre-push hook bu 4 noktayı trace edemiyor. Kolon mismatch var mı diye elle bakılmalı:
- `src\features\production\autoChain.ts:64` — `uys_work_orders [upsert]`
- `src\lib\testRun.ts:172` — `uys_orders [insert]`
- `src\pages\Operators.tsx:206` — `uys_izinler [insert]` (değişken başka modülden)
- `src\pages\Procurement.tsx:127` — `uys_tedarikler [update]` (değişken başka modülden)

### 2. Küçük işler 🟢
- Manuel plan'da havuz önerisi (v15.35 eksik)
- Hurda geri alma UI
- Havuz geri alma UI
- Toplu senaryo farklı reçetelerle çalıştırılabilir
- Operator + Admin için test kapsamı

---

## Komutlar

**Hotfix apply:**
```powershell
cd $env:USERPROFILE\Downloads\patch-v15-41
powershell -ExecutionPolicy Bypass -File .\apply.ps1
```

**Commit + push (pre-push hook artık çalışıyor — `--no-verify` GEREKMEZ):**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3
$env:GIT_PAGER = "cat"
git pull
git add -A
git commit -m "v15.41: stok anomalisi rapor duzeltmesi - bypassNotu sistemi"
git push
```

Eğer hook 3/3 yeşil verirse push başarılı olur. FAIL olursa hata mesajını gönder, debug ederiz.

---

**v15.41 patch'i hazır.**
