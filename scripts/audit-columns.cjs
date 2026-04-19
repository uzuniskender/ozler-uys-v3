#!/usr/bin/env node
/**
 * Column Audit — Kodda supabase.from().insert/update çağrılarında
 * kullanılan kolon adlarını DB şemasıyla karşılaştırır.
 *
 * Supabase'in "silent reject" davranışını (var olmayan kolon sessizce
 * yok sayılır) deploy öncesi yakalamak için.
 *
 * Çalıştırma:
 *   npm run audit:columns
 *
 * 17 Nisan 2026 bug'ı için örnek:
 *   Kod:  .insert({ ..., kaynak: 'uretim' })
 *   DB:   uys_stok_hareketler'de 'kaynak' kolonu yok
 *   Sonuç: Supabase sessizce reject etti, üretim stok kaybı oldu.
 *
 * Bu audit deploy öncesi çalışırsa bu tür bug'lar üretim hattına ulaşmaz.
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// camelToSnake converter — DataManagement.tsx'teki mantıkla aynı
const SPECIAL_CAMEL_TO_SNAKE = {
  'not': 'not_',
  'tedarikcId': 'tedarikci_id',
  'tedarikcAd': 'tedarikci_ad',
}
function camelToSnake(s) {
  if (SPECIAL_CAMEL_TO_SNAKE[s]) return SPECIAL_CAMEL_TO_SNAKE[s]
  return s.replace(/([A-Z])/g, '_$1').toLowerCase()
}

// Supabase'in sessizce kabul ettiği "auto" kolonlar (her tabloda var olabilir)
const SYSTEM_COLUMNS = new Set(['id', 'updated_at', 'created_at'])

// ═══════════════════════════════════════════════════════════════
// 1) DB KOLONLARINI PARSE ET
// ═══════════════════════════════════════════════════════════════
function readTableColumns() {
  const dir = path.join(ROOT, 'sql')
  const tables = {} // { tablo_adi: Set<kolon_adi> }
  if (!fs.existsSync(dir)) return tables

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'))
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8')
    // CREATE TABLE IF NOT EXISTS public.xxx ( ... );
    const tableRegex = /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\(([\s\S]*?)\n\s*\);/g
    let m
    while ((m = tableRegex.exec(content)) !== null) {
      const [, tableName, body] = m
      if (!tables[tableName]) tables[tableName] = new Set()
      // Her satırda ilk kelime kolon adı (sadece belirteç satırları için)
      const lines = body.split('\n')
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('--')) continue
        if (line.toUpperCase().startsWith('CONSTRAINT') ||
            line.toUpperCase().startsWith('PRIMARY KEY') ||
            line.toUpperCase().startsWith('FOREIGN KEY') ||
            line.toUpperCase().startsWith('UNIQUE')) continue
        // Kolon adı: alt çizgi / harfle başlayan ilk kelime
        const colMatch = line.match(/^([a-z_][a-z0-9_]*)/i)
        if (colMatch) tables[tableName].add(colMatch[1])
      }
    }

    // ALTER TABLE public.xxx ADD COLUMN ..., ADD COLUMN ..., ...
    // Önce ALTER TABLE bloklarını bul, sonra içindeki tüm ADD COLUMN'ları ayrı ayrı yakala
    const alterBlockRegex = /ALTER TABLE[^;]*public\.(\w+)([^;]+?);/gi
    while ((m = alterBlockRegex.exec(content)) !== null) {
      const [, tableName, body] = m
      if (!tables[tableName]) tables[tableName] = new Set()
      const addRegex = /ADD COLUMN(?:\s+IF NOT EXISTS)?\s+(\w+)/gi
      let a
      while ((a = addRegex.exec(body)) !== null) {
        tables[tableName].add(a[1])
      }
    }
  }
  return tables
}

// ═══════════════════════════════════════════════════════════════
// 2) KODDAKİ insert/update/upsert ÇAĞRILARINI TARA
// ═══════════════════════════════════════════════════════════════
function scanDir(dir, ext) {
  const out = []
  function walk(p) {
    for (const f of fs.readdirSync(p)) {
      const full = path.join(p, f)
      const st = fs.statSync(full)
      if (st.isDirectory()) walk(full)
      else if (f.endsWith(ext[0]) || f.endsWith(ext[1])) out.push(full)
    }
  }
  walk(dir)
  return out
}

/**
 * {...} bloğunun sonunu bulur (balanced), stringleri ve regex'i atlar.
 * openIdx: '{' karakterinin indeksi
 * Returns: closing '}' indeksi veya -1
 */
function findMatchingBrace(src, openIdx) {
  let depth = 0
  let inStr = false
  let strChar = ''
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]
    const prev = i > 0 ? src[i-1] : ''
    if (inStr) {
      if (ch === strChar && prev !== '\\') inStr = false
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return i }
  }
  return -1
}

// JavaScript literal/reserved değerler — shorthand sayılmamalı
const JS_LITERALS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'await', 'new', 'typeof', 'void', 'this', 'super',
])

/**
 * Bir object literal'in TOP-LEVEL key'lerini çıkarır.
 * body: '{' ve '}' arası içerik (dışındakiler dahil değil)
 */
function extractTopLevelKeys(body) {
  const keys = new Set()
  let depth = 0
  let inStr = false
  let strChar = ''
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    const prev = i > 0 ? body[i-1] : ''
    if (inStr) {
      if (ch === strChar && prev !== '\\') inStr = false
      i++; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; i++; continue }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; i++; continue }
    if (ch === '}' || ch === ']' || ch === ')') { depth--; i++; continue }
    if (depth === 0) {
      // Spread operator: ...ident → key değil, atla
      if (ch === '.' && body.slice(i, i+3) === '...') {
        i += 3
        while (i < body.length && /[a-zA-Z0-9_$]/.test(body[i])) i++
        continue
      }
      if (/[a-zA-Z_$]/.test(ch)) {
        let j = i
        while (j < body.length && /[a-zA-Z0-9_$]/.test(body[j])) j++
        const ident = body.slice(i, j)
        let k = j
        while (k < body.length && /\s/.test(body[k])) k++
        const nextCh = body[k]
        // Full key: `ident:`
        if (nextCh === ':') {
          if (!JS_LITERALS.has(ident)) keys.add(ident)
          // Value'yu atla — sonraki top-level `,` veya `}` bul
          i = skipValue(body, k + 1)
          continue
        }
        // Shorthand: `ident,` veya `ident}` veya satır sonunda `ident\n,`
        // AMA: Literal ise (true, false, null) atla
        // SCREAMING_CASE (ALL_UPPER veya UPPER_UNDER) muhtemelen sabit/değişken, shorthand key değil
        const isScreamingCase = /^[A-Z][A-Z0-9_]*$/.test(ident)
        if ((nextCh === ',' || nextCh === '}' || k >= body.length) &&
            !JS_LITERALS.has(ident) &&
            !isScreamingCase) {
          keys.add(ident)
          i = k + 1; continue
        }
        i = j; continue
      }
      if (ch === '"' || ch === "'") {
        const end = body.indexOf(ch, i + 1)
        if (end > 0) {
          const str = body.slice(i + 1, end)
          let k = end + 1
          while (k < body.length && /\s/.test(body[k])) k++
          if (body[k] === ':') {
            keys.add(str)
            i = skipValue(body, k + 1)
            continue
          }
          i = end + 1; continue
        }
      }
    }
    i++
  }
  return keys
}

/**
 * body'de startIdx'ten başlayarak bir VALUE'yu atla,
 * bir sonraki top-level `,` veya `}` pozisyonunu döndür.
 * String literal, template literal, nested obj/array/paren atlanır.
 */
function skipValue(body, startIdx) {
  let depth = 0
  let inStr = false
  let strChar = ''
  let i = startIdx
  while (i < body.length) {
    const ch = body[i]
    const prev = i > 0 ? body[i-1] : ''
    if (inStr) {
      if (ch === strChar && prev !== '\\') inStr = false
      i++; continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; i++; continue }
    if (ch === '{' || ch === '[' || ch === '(') { depth++; i++; continue }
    if (ch === '}' || ch === ']' || ch === ')') {
      if (depth === 0) return i
      depth--; i++; continue
    }
    if (depth === 0 && ch === ',') return i + 1
    i++
  }
  return i
}

function extractUsages() {
  const usages = []
  const files = scanDir(path.join(ROOT, 'src'), ['.ts', '.tsx'])

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    // supabase.from('tablo') yakalanır
    const fromRegex = /supabase\s*\.\s*from\s*\(\s*['"]([a-z_]+)['"]\s*\)/g
    let m
    while ((m = fromRegex.exec(content)) !== null) {
      const table = m[1]
      // Bu `from()` sonrası METHOD chain'ini tara
      // Bir sonraki `supabase.from` veya dosya sonuna kadar
      const startAfterFrom = m.index + m[0].length
      const nextFromRegex = /supabase\s*\.\s*from\s*\(/g
      nextFromRegex.lastIndex = startAfterFrom
      const nextFromMatch = nextFromRegex.exec(content)
      const nextFrom = nextFromMatch ? nextFromMatch.index : -1
      const chainEnd = nextFrom > 0 ? nextFrom : content.length
      const chainSlice = content.slice(startAfterFrom, chainEnd)

      // Zincirde .insert({...}) / .update({...}) / .upsert({...}) ara
      const callRegex = /\.(insert|update|upsert)\s*\(/g
      let c
      while ((c = callRegex.exec(chainSlice)) !== null) {
        const kind = c[1]
        // `(` sonrası ilk non-whitespace karakter `{` mi?
        let p = c.index + c[0].length
        while (p < chainSlice.length && /\s/.test(chainSlice[p])) p++
        if (chainSlice[p] !== '{') continue // Değişken adı iletilmiş, object literal değil

        // Balanced `{...}` bul
        const absOpen = startAfterFrom + p
        const absClose = findMatchingBrace(content, absOpen)
        if (absClose < 0) continue
        const body = content.slice(absOpen + 1, absClose)
        const keys = extractTopLevelKeys(body)
        if (keys.size > 0) {
          usages.push({
            file: path.relative(ROOT, file),
            table, kind,
            cols: [...keys],
          })
        }
      }
    }
  }
  return usages
}

// ═══════════════════════════════════════════════════════════════
// 3) KARŞILAŞTIR
// ═══════════════════════════════════════════════════════════════
function main() {
  console.log('')
  console.log('\x1b[1m╔════════════════════════════════════════════════════════════╗\x1b[0m')
  console.log('\x1b[1m║       UYS v3 — KOD/DB KOLON AUDIT (silent reject önleme)   ║\x1b[0m')
  console.log('\x1b[1m╚════════════════════════════════════════════════════════════╝\x1b[0m')
  console.log('')

  const dbTables = readTableColumns()
  const usages = extractUsages()

  const tableCount = Object.keys(dbTables).length
  const colCount = Object.values(dbTables).reduce((a, s) => a + s.size, 0)
  console.log(`📦 DB şeması: ${tableCount} tablo, toplam ${colCount} kolon`)
  console.log(`🔍 Kod taraması: ${usages.length} insert/update/upsert çağrısı bulundu`)
  console.log('')

  const issues = []
  for (const u of usages) {
    if (!dbTables[u.table]) {
      issues.push({ ...u, problem: 'unknown_table' })
      continue
    }
    const dbCols = dbTables[u.table]
    for (const codeCol of u.cols) {
      // camelCase ise snake_case dönüştür
      const snake = codeCol.includes('_') ? codeCol : camelToSnake(codeCol)
      if (!dbCols.has(snake) && !SYSTEM_COLUMNS.has(snake)) {
        issues.push({ ...u, problem: 'unknown_column', codeCol, expectedCol: snake })
      }
    }
  }

  if (issues.length === 0) {
    console.log('\x1b[32m\x1b[1m✓ TEMİZ — Her insert/update/upsert çağrısındaki kolonlar DB ile uyumlu.\x1b[0m')
    console.log('')
    process.exit(0)
  }

  console.log(`\x1b[31m🔴 ${issues.length} SORUN BULUNDU:\x1b[0m`)
  console.log('')

  // Gruplandır: önce tabloya göre
  const byTable = {}
  for (const i of issues) {
    byTable[i.table] = byTable[i.table] || []
    byTable[i.table].push(i)
  }

  for (const [table, list] of Object.entries(byTable)) {
    console.log(`\x1b[33m  ▸ ${table}\x1b[0m`)
    for (const i of list) {
      if (i.problem === 'unknown_table') {
        console.log(`    ❌ Bilinmeyen tablo (DB şemasında yok) — ${i.file}`)
      } else {
        const hint = i.codeCol !== i.expectedCol
          ? ` (${i.codeCol} → aranan DB kolonu: ${i.expectedCol})`
          : ''
        console.log(`    ❌ Kolon yok: '${i.expectedCol}'${hint} — ${i.file} [${i.kind}]`)
      }
    }
    console.log('')
  }

  console.log('\x1b[31m\x1b[1m✗ AUDIT BAŞARISIZ — Silent reject riski var.\x1b[0m')
  console.log('   ↪ Bu kolonlar DB\'de yok, insert/update sessizce yok sayılacak.')
  console.log('   ↪ Ya kolonu DB\'ye ekle (ALTER TABLE), ya da koddan çıkar.')
  console.log('')
  process.exit(1)
}

main()
