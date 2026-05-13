# UYS v3 — DEVAM NOTU
**Tarih:** 13 Mayıs 2026
**Versiyon:** v16.76
**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito | **TEST:** cowgxwmhlogmswatbltz (Frankfurt)

---

## Bu oturumda tamamlananlar

- v16.74 — Stok girişinde mrp_state_order + mrp_durum otomatik invalidate (2 DB trigger)
- v16.75 — MRP badge sadece gerçek eksik sayar (isOrderMrpPending false positive giderildi)
- v16.76 — Production build console ve debugger drop (vite.config.ts esbuild.drop)

## Güvenlik oturumu tamamlananlar

- uys_dev_files + uys_session_memory → RLS aktif, sadece uzuniskender@gmail.com erişebilir
- uys_dev_files fazla kaydı temizlendi (.github/scripts/devsync.js silindi, 172/172 eşitlendi)
- Supabase MCP bağlantısı oturum sonunda kapatılıyor (Buket manuel)
- GitHub 2FA ✅ | Supabase 2FA ✅ | Windows otomatik kilit ✅

## Sıradaki görevler

1. Normalize veri geçişi (kapsam belirsiz — ertelendi)

---

## DevSync — iş akışı

- Oturum başında DEVAM_NOTU.md upload gerekmez — Claude Supabase den okur
- Değişiklik sonrası: DevSync → Claude Değişiklikleri → İndir → git push
- DevSync URL: /#/dev-sync

---

## Kritik kurallar

- Buket oturum kapatır — Claude önerme
- Supabase değişiklikleri MCP tools ile — PowerShell SQL talimatı verme
- TEST önce, PROD sonra (onay alarak)
- Şifreler konuşmada gösterilmez
- Multi-machine: ana makine iskender.uzun, tali Iskender
- npm PATH: C:\\Users\\iskender.uzun\\nodejs\\
- Pre-push hook: .git/hooks/pre-push.cmd formatında
- Sandbox build (npm ci + npm run build) zorunlu — patch zip den önce
- Tek takip dosyası: docs/DEVAM_NOTU.md — her oturum başında Claude Supabase den okur
- DevSync aktif: Claude repo dosyalarını Supabase den okur (uys_dev_files tablosu)
- Supabase MCP bağlantısı: geliştirme oturumu başında aç, bitince kapat
