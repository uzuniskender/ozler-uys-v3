import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { useProductionStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { Plus, X, ChevronRight } from 'lucide-react'

const durusKoduSchema = z.object({
  kod: z.string().trim().min(1, 'Kod zorunlu'),
  ad: z.string().trim().min(1, 'Ad zorunlu'),
  kategori: z.string().trim(),
})

export function DowntimeCodes() {
  const durusKodlari = useProductionStore(s => s.durusKodlari)
  const logs = useProductionStore(s => s.logs)
  const workOrders = useProductionStore(s => s.workOrders)
  const loadOwn = useProductionStore(s => s.loadOwn)
  const { can } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [dkKod, setDkKod] = useState('')
  const [dkAd, setDkAd] = useState('')
  const [dkKat, setDkKat] = useState('')
  const [selectedKod, setSelectedKod] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map: Record<string, typeof durusKodlari> = {}
    durusKodlari.forEach(d => { const k = d.kategori || 'Genel'; if (!map[k]) map[k] = []; map[k].push(d) })
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'tr'))
  }, [durusKodlari])

  // İstasyon lookup
  const woIstMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const w of workOrders) if (w.istAd) m.set(w.id, w.istAd)
    return m
  }, [workOrders])

  // Her duruş kodu için: kullanım, toplam süre, istasyon dağılımı
  // DB'de duruslar JSONB'si { kodId (UUID), kodAd, sure, bas, bit } formatını kullanır.
  // Eski loglar { kod (short string), ad, bas, bit } formatında olabilir — her ikisi desteklenir.
  const durusStats = useMemo(() => {
    type Stat = { kullanim: number; toplamSure: number; istasyonlar: Record<string, number> }
    const map: Record<string, Stat> = {}
    const idToKod: Record<string, string> = {}
    for (const dk of durusKodlari) {
      map[dk.kod] = { kullanim: 0, toplamSure: 0, istasyonlar: {} }
      idToKod[dk.id] = dk.kod
    }

    for (const log of logs) {
      if (!Array.isArray(log.duruslar) || !log.duruslar.length) continue
      const istAd = woIstMap.get(log.woId) || 'Tanımsız'
      for (const d of log.duruslar as { kodId?: string; kodAd?: string; sure?: number; bas?: string; bit?: string; kod?: string }[]) {
        const durusKod = d.kodId ? (idToKod[d.kodId] || '') : (d.kod || '')
        if (!durusKod || !map[durusKod]) continue
        const s = map[durusKod]
        s.kullanim++
        const sure = (d.sure && d.sure > 0) ? d.sure
          : (d.bas && d.bit) ? (() => {
              const [bh, bm] = d.bas!.split(':').map(Number)
              const [eh, em] = d.bit!.split(':').map(Number)
              return Math.max(0, (eh * 60 + em) - (bh * 60 + bm))
            })() : 0
        s.toplamSure += sure
        s.istasyonlar[istAd] = (s.istasyonlar[istAd] || 0) + 1
      }
    }
    return map
  }, [durusKodlari, logs, woIstMap])

  // Seçili kod detayı + son 5 kullanım
  const selectedDk = selectedKod ? durusKodlari.find(d => d.kod === selectedKod) : null
  const selectedStat = selectedKod ? durusStats[selectedKod] : null

  const sonKullanim = useMemo(() => {
    if (!selectedKod) return []
    const idToKod: Record<string, string> = {}
    for (const dk of durusKodlari) idToKod[dk.id] = dk.kod
    const result: { tarih: string; saat: string; sure: number; istAd: string }[] = []
    for (const log of logs) {
      if (!Array.isArray(log.duruslar) || !log.duruslar.length) continue
      for (const d of log.duruslar as { kodId?: string; sure?: number; bas?: string; bit?: string; kod?: string }[]) {
        const dk = d.kodId ? (idToKod[d.kodId] || '') : (d.kod || '')
        if (dk !== selectedKod) continue
        const sure = (d.sure && d.sure > 0) ? d.sure
          : (d.bas && d.bit) ? (() => {
              const [bh, bm] = d.bas!.split(':').map(Number)
              const [eh, em] = d.bit!.split(':').map(Number)
              return Math.max(0, (eh * 60 + em) - (bh * 60 + bm))
            })() : 0
        result.push({ tarih: log.tarih, saat: log.saat, sure, istAd: woIstMap.get(log.woId) || 'Tanımsız' })
      }
    }
    return result.sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat)).slice(0, 5)
  }, [selectedKod, logs, durusKodlari, woIstMap])

  async function del(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_durus_kodlari').delete().eq('id', id); loadOwn()
  }

  async function add() {
    const parsed = durusKoduSchema.safeParse({ kod: dkKod, ad: dkAd, kategori: dkKat })
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    await supabase.from('uys_durus_kodlari').insert({ id: uid(), kod: parsed.data.kod, ad: parsed.data.ad, kategori: parsed.data.kategori })
    loadOwn(); setShowForm(false); setDkKod(''); setDkAd(''); setDkKat('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Duruş Kodları</h1><p className="text-xs text-zinc-500">{durusKodlari.length} kod</p></div>
        <div className="flex gap-2">
          <button onClick={() => {
            import('xlsx').then(XLSX => {
              const rows = durusKodlari.map(d => ({ Kod: d.kod, Ad: d.ad, Kategori: d.kategori || '' }))
              const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
              XLSX.utils.book_append_sheet(wb, ws, 'Duruş Kodları'); XLSX.writeFile(wb, 'durus_kodlari.xlsx')
            })
          }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📥 Excel</button>
          <button onClick={async () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls'
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
              const XLSX = await import('xlsx')
              const data = await file.arrayBuffer(); const wb = XLSX.read(data)
              const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]])
              let count = 0
              for (const row of rows) {
                const kod = String(row['Kod'] || row['kod'] || '').trim()
                const ad = String(row['Ad'] || row['ad'] || '').trim()
                if (!kod || !ad) continue
                await supabase.from('uys_durus_kodlari').insert({ id: uid(), kod, ad, kategori: String(row['Kategori'] || '') })
                count++
              }
              loadOwn(); toast.success(count + ' duruş kodu yüklendi')
            }
            input.click()
          }} className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📤 Yükle</button>
          {can('durus_add') && <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni</button>}
        </div>
      </div>
      {grouped.map(([kat, codes]) => (
        <div key={kat} className="mb-4">
          <div className="px-3 py-1.5 bg-bg-3/50 border border-border rounded-t-lg text-[11px] font-semibold text-zinc-400">{kat} ({codes.length})</div>
          <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg divide-y divide-border/30">
            {codes.map(d => {
              const st = durusStats[d.kod] || { kullanim: 0, toplamSure: 0, istasyonlar: {} }
              const topIst = Object.entries(st.istasyonlar).sort((a, b) => b[1] - a[1])[0]
              const isSelected = selectedKod === d.kod
              return (
                <div key={d.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-accent/8 border-l-2 border-l-accent' : 'hover:bg-bg-3/30'}`}
                  onClick={() => setSelectedKod(isSelected ? null : d.kod)}
                >
                  <span className="font-mono text-[11px] text-accent w-16 shrink-0">{d.kod}</span>
                  <span className="flex-1 text-xs text-zinc-300">{d.ad}</span>
                  {st.kullanim > 0 ? (
                    <>
                      <span className="text-[10px] font-mono text-zinc-400 whitespace-nowrap">{st.kullanim}×</span>
                      <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">{st.toplamSure} dk</span>
                      {topIst && <span className="text-[10px] text-zinc-600 truncate max-w-[100px]" title={topIst[0]}>{topIst[0]}</span>}
                    </>
                  ) : (
                    <span className="text-[10px] text-zinc-700">—</span>
                  )}
                  <ChevronRight size={12} className={`text-zinc-600 shrink-0 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  {can('durus_delete') && <button onClick={e => { e.stopPropagation(); del(d.id) }} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red shrink-0">Sil</button>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {selectedDk && selectedStat && (
        <div className="fixed top-0 right-0 h-full w-80 bg-bg-1 border-l border-border z-40 flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div>
              <span className="font-mono text-xs text-accent">{selectedDk.kod}</span>
              <p className="text-sm font-semibold text-zinc-200 mt-0.5">{selectedDk.ad}</p>
              {selectedDk.kategori && <p className="text-[10px] text-zinc-500">{selectedDk.kategori}</p>}
            </div>
            <button onClick={() => setSelectedKod(null)} className="p-1 hover:bg-bg-3 rounded text-zinc-500 hover:text-zinc-300"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Kullanım', value: selectedStat.kullanim + '×' },
                { label: 'Toplam', value: selectedStat.toplamSure + ' dk' },
                { label: 'Ort.', value: selectedStat.kullanim > 0 ? Math.round(selectedStat.toplamSure / selectedStat.kullanim) + ' dk' : '—' },
              ].map(k => (
                <div key={k.label} className="bg-bg-2 border border-border rounded-lg px-3 py-2 text-center">
                  <div className="text-xs font-semibold text-zinc-200">{k.value}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>
            {Object.keys(selectedStat.istasyonlar).length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 mb-2">İstasyon Dağılımı</p>
                <div className="space-y-1.5">
                  {Object.entries(selectedStat.istasyonlar).sort((a, b) => b[1] - a[1]).map(([ist, cnt]) => {
                    const pct = Math.round(cnt / selectedStat.kullanim * 100)
                    return (
                      <div key={ist}>
                        <div className="flex justify-between text-[10px] text-zinc-400 mb-0.5">
                          <span className="truncate max-w-[160px]" title={ist}>{ist}</span>
                          <span className="shrink-0 ml-2">{cnt}× · %{pct}</span>
                        </div>
                        <div className="h-1 bg-bg-3 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: pct + '%' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {sonKullanim.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-zinc-400 mb-2">Son 5 Kullanım</p>
                <div className="space-y-1.5">
                  {sonKullanim.map((k, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-zinc-500 truncate">{k.istAd}</div>
                        <div className="text-[9px] text-zinc-700 font-mono">{k.tarih} {k.saat}</div>
                      </div>
                      <span className="text-[10px] font-mono text-red shrink-0">{k.sure} dk</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Yeni Duruş Kodu</h2>
            <div className="space-y-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Kod</label><input value={dkKod} onChange={e => setDkKod(e.target.value)} autoFocus className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Ad</label><input value={dkAd} onChange={e => setDkAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">Kategori</label><input value={dkKat} onChange={e => setDkKat(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { setShowForm(false); setDkKod(''); setDkAd(''); setDkKat('') }} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
              <button onClick={add} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
