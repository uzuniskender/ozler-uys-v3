// DevSync.tsx — v1.2
// Repo dosyalarını Supabase'e senkronize eder.
// Claude bu tablo üzerinden dosyaları okur, değiştirir.
// Admin-only sayfa.
// v1.2: Kopyala → modal | Komut sync'e kadar silinmez | Remove-Item cleanup

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const REPO = 'uzuniskender/ozler-uys-v3'
const BRANCH = 'main'
const GITHUB_TREE = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`
const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`

const SYNC_EXTS = ['.tsx', '.ts', '.css', '.json', '.md', '.sql', '.cjs']
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git']

type DevFile = { path: string; sha: string; size: number }
type SyncedFile = { path: string; sha: string; size_bytes: number; updated_at: string; updated_by: string; committed_hash: string | null }
type PendingChange = { path: string; updated_at: string; updated_by: string }

async function computeGitBlobSha(content: string): Promise<string> {
  const enc = new TextEncoder()
  const body = enc.encode(content)
  const header = enc.encode(`blob ${body.length}\0`)
  const buf = new Uint8Array(header.length + body.length)
  buf.set(header); buf.set(body, header.length)
  const hash = await crypto.subtle.digest('SHA-1', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── Kopyala Modal ───
function KopyalaModal({ cmd, onClose }: { cmd: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-5 w-full max-w-2xl shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-green">✓ Komut kopyalandı!</div>
            <div className="text-[11px] text-zinc-500 mt-0.5">PowerShell'e yapıştır ve çalıştır</div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-lg px-1">✕</button>
        </div>
        <pre className="bg-bg-3 border border-border rounded-lg p-3 text-[11px] font-mono text-zinc-300 leading-5 whitespace-pre-wrap break-all select-all max-h-64 overflow-y-auto">
          {cmd}
        </pre>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold">Tamam</button>
        </div>
      </div>
    </div>
  )
}

// ─── Git Komut Paneli ───
function GitKomutPanel({ pendingChanges }: { pendingChanges: PendingChange[] }) {
  const REPO_PATH = 'C:\\Users\\iskender.uzun\\Documents\\GitHub\\ozler-uys-v3'
  const [showModal, setShowModal] = useState(false)

  function buildCmd() {
    const copies = pendingChanges.map(c => {
      const fn = c.path.split('/').pop() || ''
      const dest = c.path.split('/').join('\\')
      return `Copy-Item "$env:USERPROFILE\\Downloads\\${fn}" "${dest}" -Force`
    }).join('\n')

    const adds = pendingChanges.map(c => c.path).join(' ')
    const names = pendingChanges.map(c => c.path.split('/').pop()).join(', ')

    // Remove-Item cleanup
    const removes = pendingChanges.map(c => {
      const fn = c.path.split('/').pop() || ''
      return `Remove-Item "$env:USERPROFILE\\Downloads\\${fn}" -ErrorAction SilentlyContinue`
    }).join('\n')

    return [
      `cd ${REPO_PATH}`,
      `git pull`,
      copies,
      `git add ${adds}`,
      `git commit -m "Claude: ${names}"`,
      `git push`,
      `# İndirilenler temizlendi`,
      removes,
    ].join('\n')
  }

  function handleKopyala() {
    const cmd = buildCmd()
    navigator.clipboard.writeText(cmd)
      .then(() => setShowModal(true))
      .catch(() => {
        // Clipboard API çalışmazsa yine de modal aç
        setShowModal(true)
      })
  }

  const cmd = buildCmd()

  return (
    <>
      <div className="mt-4 p-4 bg-bg-2 border border-border rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-zinc-500 font-semibold">Önce dosyaları indir, sonra komutu çalıştır:</span>
          <button
            onClick={handleKopyala}
            className="px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 rounded text-[10px] font-semibold"
          >
            📋 Komutu Kopyala
          </button>
        </div>
        <pre className="text-[10px] font-mono text-zinc-400 leading-5 select-all whitespace-pre-wrap break-all">
          {cmd}
        </pre>
      </div>
      {showModal && <KopyalaModal cmd={cmd} onClose={() => setShowModal(false)} />}
    </>
  )
}

export function DevSync() {
  const [repoFiles, setRepoFiles] = useState<DevFile[]>([])
  const [syncedFiles, setSyncedFiles] = useState<SyncedFile[]>([])
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'sync' | 'changes'>('sync')

  async function loadSynced(): Promise<SyncedFile[]> {
    const { data } = await supabase
      .from('uys_dev_files')
      .select('path, sha, size_bytes, updated_at, updated_by, committed_hash')
      .order('path')
    const files = (data || []) as SyncedFile[]
    setSyncedFiles(files)
    setPendingChanges(files.filter(f => f.updated_by === 'claude'))
    return files
  }

  async function autoCheckCommitted(repoFiles: DevFile[], synced: SyncedFile[]) {
    const repoMap = new Map(repoFiles.map(f => [f.path, f.sha]))
    const claudeFiles = synced.filter(f => f.updated_by === 'claude')
    if (!claudeFiles.length) return

    const toUpdate: string[] = []

    for (const sf of claudeFiles) {
      const githubSha = repoMap.get(sf.path)
      if (!githubSha) continue

      let localSha = sf.committed_hash

      if (!localSha) {
        const { data } = await supabase
          .from('uys_dev_files').select('content').eq('path', sf.path).single()
        if (!data?.content) continue
        localSha = await computeGitBlobSha(data.content)
        await supabase.from('uys_dev_files')
          .update({ committed_hash: localSha }).eq('path', sf.path)
      }

      if (localSha === githubSha) toUpdate.push(sf.path)
    }

    if (!toUpdate.length) return
    await supabase.from('uys_dev_files')
      .update({ updated_by: 'synced', committed_hash: null })
      .in('path', toUpdate)
    await loadSynced()
    toast.success(`${toUpdate.length} dosya otomatik senkronize edildi`)
  }

  async function loadRepoTree(): Promise<DevFile[]> {
    setLoading(true)
    try {
      const res = await fetch(GITHUB_TREE)
      if (!res.ok) throw new Error(`GitHub API: ${res.status}`)
      const data = await res.json()
      const files: DevFile[] = (data.tree || []).filter((f: any) => {
        if (f.type !== 'blob') return false
        if (EXCLUDE_DIRS.some(d => f.path.startsWith(d + '/'))) return false
        return SYNC_EXTS.some(ext => f.path.endsWith(ext))
      })
      setRepoFiles(files)
      setSelectedPaths(new Set(files.filter(f => f.path.startsWith('src/')).map(f => f.path)))
      return files
    } catch (e: any) {
      toast.error('GitHub tree yüklenemedi: ' + e.message)
      return []
    } finally {
      setLoading(false)
    }
  }

  async function syncSelected() {
    const toSync = repoFiles.filter(f => selectedPaths.has(f.path))
    if (!toSync.length) { toast.error('Dosya seçin'); return }
    setSyncing(true)
    setSyncProgress({ done: 0, total: toSync.length })
    let ok = 0; let skipped = 0
    for (const file of toSync) {
      // v1.1 — Claude'un bekleyen değişikliklerini koru
      const mevcut = syncedMap.get(file.path)
      if (mevcut?.updated_by === 'claude') {
        skipped++
        setSyncProgress(p => ({ ...p, done: p.done + 1 }))
        continue
      }
      try {
        const res = await fetch(`${GITHUB_RAW}/${file.path}`)
        if (!res.ok) { console.warn('fetch fail:', file.path, res.status); continue }
        const content = await res.text()
        await supabase.from('uys_dev_files').upsert({
          path: file.path, content, sha: file.sha, size_bytes: file.size,
          updated_at: new Date().toISOString(), updated_by: 'synced',
        }, { onConflict: 'path' })
        ok++
      } catch (e) { console.warn('sync err:', file.path, e) }
      setSyncProgress(p => ({ ...p, done: p.done + 1 }))
    }
    await loadSynced()
    setSyncing(false)
    const msg = skipped > 0 ? `${ok} sync, ${skipped} Claude değişikliği korundu` : `${ok} dosya senkronize edildi`
    toast.success(msg)
  }

  // v1.2 — downloadChange artık updated_by'ı DEĞİŞTİRMEZ
  // Komut Claude değişiklikleri sekmesinde, GitHub Actions sync tamamlanana kadar kalır
  async function downloadChange(path: string) {
    const { data } = await supabase
      .from('uys_dev_files')
      .select('content')
      .eq('path', path)
      .single()
    if (!data?.content) { toast.error('İçerik bulunamadı'); return }
    const blob = new Blob([data.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = path.split('/').pop() || 'file'
    a.click()
    URL.revokeObjectURL(url)
    // NOT: updated_by değiştirilmiyor — GitHub Actions sync tamamlanınca kaldırılır
    toast.success('İndirildi: ' + path.split('/').pop())
  }

  async function downloadAllChanges() {
    for (const ch of pendingChanges) {
      await downloadChange(ch.path)
      await new Promise(r => setTimeout(r, 200))
    }
    toast.success(`${pendingChanges.length} dosya indirildi`)
  }

  useEffect(() => {
    async function initialize() {
      const [synced, repo] = await Promise.all([loadSynced(), loadRepoTree()])
      await autoCheckCommitted(repo, synced)
    }
    initialize()
  }, [])

  const syncedMap = new Map(syncedFiles.map(f => [f.path, f]))
  const filteredFiles = repoFiles.filter(f => !search || f.path.toLowerCase().includes(search.toLowerCase()))
  const grouped: Record<string, DevFile[]> = {}
  for (const f of filteredFiles) {
    const dir = f.path.includes('/') ? f.path.split('/').slice(0, 2).join('/') : '.'
    if (!grouped[dir]) grouped[dir] = []
    grouped[dir].push(f)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">DevSync</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {repoFiles.length} dosya · {syncedFiles.length} senkronize · {pendingChanges.length} değişiklik bekliyor
          </p>
        </div>
        {pendingChanges.length > 0 && (
          <button onClick={downloadAllChanges}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
            Tüm Değişiklikleri İndir ({pendingChanges.length})
          </button>
        )}
      </div>

      <div className="flex gap-1 border border-border rounded-lg overflow-hidden mb-4 w-fit">
        <button onClick={() => setTab('sync')}
          className={`px-4 py-1.5 text-xs font-medium ${tab === 'sync' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
          Dosyalar
        </button>
        <button onClick={() => setTab('changes')}
          className={`px-4 py-1.5 text-xs font-medium ${tab === 'changes' ? 'bg-accent text-white' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
          Claude Değişiklikleri {pendingChanges.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-amber/20 text-amber rounded text-[10px]">{pendingChanges.length}</span>}
        </button>
      </div>

      {tab === 'sync' && (
        <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <input type="text" placeholder="Dosya ara..." value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-accent" />
            <button onClick={() => setSelectedPaths(new Set(repoFiles.map(f => f.path)))}
              className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-zinc-200">Tümünü Seç</button>
            <button onClick={() => setSelectedPaths(new Set(repoFiles.filter(f => f.path.startsWith('src/')).map(f => f.path)))}
              className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-zinc-200">src/ Seç</button>
            <button onClick={() => setSelectedPaths(new Set())}
              className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-zinc-200">Temizle</button>
            <button onClick={syncSelected} disabled={syncing || !selectedPaths.size}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-xs font-semibold whitespace-nowrap">
              {syncing ? `${syncProgress.done}/${syncProgress.total}` : `Sync (${selectedPaths.size})`}
            </button>
          </div>
          {syncing && (
            <div className="h-1 bg-bg-3">
              <div className="h-1 bg-accent transition-all" style={{ width: `${syncProgress.total ? (syncProgress.done / syncProgress.total * 100) : 0}%` }} />
            </div>
          )}
          <div className="overflow-y-auto max-h-[60vh]">
            {loading && <div className="p-8 text-center text-sm text-zinc-500">Yükleniyor...</div>}
            {!loading && Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([dir, files]) => (
              <div key={dir}>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-bg-3/50 border-b border-border/30 sticky top-0">
                  <button onClick={() => {
                    const allSel = files.every(f => selectedPaths.has(f.path))
                    setSelectedPaths(prev => { const n = new Set(prev); files.forEach(f => allSel ? n.delete(f.path) : n.add(f.path)); return n })
                  }}><span className="text-[10px] text-zinc-500">📂</span></button>
                  <span className="text-[10px] text-zinc-500 font-mono">{dir}/</span>
                  <span className="text-[10px] text-zinc-600">{files.length} dosya</span>
                </div>
                {files.map(f => {
                  const synced = syncedMap.get(f.path)
                  const isChanged = synced?.updated_by === 'claude'
                  const isSel = selectedPaths.has(f.path)
                  return (
                    <div key={f.path}
                      className={`flex items-center gap-3 px-4 py-2 border-b border-border/20 hover:bg-bg-3/30 cursor-pointer ${isSel ? 'bg-accent/5' : ''}`}
                      onClick={() => setSelectedPaths(prev => { const n = new Set(prev); n.has(f.path) ? n.delete(f.path) : n.add(f.path); return n })}>
                      <input type="checkbox" checked={isSel} readOnly className="accent-accent shrink-0" />
                      <span className="font-mono text-[11px] text-zinc-400 flex-1 truncate">{f.path.split('/').pop()}</span>
                      {isChanged && <span className="px-1.5 py-0.5 bg-amber/15 text-amber rounded text-[9px] font-semibold shrink-0">Claude</span>}
                      {synced && !isChanged && <span className="px-1.5 py-0.5 bg-green/10 text-green rounded text-[9px] shrink-0">sync</span>}
                      <span className="text-[10px] text-zinc-600 font-mono shrink-0">{(f.size / 1024).toFixed(1)}k</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'changes' && (
        <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
          {pendingChanges.length === 0 ? (
            <div className="p-12 text-center text-sm text-zinc-500">Bekleyen değişiklik yok.</div>
          ) : (
            <div>
              {pendingChanges.map(ch => (
                <div key={ch.path} className="flex items-center gap-4 px-5 py-3 border-b border-border/30 hover:bg-bg-3/30">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-accent text-xs font-semibold">{ch.path.split('/').pop()}</div>
                    <div className="text-zinc-500 text-[11px] font-mono truncate">{ch.path}</div>
                    <div className="text-zinc-600 text-[10px] mt-0.5">{new Date(ch.updated_at).toLocaleString('tr-TR')}</div>
                  </div>
                  <button onClick={() => downloadChange(ch.path)}
                    className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded text-[10px] font-semibold shrink-0">
                    İndir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pendingChanges.length > 0 && <GitKomutPanel pendingChanges={pendingChanges} />}
    </div>
  )
}
