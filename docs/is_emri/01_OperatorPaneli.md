# İŞ EMRİ #1 — UYS v3 Operatör Paneli (`/operator` route)

## Bağlam

Eski monolit UYS'te (`ozleruretim` repo) `operator.html` (811 satır) bağımsız bir mobil operatör panelidir. Operatörler bu sayfayı tablet/telefondan açıp üretim, fire, duruş kayıtlarını giriyor. UYS v3'e taşınmamış — backlog'da `Operatör paneli (/operator route)` olarak duruyor.

Operatörler sahada **bunu kullanıyor**. UYS v3 bu sayfa olmadan production'a alınamaz.

**Hedef:** UYS v3'te `/operator` route'u oluşturmak — eski `operator.html`'in tüm işlevselliğini React/TypeScript yapıya taşımak.

---

## YAKLAŞIM

`/operator` route'u **özel bir layout** kullanacak:
- Sidebar/Topbar YOK (mobil panelde yer kaplar)
- Kendi koyu tema header'ı
- Mobile-first (örn. kullanım: 375px–414px viewport)
- Servis hesabı ile otomatik login + sicil no girişi (sicil no ile operatör seçimi)

Mevcut `useAuth`, `useStore`, `useRealtime` aynen kullanılacak — operatör bir "viewer + limited writer" rolü olarak konumlanacak.

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

UYS v3'ün mevcut yapısı bozulmayacak:
1. Mevcut sayfalar (admin paneli) etkilenmeyecek
2. RBAC sistemi (`useAuth.can()`) aynen kullanılacak — **yeni rol:** `operator`
3. Realtime subscription (`CLIENT_ID`) operatör panelinde de aynı pattern
4. Store mapper (camelCase ↔ snake_case) operatör panelinde de aynı

---

## FAZ 1 — ALTYAPI

### Görev 1.1 — Yeni Rol: `operator`

`permissions.ts` dosyasına yeni rol eklenecek:

```typescript
operator: [
  'op_view_workorders',     // bölümüne ait WO'ları görür
  'op_log_production',      // üretim kaydı (logs INSERT)
  'op_log_fire',            // fire kaydı (fireLogs INSERT)
  'op_log_durus',           // duruş kaydı
  'op_start_work',          // İşe Başla (activeWork INSERT)
  'op_stop_work',           // İşi Bitir (activeWork DELETE)
  'op_send_message',        // yöneticiye mesaj (operatorNotes INSERT)
  'op_view_stok',           // sadece kendi malzemeleri için stok görür
]
```

**Kabul kriteri:** Admin paneline `operator` rollü kullanıcı giremez (sadece /operator route).

### Görev 1.2 — Operatör Auth Akışı

`/operator` sayfasında:
1. Servis hesabı ile **otomatik supabase signin** (env'den okunur — örn. `VITE_OPERATOR_EMAIL` + `VITE_OPERATOR_PASSWORD`)
2. Login başarılı → bölüm dropdown gösterilir
3. Bölüm seçilir → o bölümün operatörleri alfabetik listelenir
4. Operatör seçilir → sicil no input'u çıkar (default 1234, hash kontrolü)
5. Sicil no doğru → ana panel açılır

**Önemli:** Servis hesap şifresi `.env.local`'a eklenmeli, repo'ya commitlenmemeli (`.gitignore` kontrolü).

### Görev 1.3 — Operatör Layout

Yeni component: `src/components/layout/OperatorLayout.tsx`

- Tam ekran (sidebar yok)
- Sticky header: bölüm + operatör adı + senkron durumu (yeşil/kırmızı dot) + çıkış butonu
- Aktif çalışma bar (eğer activeWork varsa): "Çalışıyor: WO#... — 00:35:12" + "Bitir" butonu
- 3 sekmeli navigation: **Üretim / Emirler / Özet**
- `pb-20` (alt navigation için boşluk)

`App.tsx` (router) güncellemesi — `/operator` rotası `OperatorLayout` kullanacak, diğer rotalar mevcut `Layout`.

---

## FAZ 2 — ÜRETİM SEKMESİ

### Görev 2.1 — WO Kart Listesi

Operatörün bölümüne ait, durumu `iptal` olmayan, `wPct < 100` olan iş emirleri kart şeklinde listelenecek.

Kart içeriği:
- WO no + ürün adı + termin
- İlerleme barı (`wPct`)
- Stok durumu: 🟢 Yeterli / 🟡 Kısmi / 🔴 Stok Yok (kırmızıda kart `pointer-events:none`)
- Hover/tap ile entry modal açılır

**Tip filtreleri (üst toolbar):** Bitmiş Ürün / Ara İşlem / Kesim (checkbox grubu — operatör kendi tercih ettiğini görsün, bilgi bankasındaki UI tercihi).

### Görev 2.2 — Üretim Entry Modal

Tek bir kayıt = bir veya daha fazla operatörün, bir veya daha fazla zaman aralığında, bir veya daha fazla duruş kayıt etmesi.

**Form alanları:**
- **Operatörler** (çoklu, dropdown — varsayılan giriş yapan kişi)
- **Zaman aralıkları** (çoklu — başlangıç/bitiş, +Ekle butonu)
- **Üretim miktarı** (sayı input)
- **Fire miktarı** (sayı input — toggle ile fire detay modu açılır: malzeme + kg)
- **Duruşlar** (çoklu — kod + süre, +Ekle butonu)
- **Yöneticiye mesaj** (opsiyonel textarea)

**Validasyon:**
- Zaman aralığı çakışması yasak
- Toplam çalışma süresi gün atlamayacak (07:00–17:00 dışı uyarı)
- Üretim miktarı + fire ≤ stok (BOM ratio ile)

**Kabul kriteri:** Submit'te `logs`, `fireLogs`, `stokHareketler`, `operatorNotes` tabloları tek transaction'da insertlenir.

### Görev 2.3 — İşe Başla / Bitir

WO kartında "İşe Başla" butonu → `activeWork` tablosuna kayıt insert edilir (`operatorId`, `woId`, başlangıç zamanı, `__client: CLIENT_ID`).

Aktif çalışma var → header'da kırmızı bar görünür ve diğer "İşe Başla" butonları **disabled** olur (operatör aynı anda sadece 1 işte çalışabilir; çoklu iş için ayrı buton: "Ek İş Başlat").

"Bitir" butonu → `activeWork` DELETE + entry modal otomatik açılır (kullanıcı geçen sürede ne ürettiğini girer).

---

## FAZ 3 — EMİRLER VE ÖZET SEKMELERİ

### Görev 3.1 — Emirler Sekmesi

Operatörün bölümüne ait tüm WO'lar (tamamlananlar dahil) — tablo şeklinde:

| WO# | Ürün | Adet | Üretilen | İlerleme | Termin | Durum |

**Filtre:**
- Tamamlananları gizle/göster (default: gizli)
- Termin sıralaması (yakın olan üstte)

**Önemli:** Tamamlanan iş emirleri **3 gün** sonra otomatik gizlenir (`completedAt + 3 days < now`).

### Görev 3.2 — Özet Sekmesi

Operatörün **bugün** yaptığı kayıtların özeti:
- Toplam üretim (adet)
- Toplam fire (kg)
- Toplam duruş (dk)
- Çalışma süresi (saat)
- Verim % (üretim / hedef × 100)

Ek: yöneticinin operatöre yazdığı son 5 not (`yoneticiNot` alanından — okundu/okunmadı işaretli).

---

## FAZ 4 — REALTIME + GÜVENLİK

### Görev 4.1 — Realtime Subscription

`useRealtime` hook'una operatör için **özel reload** mantığı:
- Sadece kendi bölümüne ait WO'ları yenile
- Kendi insertlediği eventleri yoksay (`__client === CLIENT_ID` → atla)
- Reload debounce: 1500ms (mobile veri tasarrufu)

### Görev 4.2 — RLS (Row Level Security) Politikaları

Supabase'de operatör servis hesabı için politikalar:

```sql
-- workOrders: sadece bölümüne ait + iptal olmayan
-- logs: sadece kendi insertleri (operatorId match)
-- fireLogs: aynı
-- activeWork: sadece kendi
-- operatorNotes: insert serbest, select sadece kendi
-- stokHareketler: insert serbest (üretim), select kapalı
```

**Önemli:** Bu RLS politikaları **olmadan** servis hesap tüm veriyi okuyabilir. Eski sistemde bu eksikti — yeni sistemde şart.

### Görev 4.3 — Sicil No Hash

Sicil no plain text saklanmamalı:
- Operatör tablosuna `sicil_hash` kolonu (cyrb53 veya bcrypt)
- Default 1234 → ilk girişte **şifre değiştirme zorunlu** modal

Migration: mevcut operatörlere geçici 1234 hash atanır, ilk girişte değiştirir.

---

## FAZ 5 — TEST VE DEPLOY

### Görev 5.1 — Playwright E2E

Yeni test: `test/e2e/operator-panel.spec.ts`
- Login → bölüm → operatör → sicil
- WO listesi yüklenir
- Üretim entry: tüm alanları doldur, submit
- İşe Başla → activeWork insert kontrolü
- Bitir → activeWork DELETE kontrolü
- Logout

### Görev 5.2 — Mobile Test Matris

Manuel test edilecek viewport'lar:
- 360×800 (Android orta)
- 375×812 (iPhone X)
- 414×896 (iPhone 11)

Kontrol: scroll davranışı, tap target ≥ 44px, klavye açılınca form gizlenmiyor.

---

## GENEL UYARILAR

1. **Tema:** Eski operator.html'in koyu tema renkleri korunsun (operatör buna alışkın). Tailwind v4 ile şu CSS değişkenleri:
   ```css
   --bg: #0c0f14
   --acc: #00d4aa  /* turkuaz vurgu */
   --warn: #ffb142
   --err: #ff6b6b
   --ok: #00e676
   ```

2. **Sonner toast yerine** mobil için **alt notch toast** (`bottom: env(safe-area-inset-bottom)`).

3. **Tap target ≥ 44px** her interaktif element için (Apple HIG kuralı).

4. **Klavye davranışı:** Number input'larda `inputmode="numeric"`, datepicker yerine `<input type="date">`.

5. **Offline tolerance:** Realtime kopukluğunda son senkron zamanı gösterilsin, kullanıcı manual refresh yapabilsin.

6. **Audit script:** Operatör panelindeki tüm INSERT'lerin `__client: CLIENT_ID` içerdiği `audit-schema.cjs`'e eklenmeli.

7. **Migration:** `supabase/migrations/{timestamp}_operator_role_rls.sql`

---

## ÇIKTI BEKLENTİSİ

Her görev için:
- Etkilenen dosyaların tam içeriği
- Migration SQL dosyaları
- Yeni component'lerin tam içeriği
- Playwright test dosyası
- Commit mesajı önerisi
- CHANGELOG satırı

**Faz tamamlanma sırası:** 1 → 2 → 3 → 4 → 5 (her faz tamamlanmadan sonraki faza geçilmeyecek)

**Tag önerisi:** `v15.17.0` (bu iş emri tamamlandığında).
