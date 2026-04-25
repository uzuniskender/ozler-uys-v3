# UYS v3 — Problem Takip Modülü Geliştirme İş Emri

## Bağlam

UYS v3'te `src/pages/ProblemTakip.tsx` (487 satır) ve Supabase'de `pt_problemler` tablosu mevcut. Yapı: React/TypeScript + Zustand store (`useStore`) + Supabase + RBAC (`useAuth`, `can()`) + Realtime (`CLIENT_ID`) + Tailwind + `sonner` toast.

Paralel Netlify uygulamasındaki (`stncxoqvwuxfzoprxkhz` Supabase projesi) bazı özellikler UYS v3'e taşınacak. Netlify projesi tamamlandıktan sonra silinecek — yani UYS v3 tek doğru kaynak olacak.

## Mevcut Veri Modeli (`pt_problemler`)

```
id, problem, termin, sorumlu, durum, yapilanlar, notlar,
olusturan, olusturma, son_degistiren, son_degistirme,
kapatma_tarihi, __client
```

Mevcut TypeScript type: `Problem` (`@/types`).

## Hedef

Aşağıdaki özellikler eksik — sırayla eklenecek. **Mevcut özelliklere DOKUNULMAYACAK** (bkz. "Korunacak Özellikler" listesi).

---

## KORUNACAK ÖZELLİKLER (DOKUNMA)

Bu özellikler UYS v3'te zaten Netlify'dan üstün. Refactor sırasında bozma:

1. **"Yeni Aksiyon Ekle" butonu** (`yapilanlar` textarea'sına otomatik tarih+kullanıcı damgası ekliyor)
2. **Otomatik kullanıcı kimliği** (login üzerinden — manuel imza alanı YOK)
3. **RBAC** (`pt_add`, `pt_edit`, `pt_delete` action'ları)
4. **Realtime sync** (`CLIENT_ID` ile)
5. **Akıllı otomatik sıralama** (geciken üstte → durum öncelik → termin yakın)
6. **Durum=Kapandı → kapatma_tarihi otomatik** atama mantığı
7. **Tablo satırına tıklayınca düzenle modal'ı açılması**

---

## FAZ 1 — VERİ MODELİ

### Görev 1.1 — `pt_problemler` Tablosuna Yeni Kolonlar

Supabase migration ile aşağıdaki kolonlar eklenecek:

| Kolon | Tip | Default | Açıklama |
|---|---|---|---|
| `oncelik` | text | `'Orta'` | Kritik / Yüksek / Orta / Düşük |
| `departman` | text | NULL | Üretim, Üretim Planlama, ARGE, Lojistik, Kalite, Satış, İK, Finans, Çevre/İSG, Diğer |
| `kategori` | text | NULL | Süreç, Kalite, Sistem, Donanım, İnsan Kaynağı, Tedarikçi, Müşteri, Diğer |
| `etkilenen` | text | NULL | Etkilenen ürün/süreç |
| `bildiren` | text | NULL | Bildirimi yapan kişi (oluşturandan farklı olabilir) |
| `acilis_tarihi` | date | NULL | Manuel açılış tarihi (geçmişe dönük kayıt için) |

**Kabul kriteri:** Migration sorunsuz çalışır, mevcut kayıtlar etkilenmez (NULL veya default ile dolar).

### Görev 1.2 — `pt_tarihce` Tablosu (Audit Trail)

Yeni tablo:

```sql
CREATE TABLE pt_tarihce (
  id           uuid PRIMARY KEY,
  problem_id   uuid NOT NULL REFERENCES pt_problemler(id) ON DELETE CASCADE,
  alan         text NOT NULL,        -- değişen alan adı
  eski_deger   text,
  yeni_deger   text,
  degistiren   text NOT NULL,
  tarih        timestamptz NOT NULL DEFAULT now(),
  __client     text                  -- realtime için
);
CREATE INDEX idx_pt_tarihce_problem ON pt_tarihce(problem_id, tarih DESC);
```

İzlenecek alanlar (13): `problem`, `oncelik`, `departman`, `kategori`, `etkilenen`, `bildiren`, `acilis_tarihi`, `termin`, `kapatma_tarihi`, `sorumlu`, `durum`, `yapilanlar`, `notlar`.

**Kabul kriteri:** Düzenleme kaydedildiğinde, değişen her alan için `pt_tarihce`'ye satır INSERT edilir. Hiç değişmediyse hiç kayıt atılmaz.

### Görev 1.3 — `pt_yorumlar` Tablosu

Yeni tablo:

```sql
CREATE TABLE pt_yorumlar (
  id          uuid PRIMARY KEY,
  problem_id  uuid NOT NULL REFERENCES pt_problemler(id) ON DELETE CASCADE,
  icerik      text NOT NULL,
  yazan       text NOT NULL,         -- otomatik user.username (manuel input YOK)
  tarih       timestamptz NOT NULL DEFAULT now(),
  __client    text
);
CREATE INDEX idx_pt_yorumlar_problem ON pt_yorumlar(problem_id, tarih ASC);
```

**Not:** Netlify'da iki tip vardı (`aciklama` + `notlar`). UYS v3'te zaten `notlar` ayrı bir kolon — sadece tek tip yorum (açıklama) yeterli, `tip` kolonuna gerek yok.

### Görev 1.4 — TypeScript Type Güncellemesi

`@/types` içindeki `Problem` interface'ine yeni alanlar eklenecek (camelCase):

```typescript
oncelik?: 'Kritik' | 'Yüksek' | 'Orta' | 'Düşük'
departman?: string
kategori?: string
etkilenen?: string
bildiren?: string
acilisTarihi?: string  // ISO date
```

Yeni type'lar:

```typescript
interface ProblemTarihce {
  id: string
  problemId: string
  alan: string
  eskiDeger: string | null
  yeniDeger: string | null
  degistiren: string
  tarih: string
}

interface ProblemYorum {
  id: string
  problemId: string
  icerik: string
  yazan: string
  tarih: string
}
```

### Görev 1.5 — Store Genişletmesi

`useStore`'a `pt_tarihce` ve `pt_yorumlar` tabloları için fetch/reload eklenecek (mevcut `pt_problemler` pattern'i takip).

### Görev 1.6 — RBAC Permission'ları

`permissions.ts`'e eklenecek action'lar:
- `pt_yorum_ekle` (yorum yazma)
- `pt_yorum_sil` (yorum silme)
- `pt_tarihce_goruntule` (audit trail görme)

Mevcut rol matrisine atama yapılacak (Buket onaylayacak).

---

## FAZ 2 — UI: FORM + TABLO + KPI

### Görev 2.1 — KPI 4. Kart

Mevcut 3 karta (Toplam, Açık/Devam, Geciken) **"Kritik / Yüksek"** kartı eklenecek:

```typescript
kritik: problemler.filter(p => p.oncelik === 'Kritik' || p.oncelik === 'Yüksek').length
```

`grid-cols-3` → `grid-cols-4`. Renk: amber (`text-amber`).

### Görev 2.2 — Filtre Çubuğuna 2 Yeni Dropdown

**Departman filtresi:** DATA'dan dinamik üretilecek (mevcut Netlify pattern'i).

**Öncelik filtresi:** Sabit 4 seçenek + "Tümü".

### Görev 2.3 — Tabloya 2 Yeni Sütun

Mevcut sütunlar: `#`, `Problem`, `Termin`, `Sorumlu`, `Durum`, `Son Değişiklik`, `Aksiyon`.

Eklenecek (`Problem` ile `Termin` arasına):
- **Departman** — pill rozet (mavi tonu, `bg-accent/15`)
- **Öncelik** — renkli badge:
  - Kritik: `bg-red/15 text-red`
  - Yüksek: `bg-amber/15 text-amber`
  - Orta: `bg-amber/10 text-amber/80`
  - Düşük: `bg-green/15 text-green`

### Görev 2.4 — Sortable Tablo Başlıkları

Tüm sütun başlıkları tıklanabilir olacak. Tıklanan sütuna göre sıralama (artan/azalan, ↑/↓ ikonu). 

**Önemli:** Mevcut akıllı sıralama (geciken üstte → durum → termin) **default** olarak kalacak. Kullanıcı bir başlığa tıklarsa o sütuna göre sıralanacak; tekrar tıklayınca yön değişecek; üçüncü tıklamada default'a dönecek.

### Görev 2.5 — Form Modal'a Yeni Alanlar

`ProblemFormModal` component'i genişletilecek:

**Yeni alan grubu (Problem Tanımı'nın altına, 3 sütunlu grid):**
1. **Departman** (zorunlu, dropdown — 10 seçenek)
2. **Kategori** (dropdown — 8 seçenek)
3. **Öncelik** (dropdown — 4 seçenek, default "Orta")

**Mevcut "Termin / Sorumlu / Durum" satırının üstüne:**
4. **Bildirim Yapan** (text input)
5. **Etkilenen Ürün/Süreç** (dropdown — 7 seçenek)
6. **Açılış Tarihi** (date — yeni kayıtta default bugün, düzenlemede mevcut değer)

**Kabul kriteri:** Yeni alanlar form state'e bağlanır, kayıt edildiğinde `save()` fonksiyonu bunları payload'a ekler.

### Görev 2.6 — Sabitler/Dropdown Listeleri

`ProblemTakip.tsx` üst kısmına (veya `@/lib/constants` altına) eklenecek:

```typescript
const ONCELIK_OPTIONS = ['Kritik', 'Yüksek', 'Orta', 'Düşük']
const DEPARTMAN_OPTIONS = [
  'Üretim', 'Üretim Planlama', 'ARGE', 'Lojistik', 'Kalite',
  'Satış', 'İnsan Kaynakları', 'Finans', 'Çevre / İSG', 'Diğer'
]
const KATEGORI_OPTIONS = [
  'Süreç', 'Kalite', 'Sistem', 'Donanım',
  'İnsan Kaynağı', 'Tedarikçi', 'Müşteri', 'Diğer'
]
const ETKILENEN_OPTIONS = [
  'Üretim', 'Üretim Planlama', 'Kalite', 'Lojistik',
  'Satış', 'Tüm Süreçler', 'Diğer'
]
```

---

## FAZ 3 — DEĞİŞİKLİK GEÇMİŞİ + YORUM

### Görev 3.1 — Modal'a Sekme Sistemi

Mevcut tek-pane modal, **3 sekmeli** yapıya dönüştürülecek:
1. **Form** (mevcut form, default sekme)
2. **Değişiklik Geçmişi** (sadece düzenleme modunda görünür)
3. **Açıklamalar** (sadece düzenleme modunda görünür)

Tab navigation Tailwind ile (mevcut UYS pattern'lerine uygun).

### Görev 3.2 — Değişiklik Geçmişi Sekmesi

Görsel: Eski değer (üstü çizili kırmızı) → Yeni değer (yeşil) + alan adı + 👤 değiştiren · 🕐 tarih.

`pt_tarihce` tablosundan `problem_id` filtresi ile çekilir, `tarih DESC` sıralı.

Alan label mapping objesi gerekli (örn. `acilis_tarihi` → "Açılış Tarihi").

**RBAC:** `pt_tarihce_goruntule` yetkisi olanlar görür.

### Görev 3.3 — `save()` Fonksiyonunda Diff/Audit

Düzenleme modunda kaydetmeden önce:
- Eski kaydı (`editItem`) ile yeni payload karşılaştır
- 13 izlenen alandan değişen her biri için `pt_tarihce`'ye INSERT
- `pt_problemler` UPDATE'i ardından

**Kabul kriteri:** Aynı kayıt 2 kere kaydedilse bile, hiç değişiklik yoksa `pt_tarihce`'ye satır eklenmez.

### Görev 3.4 — Açıklamalar (Yorum) Sekmesi

Chat bubble görünümü:
- Üst: yorum listesi (eskiden yeniye, scroll)
- Alt: textarea + "Gönder" butonu (yazan = otomatik `user.username`)
- Her bubble'da: 👤 yazan · tarih + (yetki varsa) 🗑 sil butonu

Realtime ile yeni yorumlar otomatik gelmeli (`CLIENT_ID` ile kendi gönderdiğini de görür).

**RBAC:** `pt_yorum_ekle` ile ekler, `pt_yorum_sil` ile siler. Sadece kendi yorumunu silme kuralı isteniyorsa Buket'e sor (mevcut Netlify'da herkes herkesinkini siliyor).

---

## FAZ 4 — EXCEL I/O

### Görev 4.1 — Excel Export

Header'a "Excel'e Aktar" butonu eklenecek.

Çıkış sütunları (Türkçe başlık):
```
No | Açılış Tarihi | Bildirim Yapan | Departman | Kategori |
Problem Tanımı | Etkilenen | Öncelik | Durum | Yapılanlar |
Sorumlu | Termin | Kapatma Tarihi | Notlar | Son Değiştiren |
Değiştirme Tarihi | Oluşturan | Oluşturma Tarihi
```

Dosya adı: `OzlerProblemTakip_DDMMYYYY.xlsx` (Türkçe tarih formatı).

Kütüphane: `xlsx` (SheetJS — UYS v3'te zaten kullanılıyorsa onu, yoksa kur).

### Görev 4.2 — Excel Import

Header'a "Excel Yükle" butonu eklenecek.

Mantık:
1. RBAC: `pt_add` yetkisi olmayan göremez
2. Kullanıcı dosya seçer
3. Şifre **SORULMAYACAK** (RBAC zaten yetki kontrolü yapıyor — Netlify'daki şifre korumasının yerine)
4. İlk satırda "No" kolonunu ara → başlık satırını bul
5. Her satırı parse et → `pt_problemler`'e batch INSERT
6. `olusturan` = mevcut kullanıcı, `olusturma` = now()
7. Boş zorunlu alanlı (problem/departman) satırları atla, kullanıcıya kaç satır atlandığını bildir

**Kabul kriteri:** 50+ satırlık örnek Excel sorunsuz yüklenir, atılan satır sayısı toast ile bildirilir.

---

## GENEL UYARILAR (TÜM FAZLAR İÇİN)

1. **Realtime:** Tüm INSERT/UPDATE/DELETE işlemlerinde `__client: CLIENT_ID` payload'a eklenmeli (mevcut pattern).

2. **Toast:** Başarı/hata mesajları için her zaman `sonner`'in `toast.success` / `toast.error` kullanılacak. Native `alert` yasak.

3. **Confirmation:** Silme işlemleri için `showConfirm` kullanılacak (`@/lib/prompt`).

4. **TypeScript Strict:** `any` kullanma; `Record<string, unknown>` veya açık tip tanımları tercih et.

5. **Test:** Her faz sonunda Playwright E2E testi eklenmeli (UYS v3'te mevcut `test/e2e/` klasöründeki pattern'i takip et — test Supabase: `cowgxwmhlogmswatbltz`).

6. **Migration dosyaları:** `supabase/migrations/` altına timestamp prefix ile (örn. `20260425120000_pt_phase1_columns.sql`).

7. **Audit script:** Her faz sonunda `audit-schema.cjs` çalıştırıp şema-kod uyumunu kontrol et (prebuild hook zaten var).

8. **Commit hijyeni:** Her görev ayrı commit, faz sonunda tag (örn. `v15.17.0` Faz 1, `v15.18.0` Faz 2 vs.).

---

## ÖNCELİK SIRASI (TARTIŞMASIZ)

```
Faz 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
   ↓
Faz 2.6 → 2.5 → 2.3 → 2.2 → 2.1 → 2.4
   ↓
Faz 3.1 → 3.2 → 3.3 → 3.4
   ↓
Faz 4.1 → 4.2
```

Her faz tamamlanmadan sonraki faza geçilmeyecek. Her görev tek başına test edilebilir/deploy edilebilir olmalı.

---

## ÇIKTI BEKLENTİSİ

Her görev için diğer chat'in üretmesi gerekenler:
- Etkilenen dosyaların **tam içeriği** (yamalar değil)
- Migration SQL dosyaları (oluşturulacaksa)
- Playwright testi (varsa)
- Commit mesajı önerisi
- Release notu satırı (CHANGELOG için)

Başla.
