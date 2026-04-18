# UYS v3 — Playwright E2E Testleri

## İlk Kurulum

```bash
# 1) Playwright paketleri (package.json'da zaten var, sadece tarayıcıyı indir)
npm install
npx playwright install chromium

# 2) Test Supabase'i ayarla
cp .env.test.example .env.test
# .env.test'i aç, URL + anon key'i gir (test Supabase'inden)

# 3) Test DB'yi kur (bir kerelik)
#    Supabase Dashboard > ozler-uys-test > SQL Editor > TEST_DB_SETUP.sql'i yapıştır, Run
```

## Çalıştırma

```bash
# Tüm testler (headless)
npm run test:e2e

# UI mode — tek tek test çalıştır, kodla senkron izle
npm run test:e2e:ui

# Rapor göster
npm run test:e2e:report

# Sadece bir spec
npx playwright test tests/e2e/specs/01-auth.spec.ts

# Manuel cleanup — Supabase'deki TEST-E2E-* kayıtları sil
npm run test:e2e:cleanup
```

## Yapı

```
tests/e2e/
├── fixtures.ts              # Her test öncesi/sonrası otomatik cleanup
├── run-cleanup.ts           # Global teardown + manuel cleanup script
├── helpers/
│   ├── auth.ts              # loginAs(role) — localStorage/sessionStorage bypass
│   ├── cleanup.ts           # TEST-E2E-* kayıtları sil (FK sırasına göre)
│   ├── factory.ts           # createTestOperator, createIndependentHammaddeWO, ...
│   └── supabase.ts          # Server-side test Supabase client (canlı guard'lı)
└── specs/
    ├── 01-auth.spec.ts      # 4 rol login + RBAC
    ├── 02-ie-stok-kontrol.spec.ts  # v15.10 regression
    └── 03-mesaj-acil.spec.ts       # v15.11 + v15.12 regression
```

## Güvenlik Kuralları

- **Tüm test verisi `TEST-E2E-` prefix'i ile başlar** — temizleme kriteri budur
- `helpers/supabase.ts` canlı Supabase URL'ine bağlanmayı engeller (hardcoded guard)
- Her test öncesi + sonrası otomatik temizlik → kirlilik birikmesin
- Paralel çalışma kapalı (workers: 1) — şimdilik güvenli taraf

## Yeni Test Yazma

```ts
import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'
import { createTestOperator } from '../helpers/factory'

test('senaryo açıklaması', async ({ page }) => {
  // 1) Hazırlık — factory ile data oluştur
  const opr = await createTestOperator({ ad: 'Ali' })

  // 2) Oturum
  await loginAs(page, 'admin')
  await page.goto('/#/messages')

  // 3) Doğrulama
  await expect(page.locator(`text=${opr.ad}`).first()).toBeVisible()
})
```

## Yaygın Sorunlar

| Sorun | Çözüm |
|---|---|
| `VITE_SUPABASE_URL eksik` | `.env.test` oluştur (`cp .env.test.example .env.test`) |
| `CANLI SUPABASE TESPIT EDİLDİ` | .env.test'deki URL canlı projeye ayarlanmış — değiştir |
| Testler timeout'a düşüyor | `npm run dev:test` ile server manuel aç, tarayıcıda `/` çalışıyor mu kontrol |
| "relation ... does not exist" | `TEST_DB_SETUP.sql` test Supabase'de çalıştırılmamış |
| Her çalıştırmada yeni kalıntı | `npm run test:e2e:cleanup` ile manuel temizle, sonra hata nedenini bul |

## CI (Faz 3 — ileride)

`.github/workflows/e2e.yml` ile PR başına çalıştırma. GitHub Secrets:
- `VITE_SUPABASE_URL` (test)
- `VITE_SUPABASE_ANON_KEY` (test)
