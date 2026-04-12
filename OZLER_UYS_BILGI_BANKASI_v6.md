# ÖZLER UYS v3 — BİLGİ BANKASI v6
**Son güncelleme:** 2026-04-12

## Proje Bilgileri
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Zustand + Supabase + Recharts + Sonner
- **Deploy:** GitHub Pages + GitHub Actions
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)

## İstatistikler
- 55 dosya (39 TS/TSX + tsconfig + 2 yeni modül + prompt.ts)
- 21 sayfa, 12 rapor sekmesi, 6 iş mantığı modülü

## Yeni Dosyalar (bu oturumda eklenen)
- `src/lib/prompt.ts` — showPrompt, showMultiPrompt, showConfirm, showAlert (tarayıcı dialogları yerine uygulama içi modal)
- `src/features/production/stokKontrol.ts` — detaylı HM bazlı stok kontrol (YETERLI/KISMI/YOK/BEKLIYOR + max yapılabilir adet)
- `tsconfig.app.json` — erasableSyntaxOnly kaldırıldı

## v2 → v3 Kapatılan Tüm Farklar

### İE Kuralları
- İptal → ters stok hareketi (mamul çıkış + HM iade + neden zorunlu)
- Silme → sadece üretim yoksa (varsa "İptal Et kullanın" uyarısı)
- Beklemede durumu (6 durum + checkbox filtre)
- Durum butonları duruma göre değişir (Devam Et/Beklet/Tamamla/Sil/İptal Et)
- Tamamlanma tarihi otomatik kaydedilir
- Fire İE önerisi (fire girişinde telafi İE oluşturma)

### İE Detay
- Reçete zinciri (önceki adım/HM direkt girdi/sonraki adım)
- Kesim planı bilgisi (kesim operasyonlarında)
- Detaylı stok kontrol paneli (HM bazında gerekli/mevcut/açık ted./durum tablosu)
- Max yapılabilir adet gösterimi
- Stok kontrol badge (●yeşil/●sarı+max/●kırmızı)
- Log düzenleme (multi-input modal) ve silme
- Hedef güncelleme (modal)
- Operatör atama (dropdown)

### Üretim Girişi
- Bölüm seç → İE listesi (adımlı wizard, v2 gibi)
- Çoklu operatör (+ Ekle, başlama/bitiş saati)
- Fazla üretim onayı
- Duruş girişi

### Sipariş
- CRUD, kopyala, çoklu ürün, Excel import/export
- Toplu MRP, önceliklendirme
- Sipariş detayında autoZincir + Eksik İE Tamamla + MRP
- Müşteri geçmişi (tıkla → filtrele)

### Stok / Depo
- Manuel giriş/çıkış, toplu giriş (modal), Excel import/export
- Stok sayım, stok onarım
- Stok hareketi düzenleme/silme (modal)
- Tedarik önerileri (min stok altından tek tıkla)

### BOM / Reçete
- Ağaç editör + tree view toggle
- BOM → reçete oluşturma (mevcut varsa güncelle)
- BOM → kesim hesaplama

### Raporlar (12 sekme)
Özet, Günlük, Fire, Operasyon, OEE, Duruş, Gecikme, Operatör Perf., Malzeme Tüketim, Trend, İstasyon Perf., Operatör Saat

### Dashboard
- Günlük üretim grafiği (son 7 gün bar chart)
- Min stok uyarı + tedarik önerisi butonu
- Mesaj okundu/sil
- Aktif çalışmalar, termin uyarıları

### UI Modaller (tarayıcı dialogu yok)
- showPrompt → tek input modal
- showMultiPrompt → çoklu input modal
- showConfirm → onay modal
- showAlert → bilgi modal
- 30+ confirm() ve 12+ prompt() tamamı çevrildi

### Diğer
- Checklist + resim yükleme (Supabase Storage)
- SearchSelect bileşeni (müşteri, malzeme, tedarikçi)
- JSON yedek/geri yükleme, sistem testi, fabrika sıfırlama
- Misafir modu, şifre değiştir
- Barkod okuyucu, toplu İE güncelleme

## Kalan Minor Farklar
- Operatör panelinde otomatik bölüm/operatör seçimi (operatör girişinde)
- Yedek uyarı sistemi (checkYedekUyari)
- Şifre korumalı silme (admin şifresi ayarlanmışsa)
- Duruş kodları Excel import/export
