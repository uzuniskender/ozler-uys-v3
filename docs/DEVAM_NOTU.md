# UYS v3 — DEVAM NOTU
**Tarih:** 10 Mayıs 2026
**Versiyon:** v16.53
**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito | **TEST:** cowgxwmhlogmswatbltz (Frankfurt)

---

## Bu oturumda tamamlananlar

- Audit log görüntüleme sayfası (`AuditLog.tsx`) — Admin only, filtreli, sayfalı
- İstek #18 — fire uyarısı belirginleştirildi, 10sn warning + Reports'a yönlendirme butonu
- İstek #19 — MRP stoktan ver butonu (yeterli satırlarda stok çıkışı yazar)
- Levha kesim artıkları stoka gir (`CuttingPlans.tsx` — idempotent)
- Sevkiyat planlandı/gerçekleşti (`durum` kolonu eklendi, UI güncellendi)
- activeWork canlı takip paneli (`ActiveWorkPanel.tsx` + Sidebar + App.tsx)
- Pre-push hook — npm PATH fix (.cmd formatı)
- Realtime sync fix — `reloadTables` store'a eklendi, `TABLE_MAP` export edildi
- Audit schema whitelist güncellendi (8 tablo eklendi)

## Kontrol edilen — zaten tamamlanmış

- İşlem süresi reçeteye — `islemSure` zaten var (Recipes.tsx + autoChain.ts)
- Toplu sipariş Excel import — zaten çalışıyor (Orders.tsx)

## Sıradaki görevler

1. Kesim planı birleştirme
2. Normalize veri geçişi
3. Operatör mesajları paneli
4. SR #11 havuz adaptasyonu
5. Stok anomali raporu

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
