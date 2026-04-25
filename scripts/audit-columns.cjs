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
 *
 * ÜYSREV2 (v15.29 enhancement):
 *   - .insert([{...}]) array literal desteği
 *   - .insert(varName) değişken trace (const/let/var, .push, .map)
 *   - Scope-aware: en yakın prior assignment kullanılır
 *   - Untraced çağrılar WARNING (fail değil)
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
// 0) YORUM TEMİZLEYİCİ (v15.43 — JSDoc/inline yorum skip)
// ═══════════════════════════════════════════════════════════════
//
// Sebep: regex `supabase.from(...)` çağrılarını yorum içinde de yakalıyordu.
// Örn. JSDoc'taki `* Kullanım: supabase.from('uys_orders').insert(...)` kullanım
// örneği "false positive" trace warning üretiyordu (testRun.ts:172).
//
// Çözüm: dosya içeriği taranmadan önce yorumlar boşluğa dönüştürülür.
// String literal'ler içindeki `//` veya `/* */` korunur (URL'ler vb.).
// Newline'lar ve uzunluk korunur → satır numaraları ve offset'ler bozulmaz.
function stripComments(src) {
  let out = ''
  let i = 0
  let inString = null  // null | '"' | "'" | '`'
  let inLineComment = false
  let inBlockComment = false

  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false
        out += ch
      } else {
        out += ' '
      }
      i++
      continue
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        out += '  '
        i += 2
        continue
      }
      out += ch === '\n' ? '\n' : ' '
      i++
      continue
    }

    if (inString) {
      // Kaçışlı karakter
      if (ch === '\\' && next !== undefined) {
        out += ch + next
        i += 2
        continue
      }
      if (ch === inString) {
        inString = null
      }
      out += ch
      i++
      continue
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      out += ch
      i++
      continue
    }

    if (ch === '/' && next === '/') {
      inLineComment = true
      out += '  '
      i += 2
      continue
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true
      out += '  '
      i += 2
      continue
    }

    out += ch
    i++
  }

  return out
}

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
      const lines = body.split('\n')
      for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('--')) continue
        if (line.toUpperCase().startsWith('CONSTRAINT') ||
            line.toUpperCase().startsWith('PRIMARY KEY') ||
            line.toUpperCase().startsWith('FOREIGN KEY') ||
            line.toUpperCase().startsWith('UNIQUE')) continue
        const colMatch = line.match(/^([a-z_][a-z0-9_]*)/i)
        if (colMatch) tables[tableName].add(colMatch[1])
      }
    }

    // ALTER TABLE public.xxx ADD COLUMN ...
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
 * {...} bloğunun sonunu bulur (balanced), stringleri atlar.
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

/**
 * [...] bloğunun sonunu bulur (balanced).
 */
function findMatchingBracket(src, openIdx) {
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
    if (ch === '[') depth++
    else if (ch === ']') { depth--; if (depth === 0) return i }
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
        if (nextCh === ':') {
          if (!JS_LITERALS.has(ident)) keys.add(ident)
          i = skipValue(body, k + 1)
          continue
        }
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

/**
 * Array body içinde depth=0'daki tüm {...} object literal'lerini bulur ve
 * her birinin top-level key'lerini union eder.
 * Örn: [{ id: 1 }, { id: 2 }] → Set{'id'}
 */
function extractKeysFromArrayBody(body) {
  const allKeys = new Set()
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
    if (depth === 0 && ch === '{') {
      const close = findMatchingBrace(body, i)
      if (close > i) {
        const objBody = body.slice(i + 1, close)
        for (const k of extractTopLevelKeys(objBody)) allKeys.add(k)
        i = close + 1
        continue
      }
    }
    if (ch === '[' || ch === '(' || ch === '{') { depth++; i++; continue }
    if (ch === ']' || ch === ')' || ch === '}') { depth--; i++; continue }
    i++
  }
  return allKeys
}

/**
 * Bir ifadenin sonunu bulur (noktalı virgül, standalone newline).
 */
function findExprEnd(src, startIdx) {
  let depth = 0
  let inStr = false
  let strChar = ''
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i]
    const prev = i > 0 ? src[i-1] : ''
    if (inStr) {
      if (ch === strChar && prev !== '\\') inStr = false
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth++; continue }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) return i
      depth--; continue
    }
    if (depth === 0 && ch === ';') return i
    if (depth === 0 && ch === '\n') {
      let k = i + 1
      while (k < src.length && /[ \t\r]/.test(src[k])) k++
      const nextCh = src[k]
      if (nextCh === '.' || nextCh === ',' || nextCh === '+' || nextCh === ')' ||
          nextCh === ']' || nextCh === '?' || nextCh === ':' || nextCh === '}') continue
      return i
    }
  }
  return src.length
}

/**
 * Bir dosya içinde verilen değişken adının atandığı/push edildiği
 * noktaları bulur — SCOPE-AWARE: beforePos'tan önceki EN YAKIN assignment'ı
 * bulur ve aradaki push'ları toplar. Bu sayede aynı dosyada iki fonksiyonda
 * aynı isimli değişken olsa bile karışmaz (chat service false positive fix).
 *
 * Desteklenen pattern'ler:
 *   (const|let|var) <n> = { ... }
 *   (const|let|var) <n> = [ { ... }, { ... } ]
 *   (const|let|var) <n> = xxx.map(... => ({ ... }))
 *   <n> = { ... } / [ { ... } ]       (reassignment)
 *   <n>.push({ ... })                 (decl ile insert arasında)
 */
function traceVariableKeys(content, varName, beforePos) {
  const keys = new Set()
  let traced = false

  const nameEsc = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 1. Assignment site'larını bul (sadece beforePos öncesi), en yakın olanı seç
  // Regex: optional const/let/var + name + optional TS type annotation (: Type) + =
  const assignRegex = new RegExp(
    '(?:^|[^a-zA-Z0-9_$.])(?:(?:const|let|var)\\s+)?' + nameEsc + '(?:\\s*:[^=\\n]*)?\\s*=(?!=)\\s*',
    'g'
  )
  let lastMatchEnd = -1
  let m
  while ((m = assignRegex.exec(content)) !== null) {
    if (m.index >= beforePos) break
    lastMatchEnd = m.index + m[0].length
  }

  if (lastMatchEnd < 0) {
    return { keys, traced: false }
  }

  const declStart = lastMatchEnd
  const ch = content[declStart]

  if (ch === '{') {
    const close = findMatchingBrace(content, declStart)
    if (close > declStart) {
      traced = true
      const body = content.slice(declStart + 1, close)
      for (const k of extractTopLevelKeys(body)) keys.add(k)
    }
  } else if (ch === '[') {
    const close = findMatchingBracket(content, declStart)
    if (close > declStart) {
      traced = true
      const body = content.slice(declStart + 1, close)
      for (const k of extractKeysFromArrayBody(body)) keys.add(k)
    }
  } else {
    // .map(... => ({ ... })) chain
    const exprEnd = findExprEnd(content, declStart)
    const exprSlice = content.slice(declStart, exprEnd)
    const arrowIdx = exprSlice.indexOf('=>')
    if (arrowIdx > 0) {
      let p = arrowIdx + 2
      while (p < exprSlice.length && /\s/.test(exprSlice[p])) p++
      if (exprSlice[p] === '(') {
        let q = p + 1
        while (q < exprSlice.length && /\s/.test(exprSlice[q])) q++
        if (exprSlice[q] === '{') {
          const absOpen = declStart + q
          const close = findMatchingBrace(content, absOpen)
          if (close > absOpen) {
            traced = true
            const body = content.slice(absOpen + 1, close)
            for (const k of extractTopLevelKeys(body)) keys.add(k)
          }
        }
      }
    }
  }

  // 2. declStart ile beforePos arasındaki push'ları topla
  const pushRegex = new RegExp(
    '(?:^|[^a-zA-Z0-9_$.])' + nameEsc + '\\s*\\.\\s*push\\s*\\(',
    'g'
  )
  pushRegex.lastIndex = declStart
  while ((m = pushRegex.exec(content)) !== null) {
    if (m.index >= beforePos) break
    const afterParen = m.index + m[0].length
    let p = afterParen
    while (p < content.length && /\s/.test(content[p])) p++
    if (content[p] === '{') {
      const close = findMatchingBrace(content, p)
      if (close > p) {
        traced = true
        const body = content.slice(p + 1, close)
        for (const k of extractTopLevelKeys(body)) keys.add(k)
      }
    }
  }

  // 3. Property assignment pattern: <var>.<key> = value
  // (updates.malad = ad gibi — önce `const updates = {}` sonra field-field ekleme)
  const propAssignRegex = new RegExp(
    '(?:^|[^a-zA-Z0-9_$.])' + nameEsc + '\\s*\\.\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\\s*=(?!=)',
    'g'
  )
  propAssignRegex.lastIndex = declStart
  while ((m = propAssignRegex.exec(content)) !== null) {
    if (m.index >= beforePos) break
    const propName = m[1]
    if (!JS_LITERALS.has(propName)) {
      keys.add(propName)
      traced = true
    }
  }

  return { keys, traced }
}

function extractUsages() {
  const usages = []
  const untraced = []
  const files = scanDir(path.join(ROOT, 'src'), ['.ts', '.tsx'])

  for (const file of files) {
    const rawContent = fs.readFileSync(file, 'utf-8')
    // v15.43: Yorumları temizle — JSDoc içindeki örnek supabase.from(...)
    // kullanımları false positive üretmesin. Newline'lar korunur,
    // satır numaraları ve offset'ler bozulmaz.
    const content = stripComments(rawContent)
    const fromRegex = /supabase\s*\.\s*from\s*\(\s*['"]([a-z_]+)['"]\s*\)/g
    let m
    while ((m = fromRegex.exec(content)) !== null) {
      const table = m[1]
      const startAfterFrom = m.index + m[0].length
      const nextFromRegex = /supabase\s*\.\s*from\s*\(/g
      nextFromRegex.lastIndex = startAfterFrom
      const nextFromMatch = nextFromRegex.exec(content)
      const nextFrom = nextFromMatch ? nextFromMatch.index : -1
      const chainEnd = nextFrom > 0 ? nextFrom : content.length
      const chainSlice = content.slice(startAfterFrom, chainEnd)

      const callRegex = /\.(insert|update|upsert)\s*\(/g
      let c
      while ((c = callRegex.exec(chainSlice)) !== null) {
        const kind = c[1]
        let p = c.index + c[0].length
        while (p < chainSlice.length && /\s/.test(chainSlice[p])) p++
        const ch = chainSlice[p]
        const absCallPos = startAfterFrom + c.index

        // CASE A: Inline object literal
        if (ch === '{') {
          const absOpen = startAfterFrom + p
          const absClose = findMatchingBrace(content, absOpen)
          if (absClose < 0) continue
          const body = content.slice(absOpen + 1, absClose)
          const keys = extractTopLevelKeys(body)
          if (keys.size > 0) {
            usages.push({
              file: path.relative(ROOT, file),
              table, kind, source: 'literal',
              cols: [...keys],
            })
          }
          continue
        }

        // CASE B: Array literal
        if (ch === '[') {
          const absOpen = startAfterFrom + p
          const absClose = findMatchingBracket(content, absOpen)
          if (absClose < 0) continue
          const body = content.slice(absOpen + 1, absClose)
          const keys = extractKeysFromArrayBody(body)
          if (keys.size > 0) {
            usages.push({
              file: path.relative(ROOT, file),
              table, kind, source: 'array',
              cols: [...keys],
            })
          }
          continue
        }

        // CASE C: Identifier — değişken trace
        if (/[a-zA-Z_$]/.test(ch)) {
          let j = p
          while (j < chainSlice.length && /[a-zA-Z0-9_$]/.test(chainSlice[j])) j++
          const varName = chainSlice.slice(p, j)
          let k = j
          while (k < chainSlice.length && /\s/.test(chainSlice[k])) k++
          const nextCh = chainSlice[k]
          if (nextCh !== ')' && nextCh !== ',') {
            const lineNo = content.slice(0, absCallPos).split('\n').length
            untraced.push({
              file: path.relative(ROOT, file),
              table, kind, lineNo,
              reason: 'karmaşık expression (değişken değil)',
            })
            continue
          }
          const { keys, traced } = traceVariableKeys(content, varName, absCallPos)
          if (traced && keys.size > 0) {
            usages.push({
              file: path.relative(ROOT, file),
              table, kind, source: 'var:' + varName,
              cols: [...keys],
            })
          } else {
            const lineNo = content.slice(0, absCallPos).split('\n').length
            untraced.push({
              file: path.relative(ROOT, file),
              table, kind, lineNo, varName,
              reason: 'değişken tanımı bulunamadı (başka modülden import veya karmaşık atama)',
            })
          }
          continue
        }

        const lineNo = content.slice(0, absCallPos).split('\n').length
        untraced.push({
          file: path.relative(ROOT, file),
          table, kind, lineNo,
          reason: "beklenmeyen argüman: '" + ch + "'",
        })
      }
    }
  }
  return { usages, untraced }
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
  const { usages, untraced } = extractUsages()

  const tableCount = Object.keys(dbTables).length
  const colCount = Object.values(dbTables).reduce((a, s) => a + s.size, 0)
  const literalCount = usages.filter(u => u.source === 'literal').length
  const arrayCount = usages.filter(u => u.source === 'array').length
  const varCount = usages.filter(u => u.source && u.source.startsWith('var:')).length
  console.log('📦 DB şeması: ' + tableCount + ' tablo, toplam ' + colCount + ' kolon')
  console.log('🔍 Kod taraması: ' + usages.length + ' insert/update/upsert çağrısı analiz edildi')
  console.log('   ↪ ' + literalCount + ' inline object, ' + arrayCount + ' array literal, ' + varCount + ' değişken trace')
  if (untraced.length) {
    console.log('   ↪ ' + untraced.length + ' çağrı trace edilemedi (aşağıda warning)')
  }
  console.log('')

  const issues = []
  for (const u of usages) {
    if (!dbTables[u.table]) {
      issues.push({ ...u, problem: 'unknown_table' })
      continue
    }
    const dbCols = dbTables[u.table]
    for (const codeCol of u.cols) {
      const snake = codeCol.includes('_') ? codeCol : camelToSnake(codeCol)
      if (!dbCols.has(snake) && !SYSTEM_COLUMNS.has(snake)) {
        issues.push({ ...u, problem: 'unknown_column', codeCol, expectedCol: snake })
      }
    }
  }

  // Untraced çağrıları warning olarak bas (fail değil)
  if (untraced.length) {
    console.log('\x1b[33m⚠ TRACE EDİLEMEYEN ÇAĞRILAR (elle gözden geçir):\x1b[0m')
    const byFile = {}
    for (const u of untraced) {
      byFile[u.file] = byFile[u.file] || []
      byFile[u.file].push(u)
    }
    for (const [file, list] of Object.entries(byFile)) {
      console.log('\x1b[33m  ▸ ' + file + '\x1b[0m')
      for (const u of list) {
        const varInfo = u.varName ? " '" + u.varName + "'" : ''
        console.log('    ⚠ Satır ' + u.lineNo + ': ' + u.table + ' [' + u.kind + ']' + varInfo + ' — ' + u.reason)
      }
    }
    console.log('')
  }

  if (issues.length === 0) {
    console.log('\x1b[32m\x1b[1m✓ TEMİZ — Her insert/update/upsert çağrısındaki kolonlar DB ile uyumlu.\x1b[0m')
    console.log('')
    process.exit(0)
  }

  console.log('\x1b[31m🔴 ' + issues.length + ' SORUN BULUNDU:\x1b[0m')
  console.log('')

  const byTable = {}
  for (const i of issues) {
    byTable[i.table] = byTable[i.table] || []
    byTable[i.table].push(i)
  }

  for (const [table, list] of Object.entries(byTable)) {
    console.log('\x1b[33m  ▸ ' + table + '\x1b[0m')
    for (const i of list) {
      if (i.problem === 'unknown_table') {
        console.log('    ❌ Bilinmeyen tablo (DB şemasında yok) — ' + i.file)
      } else {
        const hint = i.codeCol !== i.expectedCol
          ? ' (' + i.codeCol + ' → aranan DB kolonu: ' + i.expectedCol + ')'
          : ''
        const src = i.source && i.source.startsWith('var:') ? ' {' + i.source + '}' : ''
        console.log('    ❌ Kolon yok: \'' + i.expectedCol + '\'' + hint + ' — ' + i.file + ' [' + i.kind + ']' + src)
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
