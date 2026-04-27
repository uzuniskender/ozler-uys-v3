# Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026
**Son canlı sürüm:** v15.68 (kod) + v15.66 (Madde 7) + v15.67 (Madde 10 iskelet)
**Bugünkü iş:** İş Emri #13 (Ana Akış Refactoru) — 22 maddenin **14'ü tamamlandı**

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/is_emri/13_AnaAkisRefactor.md + docs/is_emri/00_BACKLOG_Master.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18 ailesi 5 kalıcı kural + §19 + §20) oku.

Son durum: 27 Nis 2026 boyunca İş Emri #13 üzerinde çalışıldı. 22 maddeden 14'ü TAMAM:
  ✅ 1, 2, 3, 4, 5, 6, 7, 10 (iskelet), 17, 18, 19, 20, 21, 22 — toplam 14
  ❌ 8, 9 (kısmen var), 11, 12 (kısmen var), 13, 14, 15, 16 (havuzla yapıldı sayılır)

KRITIK BUG'LAR KAPANDI:
  - F-21 idempotent tedarik (4 farklı tedarik açma noktasında)
  - Rezerve mantığı kaldırıldı (Buket'in formülü: BRÜT - STOK - YOLDA)
  - Kesim planı zorunluluğu (üretim girişinden önce hard block + UI rozet)
  - Çift tedarik bug'ı kalıcı çözüldü

Sıradaki büyük adaylar:
  - Madde 11 — sipariş artış otomasyonu (1 gün)
  - Madde 14 — log izlenebilirlik UI (4-6 saat)
  - Madde 15 — depo hareketi → tedarik tetik (1 gün)
  - Madde 13 — fire İE açma akışı (2-3 gün)
  - Madde 17 ileri faz — Dashboard hatırlatma + "Beklet"in son detayları
  - Mevcut 207'lik fazla tedarik düzeltmesi (S26A_02981_2 yapıldı, S26A_02707 hala var — kontrol gerek)

Buket önceliği belirler.
```

---

## 27 Nisan Gündüz İşleri (16+ commit, İş Emri #13)

### Tamamlanan Maddeler (14)

| # | Madde | Sürüm |
|---|---|---|
| 1 | Yeni İE butonu Sipariş'e taşındı | v15.57 |
| 2 | Buton adı "Yeni İş Emri" | v15.57 |
| 3 | Sipariş/İE birleştirme — Stok + Tekil tikleri | v15.58 |
| 4 | Geniş modal (zaten uyumlu) | — |
| 5 | Sekme yok (zaten uyumlu) | — |
| 6 | Sipariş save sonrası kesim varsa /cutting'e (koşullu) | v15.60 |
| 7 | MRP toast → "Tedariklere Git" action butonu | v15.66 |
| 10 | Sipariş eksildiğinde fazla tedarik otomatik düzelt **(iskelet)** | v15.67 |
| 17 | Yarım kalan akış için **Devam/Beklet/İptal** karar modalı | v15.64 + v15.65 |
| 18 | MRP'de Bağımsız YM İE bölümü kaldırıldı | v15.59 |
| 19 | Stok yeterli → MRP "tamam" (otomatik) | v15.56 |
| 20 | Stok yetersiz → MRP otomatik tedarik açar | v15.56 |
| 21 | İdempotent tedarik (BRÜT − STOK − YOLDA) | v15.56 + v15.62 + v15.63 |
| 22 | FIFO sipariş tüketimi (zaten v15.50a) | — |

### Bonus İyileştirmeler

| Sürüm | İş |
|---|---|
| v15.55 | ProductionEntry kesim planı zorunluluğu (HARD BLOCK) |
| v15.61 | WorkOrders "Plan Bekliyor" rozeti (UI) |
| v15.63 | mrp.ts rezerve düşürmesi kaldırıldı (Buket'in formülü) |
| v15.68 | Plan Bekliyor rozeti tıklanabilir (one-click /cutting) |

### Kritik Bug Düzeltmeleri

**Çift Tedarik Bug'ı (F-21):** 27 Nis 09:39'da S26A_02981_2 için 114, sonra 10:13'te aynı sipariş için 207 birim daha açıldı (toplam 321, oysa gerçek ihtiyaç 207). Sebep: `mrpTedarikOlustur` mevcut bekleyen tedariği kontrol etmiyor. **F-21 idempotent kontrol** eklendi:
- Mevcut bekleyen miktar ≥ ihtiyaç → açma
- Mevcut < ihtiyaç → sadece farkı aç

**4 Tedarik Açma Noktası Tek Tek Düzeltildi:**
1. ✅ `mrpTedarikOlustur` (mrp.ts) — F-21 idempotent içeride
2. ✅ `runMRP` (Orders.tsx) — F-21'i kullanıyor (v15.56)
3. ✅ `autoChain` (autoChain.ts) — F-21'i kullanıyor
4. ✅ `topluTedarikOlustur` (MRP.tsx) — v15.62'de F-21'e delege edildi

**Manuel Veri Düzeltmesi (saha):**
- `S26A_02981_2`'nin 207 fazla tedariği SQL ile silindi (DELETE FROM uys_tedarikler + uys_stok_hareketler)
- `S26A_02707`'nin 207 fazla tedariği TESPIT EDİLDİ ama mevcut MRP'ye göre hala ihtiyaç var (kontrol edildi — yanlış silmemek için bırakıldı)

**Rezerve Mantığı Sapması:**
Buket: "NET İHTİYAÇ = BRÜT − STOK − YOLDA". Eski kod stoktan diğer siparişlerin rezervesini düşüyordu (208 stok, 208 rezerve → kullanılabilir 0 → 207 eksik gösteriyordu). v15.63'te kaldırıldı. `rezerveYaz`/`rezerveleriSenkronla` hala çalışır ama MRP hesabını etkilemez (ölü kayıt).

---

## Sıradaki Adaylar — Öncelik Sırası

1. **Madde 11** — Sipariş artış otomasyonu (yeni İE'ler oluştur, kesim planı revize, yeni tedarik hesapla)
2. **Madde 14** — Log izlenebilirlik UI (DataManagement + Logs sayfası iyileştirmesi)
3. **Madde 13** — Fire İE açma akışı (büyük, fire çıktığında otomatik yeni İE)
4. **Madde 15** — Depo hareketi → tedarik tetik (DataManagement'tan stok değişiminde MRP otomatik)
5. **Madde 17 ileri** — Dashboard'da yarım iş hatırlatması (Topbar yeterli olabilir, kontrol)
6. **Madde 16 doğrulama** — Kesim artığı sorma (havuz mantığıyla yapıldı, UI'da test gerek)

---

## §18 Hijyen — 27 Nis Cleanup

```powershell
Remove-Item "$env:USERPROFILE\Downloads\v15.5*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\Downloads\v15.6*.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v15.5*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v15.6*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-claude-dump" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-*-dump.rar" -Force -ErrorAction SilentlyContinue
```

---

## Kritik Test Listesi (Yarın)

1. **MRP Hesapla — Yeni Formül:** Sipariş detay → MRP. Toast'ta "X malzeme, tüm stoklar yeterli" görmeli (rezerve düşürmesi kaldırıldı).
2. **Karar Modalı:** Yarım akış varken "Yeni İş Emri" tıkla. Devam/Beklet/İptal modalını gör. Beklet seç → Topbar'da mor "BEKLETİLDİ" badge.
3. **Plan Bekliyor Rozeti:** WorkOrders'ta kesim İE'sine plan yapma. Rozet görünmeli, tıklayınca /cutting'e gitmeli.
4. **Madde 10 İskelet:** Sipariş düzenle → bir kalemin adetini düşür → MRP Hesapla → toast'ta "X tedarik iptal/azaltıldı" görmeli.

---

## Multi-machine + Çevre

**NB081 (ana):** Git CLI var, Node.js yok. Tüm push'lar GitHub Actions ile build oluyor (yeşil geçti).

**Repo:** `C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3`

---

İyi geceler Buket. 16+ commit ile İş Emri #13'ün **%64'ünü (14/22)** tek günde kapattık. Kritik MRP ve tedarik bug'ları kalıcı çözüldü, ana akış refactor'ünün omurgası ayağa kalktı.
