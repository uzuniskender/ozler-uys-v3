# v15.82 Patch — Saha Modeli Uyum (2 küçük fix)

**Sürüm:** v15.82
**Kapsam:** Saha model konuşmasından (28 Nis öğleden sonra) çıkan 2 düzeltme

## Değişiklikler

### 1. AZALIS BLOCK kuralı kaldırıldı (mrp.ts)

Eski: `siparisDelta` AZALIS senaryosunda üretildi > yeniAdet → hata atıyordu
Yeni: İzin verilir, `siparisRevizeUygula` zaten `Math.max(uretildiAdet, ...)` ile hedefi koruyor

**Saha kuralı (Senaryo 5):**
```
Üretildi 35, sipariş 30'a düştü
  → IE.hedef=35'te dondurulur
  → Sipariş kalemi=30 (müşteriye 30)
  → Fazla 5 → SERBEST stoğa
  → Engel YOK
```

### 2. Manuel İE termin zorunlu (Orders.tsx)

Eski: "Müşteri yok" tiki açıkken termin opsiyonel (v15.58)
Yeni: Termin her durumda zorunlu

**Saha kuralı (Senaryo 12.3):**
```
Manuel İE de FIFO'da diğerleriyle aynı kuralla yarışır
Termin = "ne zaman lazım" bilgisi
Çelişki yok
```

### 3. Senaryo 7 Adım 4 testi güncellendi (testRunner.ts)

Eski test: "BLOCK çalışmadı" hatası bekliyordu
Yeni test: İzin verilmesini bekler, hata olmamalı

## Etkilenen 3 dosya

| Dosya | Değişiklik |
|---|---|
| `src/features/production/mrp.ts` | AZALIS BLOCK kuralı kaldırıldı (~10 satır) |
| `src/pages/Orders.tsx` | Termin zorunlu kontrol (1 satır) |
| `src/lib/testRunner.ts` | Senaryo 7 Adım 4 güncellendi (~10 satır) |

## Apply

Tarayıcıdan zip'i Downloads'a indir:

```
$zip = "$env:USERPROFILE\Downloads\patch-v15-82.zip"
$dest = "$env:USERPROFILE\Downloads\patch-v15-82"
Remove-Item $dest -Recurse -Force -EA SilentlyContinue
Expand-Archive -Path $zip -DestinationPath $dest -Force

$src = Join-Path $dest 'patch-v15-82'
Copy-Item "$src\src\features\production\mrp.ts"  "src\features\production\mrp.ts"  -Force
Copy-Item "$src\src\pages\Orders.tsx"            "src\pages\Orders.tsx"            -Force
Copy-Item "$src\src\lib\testRunner.ts"           "src\lib\testRunner.ts"           -Force

git add -A
git status
git commit -m "v15.82: Saha modeli uyum - AZALIS BLOCK kaldirildi + manuel IE termin zorunlu"
git push origin main
git tag v15.82
git push --tags

Remove-Item $zip,$dest -Recurse -Force -EA SilentlyContinue
```

## Doğrulama

Deploy yeşil olunca:

1. **Sipariş düzenle azalış testi:**
   - Mevcut sipariş 50, üretim 35 olsun
   - Sipariş 50→30 düzenle, kaydet
   - **Eskiden:** "47 üretildi, 30 olamaz" hata
   - **Yeni:** Kaydedilir, IE.hedef=35'te kalır, sipariş kalemi=30

2. **Manuel İE termin testi:**
   - Yeni İE aç, "Müşteri yok" tikle, termin boş bırak
   - Kaydet → "FIFO sıralaması için zorunlu" hatası

3. **Senaryo 7 + 12 testleri:**
   - Test Modu → Senaryo 7 (12/12 PASS bekleniyor — Adım 4 davranışı değişti)
   - Senaryo 12 yeni saha modelinden çıkmıştı, henüz test eklenmedi (backlog)

## Risk

- **Düşük.** İki değişiklik de saha kuralına uyduruyor.
- AZALIS BLOCK kaldırılması — `siparisRevizeUygula` zaten doğru çalışıyor (Math.max), sadece UI uyarısı kalktı.
- Termin zorunlu — yeni manuel İE açışlarda bir alan daha doldurulması gerek, kaydedilmiş eski İE'ler etkilenmez.
