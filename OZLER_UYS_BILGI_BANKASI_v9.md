# ÖZLER UYS v3 — BİLGİ BANKASI v9
**Son güncelleme:** 2026-04-12

## Proje
- **Repo:** https://github.com/uzuniskender/ozler-uys-v3
- **URL:** https://uzuniskender.github.io/ozler-uys-v3/
- **Operatör URL:** https://uzuniskender.github.io/ozler-uys-v3/#/operator
- **Stack:** React 19 + Vite + TS + Tailwind v4 + Zustand + Supabase + Recharts + Sonner
- **Supabase:** kudpuqqxxkhuxhhxqbjw (Frankfurt)
- **Dosya:** 44 TS/TSX, ~7.900 satır, 21 sayfa
- **Build:** `tsc --noEmit && vite build`

## Kimlik Doğrulama (3 Rol)
- **admin** → Tam yetki (kullanıcı adı + şifre)
- **operator** → Üretim girişi yetkili (bölüm + operatör + şifre)
- **guest** → Salt okunur (misafir modu)

## Operatör Paneli (v3)
- Login sayfasından "🏭 Operatör Girişi" → Bölüm → Operatör → Şifre
- Sidebar yok — tam ekran, tablet/kiosk uyumlu
- 3 tab: İşlerim / Mesajlar / Özet
- İE kartına tıkla → Üretim kayıt modal
- Modal: Başlama/bitiş saati, adet, fire, duruş, açıklama
- Validasyonlar: hedef aşılamaz, stok kontrolü, duruş < çalışma süresi
- HM stok çıkışı otomatik (reçeteden)
- Özet tab: günlük üretim/fire/duruş toplam + kayıt listesi

## MultiCheckDropdown Uygulanan Filtreler
İş Emirleri (Durum), Malzemeler (Tip), Depo (Tip), Operatörler (Bölüm), Checklist (Tip+Durum)

## Malzeme Tipi Hiyerarşisi
- Tip: Hammadde / Yarı Mamul / Mamul / Sarf
- Hammadde Alt Tipi: Boru / Profil / Levha / Sac / Çubuk / Lama / Diğer

## Excel Export (13 sayfa)
Siparişler, İE, Malzemeler, Depo, Tedarik, Reçeteler, Duruş Kodları, Operatörler, Operasyonlar, İstasyonlar, Tedarikçiler, Checklist, MRP

## Sıfırlama
Sipariş / İE / Depo / Tedarik ayrı ayrı + Fabrika tam sıfırlama

## Pending
- #12 Duruş kodları listesi (kullanıcıdan bekleniyor)
- Çoklu operatör (aynı işe 2. kişi ekleme)
