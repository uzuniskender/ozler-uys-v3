# ÖZLER UYS v3 — BİLGİ BANKASI v7
**Son güncelleme:** 2026-04-12

## Proje
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Stack:** React 19 + Vite + TS + Tailwind v4 + Zustand + Supabase + Recharts + Sonner
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Dosya:** 43 TS/TSX, 7.413 satır, 21 sayfa, 12 rapor, 6 modül

## Bu Oturumda Yapılan Tüm İyileştirmeler

### v2→v3 Fark Kapatma (tamamlandı)
- İptal → ters stok hareketi + neden zorunlu
- Silme → üretim varsa engelle
- Beklemede durumu (6 durum + checkbox)
- Durum butonları duruma göre değişir
- Reçete zinciri (önceki/sonraki adım + kesim planı)
- Üretim girişi bölüm wizard
- Detaylı stokKontrolWO (HM bazlı + max yapılabilir)
- BOM ağaç görünüm + reçete oluştur + kesim hesapla
- Çoklu operatör (başlama/bitiş saati)
- Fazla üretim onayı
- Log düzenleme/silme
- Mesaj okundu/sil + chat cevaplama
- Tedarik önerileri (min stok)
- Stok hareketi düzenleme/silme
- Müşteri geçmişi filtresi
- Toplu stok girişi + Excel import/export
- 12 rapor sekmesi (Recharts)
- Dashboard günlük üretim grafiği

### Kullanıcı İstekleri (12 madde)
1. ✅ %100 → otomatik Tamamlandı + Durumları Güncelle butonu
2. ✅ Gruplama: Sipariş/Operasyon/Ürün
3. ✅ Dropdown/checkbox UI standardı
4. ✅ Depo malzeme tipi filtre dropdown
5. ✅ Kesim önerileri (planlanmamış İE listesi)
6. ✅ Reçetede kesim hesabı butonu
7. ✅ Malzeme kartlarında çap + kalınlık
8. ✅ Operatör mesaj chat (cevapla + geçmiş)
9. ✅ MRP iyileştirme (durum/excel/tek satır tedarik)
10. ✅ Üretim girişi yeşil/kırmızı renk
11. ✅ Test ortamı (🧪 toggle + sarı banner)
12. ⏳ Duruş kodları listesi (kullanıcıdan bekleniyor)

### Ek İyileştirmeler
- Operasyon sayfasında bölüm alanı
- Sipariş kapatma/açma (🔒/🔓 toggle + filtre)
- İE tahmini bitiş tarihi (günlük ortalamadan hesaplama)
- Seçmeli sıfırlama (Sipariş/İE/Depo/Tedarik ayrı ayrı)
- Admin şifre ayarlama (silme koruması)
- Yedek uyarı sistemi (7+ gün)
- showPrompt/showConfirm/showAlert/requirePassword (0 tarayıcı dialogu)
