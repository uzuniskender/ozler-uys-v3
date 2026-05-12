# UYS v3 — DEVAM NOTU
**Tarih:** 11 Mayıs 2026
**Versiyon:** v16.70
**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito | **TEST:** cowgxwmhlogmswatbltz (Frankfurt)

---

## Bu oturumda tamamlananlar

- v16.54 — ActiveWorkPanel veri kaynağı (EntryModal açılışında active_work yazar, kapanışında siler)
- v16.55 — Kesim planı birleştirme (checkbox + ⊕ Birleştir butonu)
- v16.56 — MRP ghost talep filtresi — tüm WO'ları biten siparişler demand'den çıkarıldı
- v16.57 — store mapper: order.state + sevkDurum eklendi
- v16.58 — fetchAll ORDER BY fix (bar_acilis pagination tutarsızlığı)
- v16.59 — Denetim: rezervOrderId, TABLE_MAP izinler/bildirimler/pendingFlows, fireLog tip/uzunlukMm/telafiWoId, log saat, operatorNote kategori/oncelik, store_index.ts silindi
- v16.60 — stokTuketimIsle mpm çarpanı + MRP mrp_durum mantığı düzeltildi
- v16.61 — order.state tek kaynak — Dashboard + DataManagement durum→state geçişi
- v16.62 — stok yuvarlama Math.floor standardizasyonu
- v16.63 — station mapper durum+arizaNot, operator mapper durum
- v16.64 — acikBarlar store+realtime eklendi (K6 crash), Shipment deterministic stok ID
- v16.65 — Izin/Bildirim/PendingFlow typed mappers, CuttingRow havuzBarId, StokHareket bar_acilis tip, mamulRezerv as any kaldırıldı
- v16.66 — barAcilisSet + validations.ts as any temizlendi
- v16.67-68 — MRP selectAll ghost talep fix (tamamlanan siparişler tümünü seç'e dahil olmaz)
- v16.69 — MRP aktifOrders: canlı eksik mrpDurum tamam'ı override eder
- v16.70 — MRP rezervasyon sistemi:
  - Serbest stok = giriş - çıkış - rezerv (getStok güncellendi)
  - MRPRow'a rezerve alanı eklendi
  - Tablo: Brüt | Serbest Stok | Rezerve | Açık Ted. | Net kolonları
  - "Stoktan Ver" → "Rezerve Et" modal (miktar otomatik, düzenlenebilir)
  - Eksik + stok var → "Kısmi Rezerve" butonu
  - tip='rezerv' için PROD+TEST index eklendi
  - Üretim girişinde (stokTuketim.ts) o siparişin rezervleri otomatik silinir

---

## Sıradaki görevler

1. MRP Arşiv modal (detaylı filtreleme, tarihsel görünüm)
2. MRP Kümülatif / Sipariş Bazlı toggle
3. Operatör mesajları paneli (kapsam belirsiz — beklemede)
4. Stok anomali raporu (kapsam belirsiz — beklemede)
5. Normalize veri geçişi

---

## Kritik kurallar

- Buket oturum kapatır — Claude önerme
- Supabase değişiklikleri MCP tools ile — PowerShell SQL talimatı verme
- TEST önce, PROD sonra (onay alarak)
- Şifreler konuşmada gösterilmez
- Multi-machine: ana makine `iskender.uzun`, tali `Iskender`
- npm PATH: `C:\Users\iskender.uzun\nodejs\`
- Pre-push hook: `.git/hooks/pre-push.cmd` formatında
- Sandbox build (npm ci + npm run build) zorunlu — patch zip'ten önce
- Tek takip dosyası: `docs/DEVAM_NOTU.md` — her oturum başında upload et
