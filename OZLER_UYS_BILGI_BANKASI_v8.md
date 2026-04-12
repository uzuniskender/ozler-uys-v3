# ÖZLER UYS v3 — BİLGİ BANKASI v8
**Son güncelleme:** 2026-04-12

## Proje
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Stack:** React 19 + Vite + TS + Tailwind v4 + Zustand + Supabase + Recharts + Sonner
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Dosya:** 44 TS/TSX, ~7.600 satır, 21 sayfa, 12 rapor, 7 modül
- **Build:** `tsc --noEmit && vite build` (package.json değişti)

## Yeni Bileşenler
- `src/components/ui/MultiCheckDropdown.tsx` — Çoklu seçim checkbox açılır kutu ({value,label,color} destekli)
- `src/components/ui/SearchSelect.tsx` — Aranabilir açılır liste
- `src/lib/prompt.ts` — showPrompt, showMultiPrompt, showConfirm, showAlert, requirePassword
- `src/features/production/stokKontrol.ts` — Detaylı HM bazlı stok kontrol

## MultiCheckDropdown Uygulanan Sayfalar
- İş Emirleri → Durum filtresi (6 durum)
- Malzemeler → Tip filtresi
- Depo → Malzeme tipi filtresi
- Operatörler → Bölüm filtresi
- Checklist → Tip + Durum filtresi

## Excel Export Olan Sayfalar
Siparişler, İş Emirleri, Malzemeler, Depo, Tedarik, Reçeteler, Duruş Kodları, Operatörler, Operasyonlar, İstasyonlar, Tedarikçiler, Checklist, MRP raporu

## Malzeme Tipi Hiyerarşisi
- Malzeme Tipi: Hammadde / Yarı Mamul / Mamul / Sarf
- Hammadde Alt Tipi (sadece Hammadde seçilince): Boru / Profil / Levha / Sac / Çubuk / Lama / Diğer
- Çap (mm) alanı eklendi

## İE Kuralları (v2 uyumlu)
- İptal → ters stok hareketi + neden zorunlu + şifre korumalı
- Silme → üretim varsa engelle
- %100 → otomatik Tamamlandı + Durumları Güncelle butonu
- Beklemede durumu (6 durum)
- Durum butonları duruma göre değişir
- Reçete zinciri (önceki/sonraki adım + kesim planı)
- Detaylı stokKontrolWO (HM bazlı + max yapılabilir)
- Tahmini bitiş tarihi

## Üretim Girişi
- Bölüm wizard (adımlı seçim)
- Çoklu operatör (başlama/bitiş saati)
- Fazla üretim onayı
- Yeşil/kırmızı İE renklendirme

## Mesajlaşma
- Dashboard'da chat tarzı mesajlar + cevapla butonu
- OperatorPanel'de mesaj geçmişi + yönetim cevapları

## Diğer Özellikler
- Test ortamı toggle (sarı banner)
- Seçmeli sıfırlama (Sipariş/İE/Depo/Tedarik ayrı)
- Admin şifre koruması
- Yedek uyarı (7+ gün)
- Sipariş kapatma/açma (🔒/🔓)
- Kesim önerileri + reçetede kesim hesabı
- BOM ağaç görünüm + reçete oluştur
- Dashboard günlük üretim grafiği
- Sidebar akıllı badge (açık sipariş, aktif İE, okunmamış mesaj)
- 0 tarayıcı dialogu (prompt/confirm/alert → uygulama içi modal)
