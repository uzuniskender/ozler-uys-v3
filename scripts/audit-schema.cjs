#!/usr/bin/env node
/**
 * Schema Audit — DB şemasındaki tablolarla kod tarafındaki tablo listelerini karşılaştırır.
 *
 * Çalıştırma:
 *   npm run audit
 *
 * Kontrol edilen listeler:
 *   1. DataManagement.tsx → `tables` listesi (export/import için)
 *   2. store/index.ts    → `TABLE_MAP` (loadAll + realtime için)
 *
 * Script bir veya daha fazla uyumsuzluk bulursa EXIT CODE 1 ile biter.
 * Deploy öncesi CI'de veya lokal terminalde çalıştırılabilir.
 *
 * "Bilerek listede olmayan" tablolar whitelist ile korunur (aşağıya bakın).
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// ═══════════════════════════════════════════════════════════════
// Whitelist — komponent-local state olarak yönetilen, global store'da
// olmasına gerek olmayan tablolar. Bunları audit "eksik" saymaz.
// ═══════════════════════════════════════════════════════════════
const STORE_WHITELIST = new Set([
  'uys_notes',          // HelpNotesButtons komponenti kendi çekiyor
  'uys_yetki_ayarlari', // useAuth kendi çekiyor
  'uys_chat_channels',    // ÖzlerMsg v1 — Chat.tsx kendi fetch ediyor, realtime subscription var
  'uys_chat_members',     // ÖzlerMsg v1
  'uys_chat_messages',    // ÖzlerMsg v1 — çok büyük tablo, global state'e yüklenmemeli
  'uys_chat_mentions',    // ÖzlerMsg v1
  'uys_chat_reactions',   // ÖzlerMsg v1
  'uys_chat_attachments', // ÖzlerMsg v1
  'uys_v15_31_silinen_hareketler', // v15.31 bar model göç audit — runtime'da kullanılmaz, kanıt amaçlı
  'uys_mrp_calculations', // v15.47 — MRP run snapshot, Faz 3'te (v15.49) MRP modal yazınca dolacak. Şu an global state'e gerek yok; modal kendi fetch edecek.
])

// DataManagement backup'a dahil etmesi gerekmeyen tablolar.
// Örn: yalnızca göç/audit amaçlı, ömürlük tek-seferlik kayıtlar.
// Veya: hesaplanabilen snapshot/cache tabloları (yedeği tutmaya gerek yok).
const DATA_MGMT_WHITELIST = new Set([
  'uys_v15_31_silinen_hareketler', // v15.31 göç audit — tek seferlik, backup zorunlu değil
  'uys_mrp_calculations',          // v15.47 — MRP run snapshot, yeniden hesaplanabilir, backup gereksiz
])

// ═══════════════════════════════════════════════════════════════
// SCHEMA — DB'deki tüm tabloları topla (master + diğer SQL dosyaları)
// ═══════════════════════════════════════════════════════════════
function readSchemaTables() {
  const dir = path.join(ROOT, 'sql')
  const tables = new Set()
  if (!fs.existsSync(dir)) return tables
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'))
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8')
    const matches = content.matchAll(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g)
    for (const m of matches) tables.add(m[1])
  }
  return tables
}

// ═══════════════════════════════════════════════════════════════
// KOD — DataManagement.tsx'teki `tables` listesi
// ═══════════════════════════════════════════════════════════════
function readDataManagementTables() {
  const content = fs.readFileSync(path.join(ROOT, 'src/pages/DataManagement.tsx'), 'utf-8')
  // `tables` dizisini yalıtla — ilk `const tables = [` sonrası
  const start = content.indexOf('const tables = [')
  if (start < 0) return new Set()
  const end = content.indexOf(']', start)
  const slice = content.slice(start, end)
  const tables = new Set()
  const matches = slice.matchAll(/table:\s*['"]([a-z_]+)['"]/g)
  for (const m of matches) tables.add(m[1])
  return tables
}

// ═══════════════════════════════════════════════════════════════
// KOD — store/index.ts'deki TABLE_MAP
// ═══════════════════════════════════════════════════════════════
function readStoreTables() {
  const content = fs.readFileSync(path.join(ROOT, 'src/store/index.ts'), 'utf-8')
  const start = content.indexOf('export const TABLE_MAP')
  if (start < 0) return new Set()
  const end = content.indexOf(']', start)
  const slice = content.slice(start, end)
  const tables = new Set()
  const matches = slice.matchAll(/table:\s*['"]([a-z_]+)['"]/g)
  for (const m of matches) tables.add(m[1])
  return tables
}

// ═══════════════════════════════════════════════════════════════
// RAPOR
// ═══════════════════════════════════════════════════════════════
function sortedArray(set) {
  return [...set].sort()
}

function main() {
  console.log('')
  console.log('\x1b[1m╔════════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║            UYS v3 — SCHEMA/KOD AUDIT                       ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════════════════════════╝\x1b[0m')
  console.log('')

  const schema = readSchemaTables()
  const dm = readDataManagementTables()
  const store = readStoreTables()

  if (schema.size === 0) {
    console.error('\x1b[31m❌ Schema dosyaları bulunamadı (master_schema.sql vs.). Audit yapılamıyor.\x1b[0m')
    process.exit(2)
  }

  console.log(`📦 DB şeması:             ${schema.size} tablo`)
  console.log(`💾 DataManagement tables: ${dm.size} tablo`)
  console.log(`🗄️  Store TABLE_MAP:       ${store.size} tablo (whitelist: ${STORE_WHITELIST.size})`)
  console.log('')

  let errors = 0

  // 1. DataManagement eksikleri (backup/restore için kritik)
  const dmMissing = sortedArray(new Set([...schema].filter(t => !dm.has(t) && !DATA_MGMT_WHITELIST.has(t))))
  if (dmMissing.length > 0) {
    console.log('\x1b[31m🔴 DataManagement `tables` listesinde EKSİK:\x1b[0m')
    dmMissing.forEach(t => console.log(`   ${t}`))
    console.log('   ↪ Bu tablolar JSON backup/restore dışında kalıyor.')
    console.log('   ↪ Fix: src/pages/DataManagement.tsx `tables` listesine ekle.')
    console.log('   ↪ Eger bilerek backup disinda tutuluyorsa scripts/audit-schema.cjs')
    console.log('     icindeki DATA_MGMT_WHITELIST listesine ekle.')
    console.log('')
    errors++
  } else {
    console.log('✅ DataManagement backup/restore: tamam')
  }

  // 2. Store TABLE_MAP eksikleri (loadAll + realtime için kritik)
  const storeMissing = sortedArray(
    new Set([...schema].filter(t => !store.has(t) && !STORE_WHITELIST.has(t)))
  )
  if (storeMissing.length > 0) {
    console.log('\x1b[31m🔴 Store TABLE_MAP listesinde EKSİK:\x1b[0m')
    storeMissing.forEach(t => console.log(`   ${t}`))
    console.log('   ↪ Bu tablolar loadAll tarafından çekilmiyor, realtime da dinlenmiyor.')
    console.log('   ↪ Fix: src/store/index.ts TABLE_MAP dizisine ekle (mapper lazım).')
    console.log('   ↪ Eger bilerek global state disinda tutuluyorsa scripts/audit-schema.cjs')
    console.log('     icindeki STORE_WHITELIST listesine ekle.')
    console.log('')
    errors++
  } else {
    console.log('✅ Store TABLE_MAP: tamam')
  }

  // 3. Kodda var ama şemada yok (yazım hatası)
  const dmPhantom = sortedArray(new Set([...dm].filter(t => !schema.has(t))))
  const storePhantom = sortedArray(new Set([...store].filter(t => !schema.has(t))))
  if (dmPhantom.length > 0 || storePhantom.length > 0) {
    console.log('\x1b[33m⚠ Kodda var ama şemada YOK (yazım hatası olabilir):\x1b[0m')
    const all = new Set([...dmPhantom, ...storePhantom])
    all.forEach(t => {
      const places = []
      if (dmPhantom.includes(t)) places.push('DataManagement')
      if (storePhantom.includes(t)) places.push('Store')
      console.log(`   ${t}  (${places.join(', ')})`)
    })
    console.log('')
    errors++
  }

  console.log('')
  if (errors === 0) {
    console.log('\x1b[32m\x1b[1m✓ AUDIT BAŞARILI — Tüm listeler şemayla uyumlu.\x1b[0m')
    console.log('')
    process.exit(0)
  } else {
    console.log(`\x1b[31m\x1b[1m✗ AUDIT BAŞARISIZ — ${errors} sorun bulundu.\x1b[0m`)
    console.log('   ↪ Deploy oncesi duzelt veya whitelist ekle.')
    console.log('')
    process.exit(1)
  }
}

main()
