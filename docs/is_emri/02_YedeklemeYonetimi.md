# İŞ EMRİ #2 — UYS v3 Yedekleme Yönetimi (`/backup` route)

## Bağlam

Eski monolit UYS'te (`ozleruretim` repo) `backup.html` (257 satır) bağımsız yedekleme yönetim arayüzüdür. Otomatik günlük yedekler `ayarlar` tablosuna `uys_backup_YYYY-MM-DD` key'i ile JSON blob olarak kaydedilir, 30 gün saklanır.

UYS v3'te `ozler-uys-backup` private repo arka planda gece çalışıyor, ancak:
- **Yedek listesini görme arayüzü YOK**
- **Geri yükleme arayüzü YOK**
- **Manuel yedek alma butonu YOK**
- Bir hata durumunda nasıl önceki güne döneceğiniz belirsiz

Risk-averse yaklaşım için bu **kabul edilemez**. Bir kalite müdürü olarak bir veri kaybı durumunda anında müdahale edebilmeli.

**Hedef:** UYS v3'te `/backup` route'u oluşturmak — yedek listesi, geri yükleme, manuel yedek alma, dosyadan geri yükleme arayüzü.

---

## YAKLAŞIM

UYS v3 normalize tablo mimarisinde olduğu için yedek formatı eski JSON blob'dan farklı olacak:

**Yedek formatı:** Tüm 23 normalize tablonun snapshot'ı (her tablo için array) → tek JSON objesi:
```json
{
  "_version": "v3",
  "_takenAt": "2026-04-25T12:00:00Z",
  "_takenBy": "buket@ozler.com",
  "tables": {
    "orders": [...],
    "workOrders": [...],
    "logs": [...],
    ...19 tablo...
  }
}
```

Eski v22 JSON blob formatından geri yükleme için ayrı bir **migration parser** (eski → v3 mapper).

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

1. `ozler-uys-backup` private repo'daki gece çalışan job (eğer varsa) — paralel çalışsın, çakışma olmasın
2. Mevcut `ayarlar` tablosu key-value yapısı — yedekler `uys_v3_backup_YYYY-MM-DD` key'i ile bu tabloya yazılacak (eski sistemden ayrı)
3. RBAC mantığı — sadece yetkili roller backup sayfasına erişebilir

---

## FAZ 1 — VERİ MODELİ + ALTYAPI

### Görev 1.1 — Yedek Tablosu / Storage Stratejisi

İki seçenek var, **Seçenek B** önerilir:

**Seçenek A:** `ayarlar` tablosuna `uys_v3_backup_*` key'leri (eski yöntem)
- Artı: kolay
- Eksi: büyük veri (1MB+), `ayarlar` tablosunu şişirir

**Seçenek B (önerilen):** Yeni tablo `pt_yedekler`:

```sql
CREATE TABLE pt_yedekler (
  id          uuid PRIMARY KEY,
  alindi_tarih date NOT NULL UNIQUE,    -- günde 1 yedek (UNIQUE constraint)
  alindi_saat  timestamptz NOT NULL DEFAULT now(),
  alan_kisi    text NOT NULL,           -- yedek alan kullanıcı (otomatik)
  tip          text NOT NULL DEFAULT 'otomatik',  -- 'otomatik' | 'manuel'
  boyut_kb     integer,
  veri         jsonb NOT NULL,          -- snapshot
  notlar       text                     -- manuel yedeklerde "v15.18.0 deploy öncesi" gibi etiket
);
CREATE INDEX idx_yedekler_tarih ON pt_yedekler(alindi_tarih DESC);
```

**Kabul kriteri:** Aynı gün 2. kez yedek almaya çalışıldığında UPSERT yapılır (otomatik) veya kullanıcıya sorulur (manuel).

### Görev 1.2 — Yedek Alma Servisi

`src/lib/backup.ts`:

```typescript
export async function takeBackup(tip: 'otomatik' | 'manuel', notlar?: string): Promise<BackupResult>
export async function listBackups(): Promise<Backup[]>
export async function getBackup(id: string): Promise<Backup>
export async function restoreBackup(id: string, mode: 'merge' | 'replace'): Promise<RestoreResult>
export async function deleteBackup(id: string): Promise<void>
export async function cleanOldBackups(keepDays: number = 30): Promise<number>  // silinen sayısı
```

`takeBackup` mantığı:
1. Tüm 19 tabloyu Supabase'den oku (paralel `Promise.all`)
2. `_version`, `_takenAt`, `_takenBy` metadata ekle
3. JSON serialize → boyut hesapla
4. `pt_yedekler` tablosuna UPSERT (`alindi_tarih` UNIQUE)

`restoreBackup` mantığı:
1. **Replace mode:** Tüm tabloları DELETE + INSERT (riski yüksek — onay zorunlu)
2. **Merge mode:** ID bazlı UPSERT (mevcut kayıtlar korunur, eksikler eklenir)
3. **Geri yükleme öncesi otomatik güvenlik yedeği** alınır (örn. `tip='manuel', notlar='Geri yükleme öncesi otomatik'`)

**Kabul kriteri:** Replace mode'da yanlış yedek seçilirse güvenlik yedeği ile geri dönülebilir.

### Görev 1.3 — Otomatik Yedek (Cron / Edge Function)

Üç seçenek:

**Seçenek A:** Supabase Edge Function + cron (önerilen)
- `supabase/functions/auto-backup/index.ts`
- pg_cron ile her gün 23:00'da çağırılır
- Servis hesap auth ile çalışır

**Seçenek B:** GitHub Action (`ozler-uys-backup` repo'da zaten var ise)
- Mevcut workflow'a v3 desteği eklenir

**Seçenek C:** Frontend tarafında ilk session'da kontrol
- Buket login olunca: bugün yedek alındı mı? Hayır → al
- Eksi: Buket girmezse yedek alınmaz

→ Buket'le netleştirilmeli: mevcut `ozler-uys-backup` repo zaten cron çalıştırıyorsa onu güncellemek yeterli; çalışmıyorsa Seçenek A.

### Görev 1.4 — RBAC Permissions

`permissions.ts`:

```typescript
'backup_view',     // yedek listesini görme
'backup_create',   // manuel yedek alma
'backup_restore',  // geri yükleme (TEHLİKELİ)
'backup_delete',   // yedek silme
```

**Sadece admin rolünde** `backup_restore` ve `backup_delete` olmalı. Diğer roller en fazla `backup_view` + `backup_create`.

---

## FAZ 2 — UI

### Görev 2.1 — `/backup` Route + Sayfa

Yeni dosya: `src/pages/Backup.tsx`

Sayfa yapısı:

**A) Üst kısım — Mevcut Veri Özeti:**
- Toplam tablo sayısı (19)
- Toplam kayıt sayısı (her tablo için satır sayısı)
- Toplam yedek boyutu (KB)
- Son otomatik yedek tarihi + boyut
- "Şimdi Yedekle" butonu (manuel) — modal ile etiket girişi

**B) Orta kısım — Yedek Listesi:**

Tablo formatı:

| Tarih | Saat | Tip | Boyut | Alan | Notlar | Aksiyonlar |
|-------|------|-----|-------|------|--------|-----------|
| 25.04.2026 | 23:00 | Otomatik | 1.2 MB | system | — | İndir / Geri Yükle / Sil |
| 24.04.2026 | 14:32 | Manuel | 1.1 MB | buket | "v15.17 öncesi" | İndir / Geri Yükle / Sil |

**Filtreler:**
- Tip (Tümü / Otomatik / Manuel)
- Tarih aralığı (son 7 gün / son 30 gün / tümü)

**Aksiyonlar:**
- **İndir:** JSON dosya olarak indirir (`ozler_uys_yedek_YYYYMMDD.json`)
- **Geri Yükle:** Onay modal'ı + mod seçimi (Merge/Replace)
- **Sil:** Şifre yerine RBAC kontrolü + ek onay

**C) Alt kısım — Dosyadan Geri Yükle:**

Drag & drop / dosya seç input — JSON yedek dosyasını yükle.

Eski v22 formatı ile yeni v3 formatını otomatik tespit et:
- `_version === 'v3'` → direkt restore
- `orders`, `workOrders` gibi top-level keys → eski v22 formatı, parser'dan geçir

### Görev 2.2 — Geri Yükleme Modal'ı

İki adımlı onay:

**Adım 1 — Mod Seçimi:**
- ⚠️ "Bu işlem **TÜM** verilerinizi etkileyecek"
- Seçenekler:
  - 🔄 **Merge** (mevcut korunur, eksikler eklenir) — daha güvenli
  - 💀 **Replace** (tüm veri silinir, yedek geri yüklenir) — TEHLİKELİ
- Devam butonu disabled (5sn timer)

**Adım 2 — Son Onay:**
- "Geri yükleme öncesi otomatik güvenlik yedeği alınacak"
- Replace seçildiyse: kullanıcıdan **ŞİFRESİNİ** girmesi istenir (admin re-auth)
- "GERI YÜKLE" butonu

**İşlem sırasında:**
- Loading bar + progress text ("Güvenlik yedeği alınıyor..." → "Veriler temizleniyor..." → "Yedek geri yükleniyor..." → "Tamamlandı ✓")
- İşlem 30sn'den uzun sürerse "Devam ediyor, sayfayı kapatmayın" uyarısı

**Kabul kriteri:** İşlem yarıda kalırsa (network hatası vb.) son durum tutarlı olmalı — transaction veya tüm işlemler idempotent.

### Görev 2.3 — Eski v22 → v3 Parser

`src/lib/backup-parser.ts`:

```typescript
export function parseV22Backup(json: any): V3Backup
```

v22 JSON blob'da bazı alan isimleri farklı (örn. `S.kesimPlanlari` → `cuttingPlans`). Mevcut store mapper (camelCase ↔ snake_case) bu işi yapıyor zaten — onu kullan.

**Kabul kriteri:** Eski sistemden alınmış 5 örnek yedek dosyası başarıyla parse + restore edilir.

---

## FAZ 3 — TEST

### Görev 3.1 — Playwright E2E

`test/e2e/backup.spec.ts`:
1. `/backup` sayfasına git → liste yüklenir
2. "Şimdi Yedekle" → manuel yedek oluştur, listeye eklendiğini doğrula
3. Yedeği indir → dosya boyutu > 0
4. **Test ortamında** (test Supabase: `cowgxwmhlogmswatbltz`) bir yedek geri yükle (merge mode) → veri tutarlılığı doğrula
5. Yedeği sil → listeden çıktığını doğrula

**Önemli:** Replace mode E2E testte ÇALIŞTIRILMASIN (test verisi kaybolur). Sadece manuel test.

### Görev 3.2 — 30 Gün Temizleme Testi

`cleanOldBackups(30)` fonksiyonu:
- 30 günden eski otomatik yedekler silinir
- **Manuel yedekler etkilenmez** (kullanıcı kasten saklamış olabilir)

Birim testi yazılacak: `src/lib/backup.test.ts`

---

## GENEL UYARILAR

1. **Yedek boyutu:** Sistemin büyümesiyle (binlerce sipariş, milyonlarca log) yedek boyutu 5-10 MB olabilir. JSONB sıkıştırma Supabase'de zaten aktif, ek bir şey yapmaya gerek yok.

2. **localStorage cache YOK:** Eski sistemde `localStorage` da kullanılıyordu. UYS v3'te kullanılmıyor — yedekleme sadece Supabase üzerinden.

3. **CLIENT_ID:** Manuel yedek alındığında realtime event tetiklemesin (`pt_yedekler` tablosu realtime subscription listesinde olmamalı).

4. **Gizlilik:** Yedek dosyası **şifrelenmemiş** JSON. İndirilen dosya hassas veri içerir → kullanıcıya bilgilendirme: "Bu dosyayı güvenli bir yerde saklayın, paylaşmayın."

5. **Migration dosyaları:**
   - `supabase/migrations/{timestamp}_pt_yedekler_table.sql`
   - `supabase/migrations/{timestamp}_pt_yedekler_rls.sql` — sadece admin INSERT/SELECT/DELETE

6. **Sidebar'a "Yedek" menü** eklenmeli — sadece `backup_view` yetkisi olanlara görünür.

---

## ÇIKTI BEKLENTİSİ

Her görev için:
- Migration SQL
- Etkilenen dosyalar (tam içerik)
- Yeni component'ler
- Birim test + E2E test
- Commit mesajı + CHANGELOG

**Faz sırası:** 1 → 2 → 3

**Tag önerisi:** `v15.18.0` (bu iş emri tamamlandığında).
