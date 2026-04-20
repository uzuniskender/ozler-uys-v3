# ÖZLER UYS v3 — BİLGİ BANKASI v15.16.2
**Son güncelleme:** 19 Nisan 2026 (gece geç — Chat bildirim sistemi canlıda)

---

## 1. Canlı Sistem Bilgileri

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase (canlı)** | `lmhcobrgrnvtprvmcito` (Frankfurt) |
| **Supabase (test)** | `cowgxwmhlogmswatbltz` (Frankfurt) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Son sürüm** | **v15.16.2 — Chat bildirim sistemi (unread badge + ses + browser notification)** |
| **Son commit** | `0c301f6` (feat chat notifications) |
| **Son tag** | `v15.16.2` |
| **Yedek repo** | https://github.com/uzuniskender/ozler-uys-backup (private, her gece TR 06:00) |
| **Yedek branch** | `backup-v15-16-local` (v15.16 force push öncesi local snapshot) |
| **Toplam DB tablo** | 33 canlı (27 test — `uys_kullanicilar` test'te yok) |

---

## 2a. v15.16.2 — Chat Bildirim Sistemi (19 Nisan gece geç)

### Problem
v15.16'da ÖzlerMsg canlıya çıktı ama **kimse mesaj geldiğini göremiyordu**. Kullanıcı aktif olarak Chat sayfasını açıp bakmadıkça mesajdan haberi olmuyordu — sistem fiilen kullanılamıyordu.

### Çözüm: Üç katmanlı bildirim
1. **Görsel**: Topbar'da MessageCircle ikonu + kırmızı unread badge (realtime)
2. **Görsel 2**: Sidebar'da "Ekip Sohbet" menü öğesi yanında aynı badge (tek kaynaktan okunur)
3. **İşitsel**: Çift beep (520Hz + 720Hz) — operatör mesaj sesinden ayırt edici
4. **Bildirim**: Browser notification (sayfa gizliyken veya chat dışındayken)

### Mimari kararları
- **Tek realtime subscription**: `useChatNotifications` hook'u sadece **Topbar**'da çağrılır. Topbar her authenticated sayfada render olur, tek instance çalışır → çift ses/notif riski sıfır.
- **Ortak state (Zustand)**: Unread count `useChatNotifStore`'da tutulur, Topbar + Sidebar ayrı ayrı okur. Tek kaynak, tek doğruluk. DB store'undan **bağımsız** → audit'e girmez.
- **Polling fallback (15 sn)**: `markChannelRead` DB'de unread azaltır ama realtime increment'i geri almaz → 15 sn polling ile sync.
- **Ses tercihi paylaşımı**: `isSoundEnabled()` `useMessageNotifications.ts`'ten import edilir → hem operatör mesajları hem chat için tek ayar.
- **Ayırt edici ses**: Operatör (880Hz tek/3'lü) ile chat (520+720Hz çift) farklı — kullanıcı sesi duyunca hangi sistem olduğunu bilir.
- **Notification izni akışı**: Chat.tsx sol sidebar'da bir **"🔔 Bildirimleri aç"** banner (sadece izin `default` iken). Tıklanınca `Notification.requestPermission()`. Verince/reddedince banner kaybolur.

### Etkilenen dosyalar
- `src/hooks/useChatNotifications.ts` (YENİ — 165 satır)
- `src/components/layout/Topbar.tsx` (hook çağrı + icon + badge)
- `src/components/layout/Sidebar.tsx` (menü item'a store'dan badge)
- `src/pages/Chat.tsx` (izin banner — 4 nokta eklendi)

### Chat Notification Davranışı Detayları
- `subscribeToAllUserMessages` zaten `chatService.ts`'te vardı — v15.16.2'de kullanıldı
- Kendi gönderdiğin mesaj → **sessiz** (user_id === currentUserId kontrolü)
- Chat sayfası açık + görünür → notification gösterilmez (kullanıcı zaten burada)
- Chat sayfası dışında / sekme gizli → notification çıkar
- Notification tıklanınca → window.focus + hash `#/chat`

### Commit / Tag
- Commit: `0c301f6` — `feat(chat): v15.16.2 unread badge + ses + browser notification`
- Tag: `v15.16.2`
- Branch `feat/chat-notifications` → `main`'e fast-forward merge, local+remote temizlendi

---

## 2b. v15.16.1 — Chat Profili Bulunamadı Fix

### Problem
ÖzlerMsg canlıya çıktıktan sonra bazı kullanıcılarda (özellikle Planlama) Chat sayfası açılınca **"Chat profili bulunamadı (username)"** hatası.

### Kök neden
İki aşamalı string eşleştirme: `signIn` DB'de kullanıcıyı `kullanici_ad` ile bulup `authUser.username = k.ad` set ediyor → `useChatUser` bu `username`'i alıp DB'de tekrar arıyor. Whitespace/case farkları bu zinciri kırabiliyordu.

### Fix
- `AuthUser` interface'ine `dbId?: string` eklendi
- `signIn` authUser oluştururken `dbId: k.id` set ediyor
- `useChatUser` önceliği: `user.dbId` (direkt id lookup) > `kullanici_ad` fallback > `ad` fallback
- Hata mesajı artık username + dbId ikisini de gösteriyor

### Etkilenen dosyalar
- `src/hooks/useAuth.ts`
- `src/features/chat/useChatUser.ts`

### Commit / Tag
- Commit: `6752d09` — `fix(chat): useChatUser dbId oncelikli`
- Tag: `v15.16.1`

### Kenar bulgular
- **VS Code ilk kez kuruldu** (bu repo için)
- **`.env.local` eksikti** — yeniden oluşturuldu (BOM'suz UTF-8). Vite `.env.local` yoksa sessizce `supabaseUrl is required` fırlatıyor.

---

## 2c. v15.16 — Kurumsal Mesajlaşma (ÖzlerMsg v1)

### DB — 6 yeni tablo
- `uys_chat_channels` (id, name, type[dm|group], description, created_by, archived_at, created_at)
- `uys_chat_members` (channel_id, user_id, role[owner|admin|member], muted, last_read_at, joined_at)
- `uys_chat_messages` (id, channel_id, user_id, body, reply_to_id, edited_at, deleted_at, created_at)
- `uys_chat_mentions` (message_id, user_id, read_at)
- `uys_chat_reactions` (message_id, user_id, emoji, created_at)
- `uys_chat_attachments` (id, message_id, storage_path, mime_type, file_name, size_bytes, created_at)

**Önemli notlar:**
- Canlıda FK'ler var (`uys_kullanicilar.id` → text). Test'te FK yok.
- 5 tablo Realtime publication'a ekli (`attachments` hariç).
- RLS allow_all pattern.

### Kod — 5 yeni + 5 değiştirilmiş dosya
Yeni:
- `sql/uys_chat_v1.sql`
- `src/features/chat/types.ts`, `chatService.ts`, `useChatUser.ts`
- `src/pages/Chat.tsx`

Değiştirilmiş:
- `src/App.tsx`, `Sidebar.tsx`, `DataManagement.tsx`
- `scripts/audit-columns.cjs`, `audit-schema.cjs`

### Commit / Tag
- Commit: `41c4a23` — `v15.16 OzlerMsg v1`
- Backup branch: `backup-v15-16-local` (force push öncesi snapshot)

### Kritik Bug Fix'ler (v15.16 sırasında)
1. **audit-columns.cjs parsing bug**: `indexOf('supabase.from', ...)` newline tolere etmiyordu → düzeltildi.
2. **`.env.local` eski Supabase URL**: GitHub Secrets güncel ama `.env.local` değildi → yeni URL + anon key.
3. **`.env.local` git tracking**: Gitignore'da olmasına rağmen eskiden takipteydi → `git rm --cached .env.local`.
4. **Force push**: Paralel Claude chat'i 4 commit push etmişti → yedek branch + force push.

---

## 3. Önceki Sürümler Özeti (v14 → v15.15)

| Sürüm | Tarih | Ne yapıldı |
|---|---|---|
| v14 | 17 Nis | **Kritik bug**: İş Emirleri durumu pct'ten türetiliyordu (fire dahil değildi). `wKapasite` helper + DB durumu öncelik. |
| v15.0 | 17 Nis akşam | **Sipariş sevk durumu**, **Yardım + Ekip Notları** topbar, **MaterialSearchModal**. |
| `/test` | 17 Nis | 12 adımlı smoke test (TEST-SMOKE-* izole). Sadece DB — UI yakalamaz. |
| **Supabase değişimi** | 17 Nis akşam | Eski `kudpuqqxxkhuxhhxqbjw` silindi. Yeni: `lmhcobrgrnvtprvmcito`. JSON restore + GitHub Secrets + `camelToSnake` converter. |
| v15.8 | 18 Nis | **Problem Takip** sayfası. Paralel Günaydın chat'ten merge (9 dosya). |
| v15.9 | 18 Nis | **stokKontrol fix**: ⛔ YOK badge sessizce OK dönüyordu. `dogrudanAltBilesenler` 3 katmanlı. |
| v15.10 | 18 Nis | **stokKontrol Fix 3**: Altları boş İE'lerde kendi stok + açık tedarik kontrolü. |
| v15.11–v15.13 | 18 Nis | **Operatör mesaj genişletme**: kategori/öncelik, Web Audio beep, browser notification. DataManagement 6 eksik tablo. |
| **Supabase yedeği** | 18 Nis | `ozler-uys-backup` private repo, GitHub Actions TR 06:00 nightly `supabase db dump`. |
| v15.14 | 18 Nis akşam | **Audit altyapısı**: schema + columns scriptleri, prebuild hook. `uys_yetki_ayarlari.data` eksikti → jsonb eklendi. |
| v15.15 | 18 Nis gece | **Playwright E2E canlıda**: 9/9 yeşil. PostgREST cache için ALTER ADD/DROP hilesi. |
| **v15.16** | 19 Nis gece | **ÖzlerMsg v1** — 11 dosya, 6 yeni tablo, DM + Grup + Realtime. |
| **v15.16.1** | 19 Nis gece geç | **Chat profili dbId fix** — string eşleştirme bağımlılığı kaldırıldı. |
| **v15.16.2** | 19 Nis gece geç | **Chat bildirim sistemi** — unread badge + ses + browser notification. |

---

## 4. Test Çalıştırma

### Dev server
```powershell
cd $env:USERPROFILE\Documents\ozler-uys-v3
npm run dev
# → http://localhost:5173/
```

### E2E (Playwright)
```powershell
npm run test:e2e
# 9 test, ~3 dakika
```

### Audit (deploy öncesi otomatik)
```powershell
npm run audit           # schema audit
npm run audit:columns   # silent reject önleme
npm run build           # prebuild hook iki audit'i otomatik
```

### Env dosyaları
- `.env.local` — canlı dev için (gitignore'da, **manuel oluşturulmalı**)
  ```
  VITE_SUPABASE_URL=https://lmhcobrgrnvtprvmcito.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_aVJ0v2zKTH4DzchuU2oEbw_YIFQs9YD
  ```
  **Dikkat:** PowerShell'de `Set-Content -Encoding UTF8` BOM ekliyor, Vite bozuk okuyabilir. Güvenli yol:
  ```powershell
  $c = "VITE_SUPABASE_URL=https://lmhcobrgrnvtprvmcito.supabase.co`r`nVITE_SUPABASE_ANON_KEY=sb_publishable_aVJ0v2zKTH4DzchuU2oEbw_YIFQs9YD`r`n"
  [System.IO.File]::WriteAllText("$PWD\.env.local", $c, [System.Text.UTF8Encoding]::new($false))
  ```

- `.env.test` — E2E için (gitignore'da)
  ```
  VITE_SUPABASE_URL=https://cowgxwmhlogmswatbltz.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_FjR4U_hFyETtZSd-JYBDRA_e6aO9lTj
  ```

---

## 5. Kritik Bilgiler

### Silent Reject Önleme (v15.14'ten beri)
- Yeni kolon kullanmadan önce `npm run audit:columns` veya information_schema.columns doğrula
- `npm run build` prebuild hook iki audit'i otomatik çalıştırır

### Test vs Canlı Supabase Şema Kayması
- **Canlı** `lmhcobrgrnvtprvmcito` — 33 tablo
- **Test** `cowgxwmhlogmswatbltz` — 27 tablo (**`uys_kullanicilar` YOK**)
- Chat tabloları test Supabase'de FK'siz
- TODO: Test/canlı şema senkronu

### PostgREST Schema Cache
- `NOTIFY pgrst, 'reload schema';` bazen yetmez
- En güvenilir: `ALTER TABLE ... ADD COLUMN x; ALTER TABLE ... DROP COLUMN x;` (dummy)
- Veya Supabase Dashboard → Settings → API → Restart

### Backup/Restore
- JSON export/import: 33/33 tablo dahil
- Otomatik GitHub Actions yedeği: TR 06:00, ozler-uys-backup repo

### Realtime
- `supabase_realtime` publication 26 + chat 5 = 31 tablo dinleniyor
- Chat: `subscribeToChannelMessages` (tek kanal) + `subscribeToAllUserMessages` (tüm)
- **v15.16.2'de `subscribeToAllUserMessages` Topbar'da kullanıldı**

### Stok Kontrol Kuralı (v15.1, v15.9+v15.10 ile stabilize)
> "Üretilecek ürünün alt kırılımında hammadde/yarı mamul yoksa STOK YOK uyarısı. A3 için A2, A1 veya A'dan herhangi biri stokta varsa yeterli."
- Recursive BOM traversal (`stokKontrol.ts`)
- Altları boş İE'ler için de kendi stok + açık tedarik

### Chat authUser dbId Akışı (v15.16.1+)
- `signIn` → `authUser.dbId = k.id`
- `useChatUser` önce `user.dbId` ile direkt lookup
- Gelecek özellikler (mention/thread/reaction) için de temel

### Chat Bildirim Akışı (v15.16.2+)
- `useChatNotifications` Topbar'da **tek** çağrılır (çift subscription riski yok)
- `useChatNotifStore` (Zustand) — Topbar + Sidebar tek kaynaktan okur
- Yeni mesaj → `incrementUnread()` + beep + notification (koşullu)
- Chat sayfasında kanal okundu → 15 sn içinde polling DB'den günceller
- Ses ayarı: `uys_msg_sound_enabled` (operatör + chat paylaşır)

---

## 6. Pending İşler

### 🟡 ÖzlerMsg Etap 2 (Kurumsal genişletmeler — tablolar hazır)
| Özellik | Durum | Not |
|---|---|---|
| Thread/reply | Tablo ✅ `reply_to_id` | UI bekleniyor |
| @mention | Tablo ✅ `uys_chat_mentions` | UI + notification bekleniyor |
| Mesaj arama | ❌ | Full-text, muhtemelen Postgres tsvector |
| Dosya eklentisi | Tablo ✅ `uys_chat_attachments` | Supabase Storage kurulumu gerekli |
| Online/offline (presence) | ❌ | Supabase Realtime presence API |
| Emoji reaction | Tablo ✅ `uys_chat_reactions` | UI bekleniyor |

**Öncelik önerisi**: 1 hafta gözlem sonrası kesinleşir. Muhtemel ilk talep **@mention + arama**.

### 🔴 Önceki chat'lerden devreden
- **Kayıp veriler** — izinler (0), notes (1), checklist (0). Kapsam tespit şart.
- **Google OAuth** — yeni Supabase'de provider enable değil.
- **RLS güvenlik** — allow_all → authenticated (uzun dönem, Supabase Auth entegrasyonu)

### 📋 Audit genişletmeleri (önleyici)
- Permissions vs sayfalar
- Types vs DB kolonları
- Sidebar vs App.tsx route'ları
- Test vs Canlı Supabase şema senkronu

### 🔒 İş tarafı uzun dönem (UYS dışı)
Libya doc paketi, Compaco 8D, CBAM portal, GFB, İSG TL-ISG-017, NETBIS

---

## 7. Yeni Chat İçin Giriş

**Yüklenecek dosyalar:**
1. `OZLER_UYS_BILGI_BANKASI_v15_16_2.md` (bu dosya)
2. Güncel repo snapshot zip'i (opsiyonel — `git clone` da yeterli)

**İlk mesaj önerisi:**
> "v15.16.2 canlıda — ÖzlerMsg v1 + dbId fix + bildirim sistemi (unread badge + ses + browser notification) çalışıyor. Commit `0c301f6`, tag `v15.16.2`. Sıradaki iş: Etap 2 (mention/search/file/presence/thread/reaction) veya Google OAuth + RLS authenticated paketi. Etap 2 önceliği önerim: @mention + arama ilk talep olur."

**Hızlı komutlar:**
```powershell
cd $env:USERPROFILE\Documents\ozler-uys-v3   # HER YENİ PENCEREDE İLK KOMUT
npm run dev
npm run test:e2e
npm run audit
npm run build
git log --oneline -5
```

---

## 8. ÖzlerMsg v1 — Kod Referansı

### Dosya yapısı
```
sql/
└── uys_chat_v1.sql
src/
├── features/
│   └── chat/
│       ├── types.ts
│       ├── chatService.ts
│       └── useChatUser.ts
├── hooks/
│   └── useChatNotifications.ts    ← v15.16.2 (YENİ)
└── pages/
    └── Chat.tsx                   ← v15.16.2'de izin banner eklendi
```

### useChatNotifications.ts Yapısı
```typescript
// Zustand store — Topbar + Sidebar paylaşır
useChatNotifStore = { unreadCount, setUnreadCount, incrementUnread }

// Hook — SADECE Topbar'da çağrılır
useChatNotifications() {
  - İlk yükleme: getTotalUnreadCount() → setUnreadCount
  - 15sn interval: periyodik polling
  - subscribeToAllUserMessages → yeni mesaj → incrementUnread + beep + notification
  - Kendi mesajın sessiz
  - Unmount: cleanup
}

// Helper — Chat.tsx'te kanal okundu sonrası anında sync (opsiyonel)
refreshChatUnreadCount(userId)
```

### useChatUser.ts Mantığı (v15.16.1+)
1. `user.dbId` → direkt `id` ile lookup
2. Yoksa `kullanici_ad = user.username`
3. Yoksa `ad = user.username`
4. `aktif = true` her durumda
5. Hata: "Chat profili bulunamadı (username=X, dbId=Y)."

### useAuth.ts AuthUser Interface (v15.16.1+)
```typescript
interface AuthUser {
  role: UserRole
  username: string
  email?: string
  loginTime: string
  oprId?: string
  dbId?: string           // uys_kullanicilar.id
}
```

---

## 9. Çalışma Tarzı (User Tercihleri)

- Türkçe, özlü, **ADIM ADIM**
- Kullanıcı "tane tane" isteyince her komutu tek tek ver, çıktıyı bekle
- "Sen karar ver" → analitik karşılaştırma + net öneri + gerekçe
- Seçenekler mutually-exclusive
- Kritik adımlarda uyar, panik yapma
- **Şifreleri asla yazma**
- Yeni kolon kullanmadan önce audit / `information_schema.columns` doğrula
- JSON backup/restore: camelCase ↔ snake_case converter gerekli
- **Force push öncesi yedek branch aç**
- **`.env.local` asla commit etme** (gitignore'da)
- **1-2 dosya değişiklik için Claude hazır dosya versin** (drag-drop) — VS Code ağır editing için
- **Her yeni terminal penceresinde ilk komut**: `cd $env:USERPROFILE\Documents\ozler-uys-v3`

---

## 10. Araç Kullanımı

| İş | Araç |
|---|---|
| Kod commit + push | **Git CLI** (PowerShell) |
| Test çalıştırma | PowerShell |
| SQL çalıştırma | Supabase Dashboard |
| Kod düzenleme | **VS Code** |
| Günlük geliştirme | Git CLI + VS Code |

### VS Code Kısayolları (Windows)
- `Ctrl+P` → Dosya aç
- `Ctrl+G` → Satıra git
- `Ctrl+L` → Tüm satırı seç
- `Ctrl+S` → Kaydet
- `Ctrl+A` → Tüm içerik seç (dosya kopyalama için)
- `Ctrl+F5` → Tarayıcı hard refresh

### PowerShell İpuçları
- Her pencere fresh açılır → repo'ya geç: `cd $env:USERPROFILE\Documents\ozler-uys-v3`
- VS Code entegre terminali otomatik repo klasöründen açar (daha pratik)
- `Get-Process node | Stop-Process -Force` → kilitlenmiş dev server'ları temizler

### GitHub Desktop Bilinen Sorunu
Bazen `Untracked files` olarak yeni dosyaları tek dosya gibi gösterir. Git CLI kullan.

---

## 11. Ders Çıkarmalar

1. **FK tipi uyumsuzluğu**: `uys_kullanicilar.id` uuid değil text.
2. **Notepad "dosya oluşamaz"**: Uzantı `.txt` olarak kaydediliyor. Dosyayı indirilebilir servis et, Move-Item.
3. **Audit "Bilinmeyen tablo" sahte sorun**: `indexOf` whitespace tolere etmiyor — regex whitespace-tolerant olmalı.
4. **audit-schema.cjs fantom tablo**: SQL yorum satırlarındaki örnekler yakalanıyor → yorumda tablo örneği verme.
5. **`.env.local` Supabase URL**: Supabase değişiminde manuel güncelleme unutulur → deployment checklist'e eklendi.
6. **GitHub Desktop untracked**: Tek dosya gibi görünür → Git CLI kullan.
7. **Force push öncesi yedek branch**: `backup-vX-local` pattern, force-with-lease.
8. **Yeni kolon → önce audit**: `information_schema.columns` veya `npm run audit:columns`.
9. **PostgREST schema cache**: Dummy `ALTER TABLE ADD/DROP COLUMN` hilesi en güvenilir.
10. **String eşleştirmesi > id lookup**: Kullanıcı login olmuşsa DB id'sini biliyoruz → authUser'a koy. Chat'te işe yaradı, mention/reaction/thread için de temel.
11. **.env PowerShell UTF-8 BOM tuzağı**: `Set-Content -Encoding UTF8` BOM ekliyor → Vite bozuk okuyabilir. Güvenli yol: `[System.IO.File]::WriteAllText(path, text, [UTF8Encoding]::new($false))`.
12. **(YENİ - v15.16.2) Realtime hook'u tek yerde çağır**: `useChatNotifications` Topbar'da sabit render eden component'te tek instance. İki yerde çağrılırsa iki subscription, çift beep/notif. Kural: global bildirim hook'ları daima tek sabit mount noktasına.
13. **(YENİ - v15.16.2) Realtime ≠ kesin sync**: `subscribeToAllUserMessages` yeni mesajda increment yapar ama `markChannelRead` DB azalmasını realtime'dan duymaz — polling fallback (15 sn) şart. Realtime hızlı feedback, polling authoritative sync.
14. **(YENİ - v15.16.2) İzin isteme UX**: `Notification.requestPermission()` proaktif değil, kullanıcı aksiyonuyla çağrılmalı. Chat sayfasında banner + butona tıklama → `default` izinde görünür, karar verilince kaybolur. Agresif popup yerine user-triggered.
15. **(YENİ - v15.16.2) Ayırt edici ses patterns**: Aynı uygulamada iki ses sistemi varsa (operatör mesajları + chat) farklı frekans kombinasyonları kullan. Kullanıcı sesi duyunca hangi sistem olduğunu kafasında bilir. Operatör: 880Hz tek/3'lü. Chat: 520+720Hz çift.
