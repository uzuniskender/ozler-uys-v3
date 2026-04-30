// scripts/saglik-syntax-check.cjs
// v16.15 — Patch hijyen koruması (Bilgi Bankası §27.7-§27.8)
// 30 Nis 2026 sabahında "recipes" tipo bug'ı 3 kere ortaya çıktı:
//   v16.00: düzeltildi → v16.03 Claude Code eski snapshottan başlattı, fix kayboldu
//   v16.13: ben düzelttim → v16.14 sentinel #16+#17 geri eklerken aynı tehlike vardı
// Bu prebuild check, aynı kazanın bir daha olmasını yapısal olarak engeller.
//
// Çalıştığı yer: package.json prebuild hook (audit-schema.cjs ve audit-columns.cjs ile birlikte)
// Build geçmesi için iki şartı sağlamalı:
//   1. DataManagement.tsx içinde kontroller.push({ no: N, ... }) sayısı >= 17
//   2. DataManagement.tsx içinde "recipes" kelimesi kod referansı olarak (yorum + string sabiti hariç) yok

const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'pages', 'DataManagement.tsx')
const MIN_KONTROL = 17

if (!fs.existsSync(file)) {
  console.error('[saglik-syntax-check] HATA: DataManagement.tsx bulunamadi: ' + file)
  process.exit(1)
}

const src = fs.readFileSync(file, 'utf8')
const lines = src.split('\n')

// 1. kontroller.push sayisini say
const kontrolCount = (src.match(/kontroller\.push\(\{/g) || []).length
if (kontrolCount < MIN_KONTROL) {
  console.error('[saglik-syntax-check] FAIL: kontroller.push sayisi ' + kontrolCount + ' < ' + MIN_KONTROL)
  console.error('  Bu, Saglik Raporu kontrollerinin kazara silindigi anlamina gelir.')
  console.error('  Ornek: v16.12 patch hatasiyla #16 ve #17 sentinellerinin silinmesi (30 Nis 2026).')
  console.error('  Yapmanız gereken: docs/UYS_v3_Bilgi_Bankasi.md §27.7 patch hijyen kuralini takip et.')
  console.error('  Mevcut kontrol sayisi git history uzerinden geri alinmali.')
  process.exit(1)
}

// 2. recipes kelimesi kod referansi olarak (yorum + string sabiti haric) yok
// Yorumlari (// ...) ve string literallari ('...' veya "...") cikar, geri kalanda recipes ara
let cleanedLines = []
for (let i = 0; i < lines.length; i++) {
  let line = lines[i]
  // Tek satirlik yorumu kaldir
  const commentIdx = line.indexOf('//')
  if (commentIdx >= 0) line = line.substring(0, commentIdx)
  // String literalleri kaldir (basit: tek/cift tirnak arasi)
  line = line.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``')
  cleanedLines.push({ no: i + 1, text: line })
}

const kotuRecipes = []
const recipesRe = /\brecipes\b/
for (const { no, text } of cleanedLines) {
  if (recipesRe.test(text)) {
    kotuRecipes.push({ no, text: text.trim() })
  }
}

if (kotuRecipes.length > 0) {
  console.error('[saglik-syntax-check] FAIL: DataManagement.tsx icinde "recipes" kod referansi bulundu (yorum/string disinda).')
  console.error('  hesaplaMRP icindeki yerel degisken adi "recs" — "recipes" yazimi v16.00\'da duzeltildi.')
  console.error('  v16.13\'te ayni tipo geri geldi cunku patch eski snapshot\'tan basladi.')
  console.error('  Asagidaki satirlari "recs" olarak duzeltin:')
  kotuRecipes.forEach(r => console.error('    Satir ' + r.no + ': ' + r.text))
  process.exit(1)
}

console.log('[saglik-syntax-check] OK: ' + kontrolCount + ' kontrol, "recipes" yanlis kullanim yok.')
