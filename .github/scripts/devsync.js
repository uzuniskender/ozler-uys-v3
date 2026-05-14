// .github/scripts/devsync.js — v1.2
import { execSync } from 'child_process'
import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('SUPABASE_URL veya SUPABASE_KEY eksik'); process.exit(1) }

const SYNC_EXTS = ['.tsx', '.ts', '.css', '.json', '.md', '.sql', '.cjs', '.js', '.yml', '.yaml']
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git']

function shouldSync(filePath) {
  if (EXCLUDE_DIRS.some(d => filePath.startsWith(d + '/') || filePath.startsWith(d + '\\'))) return false
  return SYNC_EXTS.some(ext => filePath.endsWith(ext))
}

async function getUpdatedBy(filePath) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/uys_dev_files?path=eq.${encodeURIComponent(filePath)}&select=updated_by`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data?.[0]?.updated_by ?? null
}

async function upsertFile(filePath, changedFiles) {
  const fullPath = join(process.cwd(), filePath)

  if (!existsSync(fullPath)) {
    await fetch(`${SUPABASE_URL}/rest/v1/uys_dev_files?path=eq.${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    })
    console.log(`Silindi: ${filePath}`)
    return
  }

  const updatedBy = await getUpdatedBy(filePath)

  if (updatedBy === 'claude') {
    if (changedFiles.includes(filePath)) {
      console.log(`Sync (Claude commit edildi): ${filePath}`)
    } else {
      console.log(`Atlandı (Claude korundu): ${filePath}`)
      return
    }
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
    body: JSON.stringify({ path: filePath, content, size_bytes, updated_at: new Date().toISOString(), updated_by: 'synced' })
  })

  if (!res.ok) { const txt = await res.text(); console.warn(`UPSERT hata: ${filePath} — ${res.status} — ${txt}`) }
  else console.log(`OK: ${filePath}`)
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
  if (toSync.length === 0) { console.log('Sync edilecek dosya yok.'); return }
  console.log(`\n${toSync.length} dosya sync ediliyor...\n`)
  for (const f of toSync) { await upsertFile(f, changedFiles) }
  console.log(`\nDevSync tamamlandi — ${toSync.length} dosya`)
}

main().catch(e => { console.error(e); process.exit(1) })
