# UYS v3 — DEVAM NOTU
**Tarih:** 11 Mayıs 2026
**Versiyon:** v16.66
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
- v16.60 — stokTuketimIsle mpm çarpanı + MRP mrp_durum mantığı (tek malzeme = tüm sipariş tamam hatası)
- v16.61 — order.state tek kaynak — Dashboard + DataManagement durum→state geçişi
- v16.62 — stok yuvarlama Math.floor standardizasyonu
- v16.63 — station mapper durum+arizaNot, operator mapper durum
- v16.64 — acikBarlar store+realtime eklendi (K6 crash düzeltildi), Shipment deterministic stok ID (Y6)
- v16.65 — Izin/Bildirim/PendingFlow typed mappers, CuttingRow havuzBarId, StokHareket bar_acilis tip, mamulRezerv as any kaldırıldı
- v16.66 — barAcilisSet + validations.ts as any temizlendi

## Bekleyen

- (temiz — kritik açık kalmadı)

## Sıradaki görevler

1. Operatör mesajları paneli
2. Stok anomali raporu
3. Normalize veri geçişi
4. Y1 — mrp_durum race condition (tasarım sorunu, düşük öncelik)
5. O1 — Stok insert format tutarsızlığı (kısmen çözüldü, kalan by-design)

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
