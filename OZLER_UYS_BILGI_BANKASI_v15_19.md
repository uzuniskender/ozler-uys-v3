# ÖZLER UYS v3 — BİLGİ BANKASI v15.19
**Son güncelleme:** 20 Nisan 2026 (sabah — ÖzlerMsg Etap 2 tamamlandı: mention + arama + dosya)

---

## 1. Canlı Sistem Bilgileri

| | |
|---|---|
| **Repo** | https://github.com/uzuniskender/ozler-uys-v3 |
| **Canlı URL** | https://uzuniskender.github.io/ozler-uys-v3/ |
| **Supabase (canlı)** | `lmhcobrgrnvtprvmcito` (Frankfurt) |
| **Supabase (test)** | `cowgxwmhlogmswatbltz` (Frankfurt) |
| **Storage bucket** | `chat-attachments` (public, 10 MB limit, any MIME) |
| **Stack** | React 19 + Vite 8 + TypeScript + Tailwind v4 + Zustand + Supabase |
| **Son sürüm** | **v15.19 — ÖzlerMsg dosya eklentisi (Storage)** |
| **Son tag** | `v15.19` |
| **Yedek repo** | https://github.com/uzuniskender/ozler-uys-backup (private, her gece TR 06:00) |
| **Toplam DB tablo** | 33 canlı (27 test — `uys_kullanicilar` test'te yok) |

---

## 2. ÖzlerMsg Etap 2 — TAMAMLANDI (20 Nisan sabah)

Üç büyük sürüm arka arkaya canlıya alındı: mention + arama + dosya.

### 2a. v15.19 — Dosya Eklentisi (Storage)

**DB değişikliği:**
- `uys_chat_attachments` tablosu zaten vardı (v15.16), sadece `message_id` index + realtime publication eklendi
- Supabase Storage bucket `chat-attachments` oluşturuldu: **public**, **10 MB/dosya**, MIME filtresi yok
- 3 storage policy: read/insert/delete (allow_all pattern, mevcut sistemle uyumlu)

**chatService.ts genişlemesi:**
- `uploadAttachment(channelId, messageId, file)` — Storage upload + DB insert, hata durumunda storage temizliği
- `getMessageAttachments(messageIds[])` — çoklu mesaj için ekleri toplu çek
- `getAttachmentsForMessage(messageId)` — tek mesaj convenience
- `deleteAttachment(attachmentId)` — DB + Storage iki yönlü silme
- `isImageMime()`, `formatFileSize()` — helper'lar
- `ChatAttachmentView` interface (public_url dahil)
- Path pattern: `chat/<channel_id>/<message_id>/<timestamp>-<safe_filename>`
- `sanitizeFileName` — Türkçe karakterler ASCII'ye, özel karakterler `_`

**Chat.tsx UI:**
- Paperclip butonu (input soluna)
- Drag-drop overlay (main panel genelinde "Dosyaları bırakın")
- Pending dosya chip listesi (input üstü, X ile kaldırılabilir)
- Mesaj render'ında ekler:
  - **Görseller**: inline thumbnail max 256px yükseklik, tıkla → tam boyut yeni sekme
  - **Diğerleri**: dosya kartı (FileText ikon + ad + boyut + MIME + Download ikon)
- Limit aşımı alert'i (10 MB/dosya, 10 dosya/mesaj)
- Upload sırasında Gönder butonu Loader2 spinner'ı ve "Yükleniyor…" yazısı
- Boş mesaj + ek yüklendiğinde body `'📎'` (DB constraint kırılmasın)

**Tag/Commit:** `v15.19`, fix commit `v15.19.1` (formatFileSize eksik yapıştırma düzeltmesi)

---

### 2b. v15.18 — Mesaj Arama

**DB değişikliği:**
- `pg_trgm` extension (varsa tekrar kurulmaz)
- `idx_uys_chat_messages_body_trgm` — body üzerinde GIN trigram index (deleted_at IS NULL partial)
- `idx_uys_chat_messages_channel_created` — channel_id + created_at DESC kompozit

**Neden pg_trgm değil tsvector?**
Türkçe için stemmer gerekmiyor; substring match (`%cin%` → "çinko", "macintosh") avantajlı; tek dil varsayımı yok; kurulum basit.

**chatService.ts:**
- `searchMessages(userId, query, limit=50)` — erişilen kanallarda ILIKE ile tarama
- `SearchResultRow` interface — channel_name, channel_type, sender_name zenginleştirilmiş
- Min 2 karakter kontrolü (trgm için de anlamsız)
- DM kanal isimleri: karşı kullanıcının `ad || kullanici_ad` değerinden

**Chat.tsx UI:**
- Sol sidebar üst kısmında arama input'u (Search ikonu + X temizle)
- Debounce 250ms (her karakter değil)
- Arama aktifken kanal listesi gizlenir, sonuçlar kart halinde
- Her kart: kanal ikon/ad + tarih + gönderen + önizleme (2 satır clamp)
- `SearchHighlight` component — arama terimi amber `<mark>` ile vurgulanır
- Sonuca tıklayınca: kanala geç + `highlightMessageId` set + 4 sn amber ring + otomatik scroll
- `highlight` modunda otomatik en-alta-scroll devre dışı

**Tag/Commit:** `v15.18`

---

### 2c. v15.17 — @Mention

**DB değişikliği:**
- `uys_chat_mentions` tablosu mevcuttu (v15.16), iki index eklendi:
  - `idx_uys_chat_mentions_user_unread` (user_id, read_at WHERE read_at IS NULL partial)
  - `idx_uys_chat_mentions_message` (message_id)
- Realtime publication'a eklendi

**chatService.ts:**
- `extractMentionHandles(body)` — regex `/@([\p{L}0-9._]+)/gu` (Türkçe Unicode letter)
- `resolveMentionUserIds(handles[])` — kullanici_ad ile id lookup, inactive filtre
- `getUnreadMentionCount(userId)` — count
- `markChannelMentionsRead(userId, channelId)` — iki aşamalı (mesaj id'leri → mention update)
- `subscribeToUserMentions(userId, callback)` — Realtime INSERT dinleme, filter `user_id=eq.X`

**Chat.tsx UI:**
- `@` yazılınca autocomplete dropdown (cursor pozisyonundan geriye regex)
- Klavye navigasyon: ↑↓ gez, Tab/Enter seç, Esc iptal
- Adaylar: kullanıcı adı + tam ad filtresi, 8 aday limiti
- `MentionHighlightedBody` component — mesajda @handle amber `bg-accent/15` vurgu
- Kanala girince mention'lar da otomatik okundu işaretlenir

**useChatNotifications.ts:**
- Store'a `unreadMentionCount` eklendi
- İki subscription: mesaj + mention
- Tampon mekanizması: mention insert'i geldiğinde message_id Set'e eklenir, 5 sn sonra temizlenir
- Mesaj callback'i 150ms bekler, tampona bakar → mention ise **3'lü beep (660/880/1040Hz)**, değilse normal çift beep
- Mention notification: başlık `@ Sizi bahsettiler`, `requireInteraction: true` (kullanıcı kapatana kadar)

**Topbar.tsx:**
- Chat ikonunun sol üstünde amber AtSign ikonu (mention varsa)
- Sağ üstte kırmızı unread badge (değişmedi)

**Sidebar.tsx:**
- `/chat` menü badge'i: mention > 0 ise `@2 +5` formatı (amber bold), sadece unread ise normal kırmızı
- Badge rengi kondisyonel: mention varsa amber, yoksa red

**Tag/Commit:** `v15.17`, fix commit `v15.17.1` (Topbar'da chatMentions tanım satırı eksikliği)

---

## 3. Önceki Sürümler Özeti (v14 → v15.16)

| Sürüm | Tarih | Ne yapıldı |
|---|---|---|
| v14 | 17 Nis | İş Emirleri durumu bug fix (pct'ten değil, DB durumu öncelik) |
| v15.0 | 17 Nis | Sipariş sevk durumu, Yardım + Ekip Notları, MaterialSearchModal |
| **Supabase değişimi** | 17 Nis | Eski proje silindi, yeni `lmhcobrgrnvtprvmcito` + JSON restore + camelToSnake |
| v15.8 | 18 Nis | Problem Takip sayfası |
| v15.9–15.10 | 18 Nis | stokKontrol fix'leri (3-katmanlı altyapı, altı boş İE fallback) |
| v15.11–15.13 | 18 Nis | Operatör mesaj genişletme (kategori, öncelik, Web Audio beep) |
| **Supabase yedek sistemi** | 18 Nis | GitHub Actions nightly dump → ozler-uys-backup private repo |
| v15.14 | 18 Nis | Audit altyapısı (schema + columns, prebuild hook) |
| v15.15 | 18 Nis | Playwright E2E canlıda (9/9), PostgREST cache ALTER hilesi |
| v15.16 | 19 Nis gece | **ÖzlerMsg v1** — 6 yeni tablo, DM + Grup + Realtime |
| v15.16.1 | 19 Nis | Chat profili dbId fix (string eşleştirme kaldırıldı) |
| v15.16.2 | 19 Nis gece | Chat bildirim sistemi (unread badge + ses + browser notification) |
| **v15.17** | 20 Nis sabah | **@Mention** (autocomplete + vurgu + bildirim) |
| **v15.18** | 20 Nis sabah | **Mesaj arama** (pg_trgm + UI + highlight) |
| **v15.19** | 20 Nis sabah | **Dosya eklentisi** (Storage + drag-drop + thumbnail) |

---

## 4. Test Çalıştırma

### Dev server
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3   # ⚠ GitHub\ alt klasörü!
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
- `.env.local` — canlı dev (gitignore'da, manuel)
  ```
  VITE_SUPABASE_URL=https://lmhcobrgrnvtprvmcito.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_aVJ0v2zKTH4DzchuU2oEbw_YIFQs9YD
  ```
  UTF-8 BOM tuzağı — güvenli yol:
  ```powershell
  $c = "VITE_SUPABASE_URL=https://lmhcobrgrnvtprvmcito.supabase.co`r`nVITE_SUPABASE_ANON_KEY=sb_publishable_aVJ0v2zKTH4DzchuU2oEbw_YIFQs9YD`r`n"
  [System.IO.File]::WriteAllText("$PWD\.env.local", $c, [System.Text.UTF8Encoding]::new($false))
  ```

- `.env.test` — E2E (gitignore'da)
  ```
  VITE_SUPABASE_URL=https://cowgxwmhlogmswatbltz.supabase.co
  VITE_SUPABASE_ANON_KEY=sb_publishable_FjR4U_hFyETtZSd-JYBDRA_e6aO9lTj
  ```

---

## 5. Kritik Bilgiler

### Repo yolu (Önemli!)
**`$env:USERPROFILE\Documents\GitHub\ozler-uys-v3`** — GitHub Desktop ile klonlandığı için `\GitHub\` alt klasörü var. Eski bilgi bankalarında bu yol hatalıydı.

### Silent Reject Önleme (v15.14'ten beri)
- Yeni kolon kullanmadan önce `npm run audit:columns` veya information_schema.columns
- `npm run build` prebuild hook otomatik

### Test vs Canlı Supabase Şema Kayması
- **Canlı** `lmhcobrgrnvtprvmcito` — 33 tablo
- **Test** `cowgxwmhlogmswatbltz` — 27 tablo (`uys_kullanicilar` YOK)
- Chat tabloları test'te FK'siz
- **TODO:** Senkron

### PostgREST Schema Cache
- `NOTIFY pgrst, 'reload schema';` bazen yetmez
- En güvenilir: `ALTER TABLE ... ADD COLUMN x; ALTER TABLE ... DROP COLUMN x;` (dummy)

### Backup/Restore
- JSON export/import: 33/33 tablo dahil
- Otomatik: GitHub Actions TR 06:00 → ozler-uys-backup

### Realtime
- `supabase_realtime` publication 31+ tablo dinleniyor
- Chat kapsamı: messages, channels, members, mentions, reactions, attachments (v15.19)

### Storage (v15.19)
- Bucket: `chat-attachments`, public, 10 MB limit, any MIME
- Path: `chat/<channel_id>/<message_id>/<timestamp>-<safe_filename>`
- 3 policy: chat_attachments_read / insert / delete
- DB insert Supabase upload sonrası — hata durumunda rollback

### Stok Kontrol Kuralı (v15.1, v15.9+v15.10)
> "Üretilecek ürünün alt kırılımında hammadde/yarı mamul yoksa STOK YOK. A3 için A2/A1/A stokta yeterli."

### Chat authUser dbId Akışı (v15.16.1+)
- `signIn` → `authUser.dbId = k.id`
- `useChatUser` önce `user.dbId` ile direkt lookup
- Mention/thread/reaction için temel

### Chat Bildirim Akışı (v15.16.2+ / v15.17)
- `useChatNotifications` Topbar'da tek instance
- İki Zustand store state: `unreadCount`, `unreadMentionCount`
- İki realtime: mesaj + mention ayrı ayrı
- Ses: operatör 880Hz, chat 520+720Hz, **mention 660+880+1040Hz** (3'lü)

---

## 6. Pending İşler

### 🟡 ÖzlerMsg Etap 2 Kalan (Tablolar hazır, UI bekliyor)
| Özellik | Durum | Not |
|---|---|---|
| Thread/reply | Tablo ✅ `reply_to_id` | UI bekleniyor |
| Emoji reaction | Tablo ✅ `uys_chat_reactions` | UI bekleniyor |
| Online/offline (presence) | ❌ | Supabase Realtime presence API |

**Not:** 1 hafta gözlem sonrası öncelik kesinleşir. Mevcut 3 büyük özellik (mention/arama/dosya) kullanıcı geri dönüşü için yeterince büyük kapsam.

### 🔴 Güvenlik — Uzun Dönem
- **Google OAuth** — yeni Supabase'de provider enable değil
- **RLS allow_all → authenticated** — Supabase Auth entegrasyonu gerekli
- Storage policy'leri de şu an allow_all

### 📋 Audit Genişletmeleri
- Permissions vs sayfalar
- Types vs DB kolonları
- Sidebar vs App.tsx route'ları
- Test vs Canlı Supabase şema senkronu

### 🔒 İş Tarafı (UYS dışı)
- Libya doc paketi
- Compaco Romania 8D
- CBAM portal
- GFB (Dilovası, kapasite raporu pending)
- İSG TL-ISG-017
- NETBIS

### 🛠 UYS İçi Diğer
- Kesim planı birleştirme
- Normalize veri geçişi
- İstek #18 (fire → sipariş dışı İE)
- İstek #19 (MRP stoktan ver)
- `revision_sql.sql` + `uys_hm_tipleri` Supabase'de çalıştır
- Yeni dashboard layout

---

## 7. Yeni Chat İçin Giriş

**Yüklenecek dosyalar:**
1. `OZLER_UYS_BILGI_BANKASI_v15_19.md` (bu dosya)
2. Güncel repo snapshot zip'i (opsiyonel — `git clone` da yeterli)

**İlk mesaj önerisi:**
> "v15.19 canlıda — ÖzlerMsg Etap 2 tamamlandı: @mention + mesaj arama + dosya eklentisi çalışıyor. Son tag `v15.19`. Sıradaki işler: thread/reply + emoji reaction + presence (Etap 2 kalanlar), veya Google OAuth + RLS authenticated (güvenlik paketi), veya UYS içi backlog (kesim birleştirme, MRP stoktan ver, revision_sql)."

**Hızlı komutlar:**
```powershell
cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3   # ← HER TERMİNAL
npm run dev
npm run test:e2e
npm run audit
npm run build
git log --oneline -5
```

---

## 8. ÖzlerMsg — Dosya Yapısı

```
sql/
├── uys_chat_v1.sql                    ← v15.16 temel
├── uys_chat_mentions_v2.sql           ← v15.17 (index + realtime)
├── uys_chat_search_v3.sql             ← v15.18 (pg_trgm + trgm index)
└── uys_chat_attachments_v4.sql        ← v15.19 (storage policies)
src/
├── features/
│   └── chat/
│       ├── types.ts
│       ├── chatService.ts             ← 600+ satır, 4 bölüm
│       └── useChatUser.ts
├── hooks/
│   └── useChatNotifications.ts        ← v15.17 (mention counter + 3'lü beep)
└── pages/
    └── Chat.tsx                       ← 1278 satır
```

### chatService.ts Bölümler
1. **KANAL/DM** — getOrCreateDm, createGroup, addMember, removeMember
2. **SIDEBAR** — getSidebarChannels (unread count dahil)
3. **MESAJ** — getMessages, sendMessage (mention destekli), updateMessage, deleteMessage
4. **REAKSİYON** — addReaction, removeReaction
5. **REALTIME** — subscribeToChannelMessages, subscribeToAllUserMessages
6. **MENTION (v15.17)** — extractMentionHandles, resolveMentionUserIds, getUnreadMentionCount, markChannelMentionsRead, subscribeToUserMentions
7. **ARAMA (v15.18)** — searchMessages, SearchResultRow
8. **ATTACHMENTS (v15.19)** — uploadAttachment, getMessageAttachments, deleteAttachment, isImageMime, formatFileSize

---

## 9. Çalışma Tarzı (User Tercihleri)

- Türkçe, özlü, ADIM ADIM
- "Tane tane" → her komut tek tek, çıktıyı bekle
- "Sen karar ver" → analitik karşılaştırma + net öneri + gerekçe
- Seçenekler mutually-exclusive
- Şifreleri asla yazma
- Yeni kolon kullanmadan önce audit
- JSON backup/restore: camelCase ↔ snake_case
- Force push öncesi yedek branch
- `.env.local` asla commit
- **1-2 dosya için drag-drop** ya da **github.dev Ctrl+H**
- **Her terminalde ilk komut:** `cd $env:USERPROFILE\Documents\GitHub\ozler-uys-v3`

---

## 10. Araç Kullanımı

| İş | Araç |
|---|---|
| Kod düzenleme | **VS Code** (local) veya **github.dev** (browser, `.` tuşu) |
| Commit + push | Git CLI veya github.dev Source Control panel |
| Test | PowerShell |
| SQL | Supabase Dashboard |
| Storage | Supabase Dashboard → Storage |

### github.dev (Browser IDE)
- GitHub repo sayfasında `.` tuşu → tam VS Code tarayıcıda
- Avantaj: kurulum gerekmez, her makineden çalışır
- Dezavantaj: dev server çalışmaz (lokal test yok), sadece kod düzenleme + commit
- **Find & Replace** (Ctrl+H) güvenilir — büyük değişikliklerde bile tek seferde uygulanır
- **Multi-file paste**: Ctrl+A → Delete → Ctrl+V tam dosya değiştirme için güvenli

### GitHub Actions
- Push → otomatik build + deploy (2-3 dk)
- `https://github.com/uzuniskender/ozler-uys-v3/actions` — yeşil tik = canlı
- Prebuild'de audit otomatik çalışır — silent reject hatalarını yakalar

---

## 11. Ders Çıkarmalar

1. **FK tipi uyumsuzluğu**: uys_kullanicilar.id uuid değil text
2. **.env.local BOM**: PowerShell Set-Content ekliyor → UTF8Encoding.new($false)
3. **Audit indexOf whitespace**: regex whitespace-tolerant şart
4. **audit-schema fantom tablo**: SQL yorumlardaki örnekler yakalanıyor
5. **.env.local Supabase URL**: Supabase değişiminde manuel güncel şart
6. **GitHub Desktop untracked**: Git CLI daha güvenilir
7. **Force push öncesi yedek branch**
8. **Yeni kolon → önce audit**
9. **PostgREST cache**: Dummy ALTER ADD/DROP hilesi
10. **String eşleştirmesi > id lookup**: authUser.dbId pattern
11. **Realtime hook tek yerde çağrılmalı**: Topbar (çift subscription riski)
12. **Realtime ≠ authoritative sync**: 15 sn polling gerekli
13. **Ayırt edici ses patterns**: operatör 880Hz, chat çift, mention 3'lü
14. **(v15.18) pg_trgm vs tsvector**: Türkçe/substring için trgm daha iyi
15. **(v15.18) ILIKE '%x%' + GIN trgm**: 100ms altı sonuç, binlerce mesaj
16. **(v15.18) Debounce 250ms**: yazarken her karakter sorguluma
17. **(v15.19) Storage upload + DB insert rollback**: Upload başarılı ama DB hatası → storage remove
18. **(v15.19) Path pattern önemli**: `chat/<ch>/<msg>/<ts>-<name>` — silme + yetki için organize
19. **(v15.19) File sanitization**: Türkçe karakter + özel karakter `_` — Storage key uyumu
20. **(v15.19) Boş body + ek kombinasyonu**: DB NOT NULL constraint için body='📎' placeholder
21. **(v15.19) Yapıştırma hatası güvenliği**: `export function` yarım kalırsa build 839. satırda `EOF expected` verir — post-paste build kontrolü şart
22. **(YENİ) Repo yolu**: `\GitHub\` alt klasörü, GitHub Desktop varsayılanı
23. **(YENİ) github.dev**: Nokta tuşu hilesi, lokal setup olmadan çalışma — özellikle farklı bilgisayarda
