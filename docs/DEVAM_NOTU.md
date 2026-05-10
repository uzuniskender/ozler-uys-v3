# UYS v3 — DEVAM NOTU
**Tarih:** 10 Mayıs 2026
**Versiyon:** v16.54
**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito | **TEST:** cowgxwmhlogmswatbltz (Frankfurt)

---

## Bu oturumda tamamlananlar

- Siyah ekran / runtime crash serisi çözüldü:
  - `Sidebar.tsx` → `Monitor` import eksikti; `store.problemler` ve `store.testRuns` undefined idi (|| [] guard eklendi)
  - `Dashboard.tsx` → `izinler` store'da yoktu (|| [] guard eklendi)
  - `InactiveOperatorsCard.tsx` → `for...of izinler` undefined idi (|| [] guard eklendi)
  - `Topbar.tsx` → `bildirimler` ve `pendingFlows` store'da yoktu (|| [] guard eklendi)
  - `src/store/index.ts` → `izinler`, `bildirimler`, `pendingFlows` interface + initial state'e eklendi

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
