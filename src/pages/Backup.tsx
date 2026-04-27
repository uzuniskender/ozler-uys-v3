/**
 * v15.53 Adım 2 — Yedekler Sayfası (`/backup`)
 * ─────────────────────────────────────────────────────────────────────────
 * Faz 2 kapsamı:
 *   - Yedek listesi (filtreli)
 *   - "Şimdi Yedekle" butonu (manuel yedek + notlar)
 *   - "İndir" butonu (JSON dosyası olarak)
 *   - "Sil" butonu (admin only — RBAC: backup_delete)
 *
 * Faz 3 kapsamı (sonraki oturum):
 *   - "Geri Yükle" butonu (TEHLİKELİ — admin + 2-adım onay)
 *   - "Dosyadan Geri Yükle" (drag & drop + eski v22 parser)
 *
 * Faz 4 kapsamı (sonraki):
 *   - Otomatik yedek (cron) + 30 gün temizleme
 *
 * RBAC:
 *   - backup_view  → sayfaya erişim (Sidebar)
 *   - backup_create → "Şimdi Yedekle" butonu
 *   - backup_delete → "Sil" butonu
 *   - backup_restore → "Geri Yükle" butonu (Faz 3'te eklenir)
 */

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { takeBackup, listBackups, getBackup, deleteBackup, type Backup } from '@/lib/backup'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Save, Download, Trash2, Loader2, Database, Clock, HardDrive } from 'lucide-react'

export function Backup() {
  const { can, user } = useAuth()
  const [backups, setBackups] = useState<Backup[]>([])
  const [loading, setLoading] = useState(true)
  const [tipFilter, setTipFilter] = useState<'all' | 'otomatik' | 'manuel'>('all')
  const [showManuelModal, setShowManuelModal] = useState(false)
  const [manuelNotlar, setManuelNotlar] = useState('')
  const [manuelTaking, setManuelTaking] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const list = await listBackups()
    setBackups(list)
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  const filtered = useMemo(() => {
    if (tipFilter === 'all') return backups
    return backups.filter(b => b.tip === tipFilter)
  }, [backups, tipFilter])

  // ─── Üst özet hesapları ───
  const stats = useMemo(() => {
    const sonYedek = backups[0]
    const toplamBoyutKb = backups.reduce((sum, b) => sum + (b.boyutKb || 0), 0)
    return {
      toplamSayi: backups.length,
      sonTarih: sonYedek?.alindiTarih || null,
      sonTip: sonYedek?.tip || null,
      toplamBoyutMb: (toplamBoyutKb / 1024).toFixed(1),
    }
  }, [backups])

  // ─── Manuel yedek alma ───
  async function handleManuelYedek() {
    if (!can('backup_create')) { toast.error('Yetkiniz yok: backup_create'); return }
    const alanKisi = user?.username || user?.email || user?.dbId || 'system'
    setManuelTaking(true)
    const result = await takeBackup(alanKisi, 'manuel', manuelNotlar.trim() || undefined)
    setManuelTaking(false)
    if (!result.ok) {
      toast.error('Yedek alınamadı: ' + (result.error || 'bilinmeyen hata'))
      return
    }
    toast.success(`Yedek alındı (${result.boyutKb} KB)`)
    setShowManuelModal(false)
    setManuelNotlar('')
    await reload()
  }

  // ─── Yedek indir (JSON olarak) ───
  async function handleIndir(b: Backup) {
    setDownloadingId(b.id)
    const full = await getBackup(b.id)
    setDownloadingId(null)
    if (!full || !full.veri) {
      toast.error('Yedek okunamadı')
      return
    }
    const json = JSON.stringify(full.veri, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ozler_uys_yedek_${b.alindiTarih.replace(/-/g, '')}_${b.tip}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Yedek indirildi')
  }

  // ─── Yedek sil ───
  async function handleSil(b: Backup) {
    if (!can('backup_delete')) { toast.error('Yetkiniz yok: backup_delete'); return }
    const ok = await showConfirm(
      `${formatTarih(b.alindiTarih)} tarihli ${b.tip} yedeği silinecek. Devam?`
    )
    if (!ok) return
    const result = await deleteBackup(b.id)
    if (!result.ok) {
      toast.error('Yedek silinemedi: ' + (result.error || 'bilinmeyen hata'))
      return
    }
    toast.success('Yedek silindi')
    await reload()
  }

  // ─── Render ───
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <HardDrive size={22} className="text-accent" />
            Yedekler
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Veritabanı snapshot'ları — manuel veya otomatik yedek alımları, indirme ve silme.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('backup_create') && (
            <button
              onClick={() => setShowManuelModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-semibold"
            >
              <Save size={14} /> Şimdi Yedekle
            </button>
          )}
        </div>
      </div>

      {/* Üst özet (3 kart) */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-[11px] mb-2">
            <Database size={12} /> TOPLAM YEDEK
          </div>
          <div className="text-2xl font-mono text-zinc-100">{stats.toplamSayi}</div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-[11px] mb-2">
            <Clock size={12} /> SON YEDEK
          </div>
          <div className="text-sm text-zinc-100 mt-1">
            {stats.sonTarih ? formatTarih(stats.sonTarih) : '—'}
            {stats.sonTip && (
              <span className={`ml-2 text-[9px] px-1.5 py-0.5 rounded font-semibold ${tipBadge(stats.sonTip).bg} ${tipBadge(stats.sonTip).color}`}>
                {tipBadge(stats.sonTip).label}
              </span>
            )}
          </div>
        </div>
        <div className="bg-bg-2 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-[11px] mb-2">
            <HardDrive size={12} /> TOPLAM BOYUT
          </div>
          <div className="text-2xl font-mono text-zinc-100">
            {stats.toplamBoyutMb} <span className="text-sm text-zinc-500">MB</span>
          </div>
        </div>
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={tipFilter}
          onChange={e => setTipFilter(e.target.value as any)}
          className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300"
        >
          <option value="all">Tüm Yedekler ({backups.length})</option>
          <option value="otomatik">Sadece Otomatik ({backups.filter(b => b.tip === 'otomatik').length})</option>
          <option value="manuel">Sadece Manuel ({backups.filter(b => b.tip === 'manuel').length})</option>
        </select>
        <button
          onClick={reload}
          className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"
        >
          Yenile
        </button>
      </div>

      {/* Liste */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <Loader2 size={20} className="inline animate-spin mr-2" />
            Yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">
            {backups.length === 0 ? 'Henüz yedek yok. Şimdi Yedekle butonuna basarak ilk yedeği alabilirsiniz.' : 'Bu filtreye uyan yedek yok.'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2.5">Tarih</th>
                <th className="text-left px-4 py-2.5">Saat</th>
                <th className="text-center px-2 py-2.5">Tip</th>
                <th className="text-right px-4 py-2.5">Boyut</th>
                <th className="text-left px-4 py-2.5">Alan</th>
                <th className="text-left px-4 py-2.5">Notlar</th>
                <th className="text-right px-4 py-2.5 w-32">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const tb = tipBadge(b.tip)
                const isDownloading = downloadingId === b.id
                return (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-bg-3/30">
                    <td className="px-4 py-2.5 font-mono text-zinc-200">{formatTarih(b.alindiTarih)}</td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500 text-[11px]">{formatSaat(b.alindiSaat)}</td>
                    <td className="px-2 py-2.5 text-center">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${tb.bg} ${tb.color}`}>
                        {tb.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-zinc-400">
                      {b.boyutKb ? formatBoyut(b.boyutKb) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-300">{b.alanKisi}</td>
                    <td className="px-4 py-2.5 text-zinc-400 max-w-[200px] truncate" title={b.notlar || ''}>
                      {b.notlar || <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleIndir(b)}
                          disabled={isDownloading}
                          className="p-1.5 text-zinc-500 hover:text-accent disabled:opacity-40"
                          title="Yedeği JSON olarak indir"
                        >
                          {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                        </button>
                        {can('backup_delete') && (
                          <button
                            onClick={() => handleSil(b)}
                            className="p-1.5 text-zinc-500 hover:text-red"
                            title="Yedeği sil"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bilgi notu */}
      <div className="mt-6 p-3 bg-amber/10 border border-amber/25 rounded-lg text-[11px] text-amber">
        <div className="font-semibold mb-1">⚠️ Not</div>
        <ul className="list-disc ml-4 space-y-0.5 text-zinc-400">
          <li>Yedek dosyaları <strong>şifresiz</strong> JSON formatındadır. İndirilen dosyaları güvenli yerde saklayın, paylaşmayın.</li>
          <li>"Geri Yükle" özelliği henüz aktif değil — sonraki sürümle gelecek.</li>
          <li>Yedekler 30 günden eski otomatik kayıtları silmez (henüz). Manuel yedekler kalıcıdır.</li>
        </ul>
      </div>

      {/* Manuel yedek modalı */}
      {showManuelModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
          onClick={() => !manuelTaking && setShowManuelModal(false)}
        >
          <div
            className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Save size={18} className="text-accent" />
              Şimdi Yedek Al
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Tüm üretim verilerinin anlık snapshot'ı alınacak. Bu işlem birkaç saniye sürebilir.
            </p>

            <label className="text-xs text-zinc-400 block mb-1.5">Notlar (opsiyonel)</label>
            <input
              value={manuelNotlar}
              onChange={e => setManuelNotlar(e.target.value)}
              placeholder='Örn: "v15.53 deploy öncesi"'
              maxLength={120}
              disabled={manuelTaking}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent mb-4"
              onKeyDown={e => { if (e.key === 'Enter' && !manuelTaking) handleManuelYedek() }}
              autoFocus
            />

            {manuelTaking && (
              <div className="mb-4 p-3 bg-accent/10 border border-accent/25 rounded-lg text-xs text-accent flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Yedek alınıyor — sayfayı kapatmayın...
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowManuelModal(false)}
                disabled={manuelTaking}
                className="px-4 py-2 bg-bg-3 hover:bg-bg-4 text-zinc-400 rounded-lg text-xs disabled:opacity-40"
              >
                İptal
              </button>
              <button
                onClick={handleManuelYedek}
                disabled={manuelTaking}
                className="flex-1 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {manuelTaking ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {manuelTaking ? 'Alınıyor...' : 'Yedek Al'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ───

function formatTarih(yyyymmdd: string): string {
  // YYYY-MM-DD → DD.MM.YYYY
  if (!yyyymmdd) return '—'
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}.${m}.${y}`
}

function formatSaat(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatBoyut(kb: number): string {
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function tipBadge(tip: 'otomatik' | 'manuel') {
  if (tip === 'otomatik') return { bg: 'bg-cyan-500/10', color: 'text-cyan-400', label: 'OTOMATİK' }
  return { bg: 'bg-amber/10', color: 'text-amber', label: 'MANUEL' }
}
