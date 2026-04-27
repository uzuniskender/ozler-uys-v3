# UYS v3 — Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026 akşam (oturum kapanışı)
**Son canlı sürüm:** v15.76
**İş Emri #13 durum:** 17/22 madde TAMAM, 3 büyük değişiklik test bekliyor

---

## YENİ OTURUM AÇILIŞINDA İLK ADIM

```
UYS v3 devamı. Bilgi Bankası açılış kuralı (§0):
docs/UYS_v3_Bilgi_Bankasi.md (özellikle §0, §18 ailesi, §19, §20, §21 MRP Formülü, §22 27 Nis özeti) +
docs/DEVAM_NOTU.md +
docs/is_emri/00_BACKLOG_Master.md +
docs/is_emri/13_AnaAkisRefactor.md +
docs/atil_kod_analizi_20260427.md
oku.

Önceki chat silindi/silinecek — bilgilerin tamamı docs'ta.

Bugünkü ilk iş: §22'de listeli "Yarın TODO" maddelerinden birini Buket seçecek:
  1. Manuel test (v15.74 Madde 11 / v15.76 Madde 13 / v15.75 Loglar) — KRİTİK
  2. MRP senaryoları konuşması (Buket anlatır, Claude sorar)
  3. Madde 15 onay sistemi (rezerve değil, planlama onay)
  4. Madde 8+9 resmi durum string'leri
  5. Madde 16 kesim artık ürün sorma
  6. Sağlık Raporu Kontrol 11 (eski IE-MANUAL'ler — opsiyonel)

Buket önceliği belirler.
```

---

## MULTI-MACHINE NOTU

Yarın **diğer bilgisayardan** devam edilecek. İlk komut:

```powershell
cd C:\Users\<kullanici>\Documents\GitHub\ozler-uys-v3
git pull origin main

# Çevre kontrol
node --version; npm --version; git --version
```

Eğer node/npm yoksa kurulması gerekmez (GitHub Actions build ediyor). Sadece git lazım.

WinRAR yoksa PowerShell built-in `Compress-Archive` kullanılır:
```powershell
$zip = "$env:TEMP\uys-claude-dump.zip"
Compress-Archive -Path "$dump\*" -DestinationPath $zip -Force
```

---

## KRİTİK UYARILAR

### 1. Test Edilmemiş Sürümler Sahada

| Sürüm | İş | Risk |
|---|---|---|
| **v15.74** | Sipariş Delta Revizyonu (8 senaryo) | YÜKSEK — Edit save akışı tamamen değişti, eski delete-recreate yerine delta-based. Yarın sipariş düzenleme yaparsa beklenmedik davranış görebilir. **Sabah ilk iş test.** |
| **v15.76** | Fire Telafi recursive akış | ORTA — Reports → Fire → "Telafisi İE Oluştur" tıklanırsa yeni recursive akış devreye girer. Eski caller'lar (varsa) dokunulmadı (geriye uyum). |
| **v15.75** | Loglar sayfası | DÜŞÜK — Yeni sayfa, eski akışları etkilemiyor. |

### 2. MRP Formülü Kuralı (§21)

```
NET İHTİYAÇ = İHTİYAÇ - STOK - YOLDA
```

**Bu kadar. Rezerve, başka hesaplar yok.** v15.70'te kaldırıldı, geri gelmemeli. Madde 15 (yarın) **rezerve değil onay sistemi** olarak yapılacak.

### 3. Saha Manuel Düzeltme Yapıldı

S26A_02981_2'nin 207 fazla tedariği SQL ile silindi (gerçek ihtiyaç olmadığı v15.74 Madde 10 ile uyumlu). DB'de bu sipariş için sadece 114'lük tedarik kaldı.

---

## BUGÜN YAPILANLARIN LİSTESİ (30+ commit)

Detay için `§22 Bilgi Bankası` veya `is_emri/13_AnaAkisRefactor.md` oku.

**Sürüm aralığı:** v15.51 → v15.76

**3 İş Emri kapandı (gece):** #1 Operatör + #2 Yedekleme + #3 Üretim Zinciri

**İş Emri #13 (gündüz):** 17/22 madde TAMAM. Kalan: Madde 8, 9 (durum string), 13 (test), 11 (test), 14 (test), 15 (yarın), 16 (kısmi).

**Kritik mimari değişiklikler:**
- Rezerve sistemi kaldırıldı (v15.70) — MRP formülü temizlendi
- Sipariş edit delta-based (v15.74) — eski delete-recreate gitti
- Fire telafi recursive (v15.76) — siparişe bağlı, alt basamaklar otomatik
- Yeni `/logs` sayfası (v15.75) — sistem-wide log

---

## SİL UYARISI

⚠️ **Bu chat 27 Nis 2026 akşamı silinecek.** Bilgilerin tamamı bu DEVAM_NOTU + Bilgi Bankası §22 + atıl kod analizinde. Yarın yeni Claude oturumda chat'i aramaya **gerek yok**.

İyi geceler Buket. 🌙
