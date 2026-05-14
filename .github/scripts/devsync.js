// .github/scripts/devsync.js
// Her push'ta değişen dosyaları Supabase uys_dev_files tablosuna sync eder.
// v1.1 — updated_by='claude' olan dosyalar sync'te ezilmez (çift yönlü güvenli)
import { execSync } from 'child_process'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('SUPABASE_URL veya SUPABASE_KEY eksik')
  process.exit(1)
}

const SYNC_EXTS = ['.tsx', '.ts', '.css', '.json', '.md', '.sql', '.cjs', '.js', '.yml', '.yaml']
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git']

function shouldSync(filePath) {
  if (EXCLUDE_DIRS.some(d => filePath.startsWith(d + '/') || filePath.startsWith(d + '\\'))) return false
  return SYNC_EXTS.some(ext => filePath.endsWith(ext))
}

// v1.1 — Supabase'deki updated_by değerini kontrol et
async function getUpdatedBy(filePath) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/uys_dev_files?path=eq.${encodeURIComponent(filePath)}&select=updated_by`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data?.[0]?.updated_by ?? null
}

async function upsertFile(filePath) {
  const fullPath = join(process.cwd(), filePath)

  if (!existsSync(fullPath)) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/uys_dev_files?path=eq.${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    })
    if (!res.ok) console.warn(`DELETE hata: ${filePath} — ${res.status}`)
    else console.log(`🗑  Silindi: ${filePath}`)
    return
  }

  // v1.1 — Claude'un bekleyen değişikliklerini koru
  const updatedBy = await getUpdatedBy(filePath)
  if (updatedBy === 'claude') {
    console.log(`⏭  Atlandı (Claude değişikliği korundu): ${filePath}`)
    return
  }

  const content = readFileSync(fullPath, 'utf-8')
  const size_bytes = statSync(fullPath).size

  const res = await fetch(`${SUPABASE_URL}/rest/v1/uys_dev_files`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      path: filePath,
      content,
      size_bytes,
      updated_at: new Date().toISOString(),
      updated_by: 'github-actions',
    })
  })

  if (!res.ok) {
    const txt = await res.text()
    console.warn(`UPSERT hata: ${filePath} — ${res.status} — ${txt}`)
  } else {
    console.log(`✓ ${filePath}`)
  }
}

async function main() {
  let changedFiles = []
  try {
    const diff = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf-8' })
    changedFiles = diff.trim().split('\n').filter(Boolean)
  } catch {
    const all = execSync('git ls-files', { encoding: 'utf-8' })
    changedFiles = all.trim().split('\n').filter(Boolean)
  }

  const toSync = changedFiles.filter(shouldSync)
  if (toSync.length === 0) {
    console.log('Sync edilecek dosya yok.')
    return
  }

  console.log(`\n📦 ${toSync.length} dosya sync ediliyor...\n`)
  for (const f of toSync) {
    await upsertFile(f)
  }
  console.log(`\n✅ DevSync tamamlandı — ${toSync.length} dosya`)
}

main().catch(e => { console.error(e); process.exit(1) })
