import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Download, Plus, Upload } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'

export function Warehouse() {
  const { stokHareketler, materials, loadAll } = useStore()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'stok'|'hareketler'|'sayim'>('stok')
  const [showGiris, setShowGiris] = useState(false)
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())

  // Malzeme tipleri
  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])

  const stokMap = useMemo(() => {
    const map: Record<string, { malkod: string; malad: string; miktar: number }> = {}
    stokHareketler.forEach(h => {
      if (!map[h.malkod]) map[h.malkod] = { malkod: h.malkod, malad: h.malad, miktar: 0 }
      map[h.malkod].miktar += h.tip === 'giris' ? h.miktar : -h.miktar
    })
    return Object.values(map).filter(s => Math.abs(s.miktar) > 0.01).sort((a, b) => a.malad.localeCompare(b.malad, 'tr'))
  }, [stokHareketler])

  const filteredStok = useMemo(() => {
    let result = stokMap
    if (tipFilter.size > 0) {
      const tipMalkodlar = new Set(materials.filter(m => tipFilter.has(m.tip) || tipFilter.has(m.hammaddeTipi)).map(m => m.kod))
      result = result.filter(s => tipMalkodlar.has(s.malkod))
    }
    if (search) { const q = search.toLowerCase(); result = result.filter(s => (s.malkod + s.malad).toLowerCase().includes(q)) }
    return result
  }, [stokMap, search, tipFilter, materials])

  const filteredHareketler = useMemo(() => {
    const sorted = [...stokHareketler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''))
    if (!search) return sorted.slice(0, 200)
    const q = search.toLowerCase()
    return sorted.filter(h => (h.malkod + h.malad + h.aciklama).toLowerCase().includes(q)).slice(0, 200)
  }, [stokHareketler, search])

  // #30: Stok Onarım — negatif stokları sıfırla
  async function stokOnar() {
    const negatifler = stokMap.filter(s => s.miktar < -0.01)
    if (!negatifler.length) { toast.info('Negatif stok yok — her şey düzgün'); return }
    if (!await showConfirm(`${negatifler.length} malzemede negatif stok var. Düzeltme girişleri oluşturulsun mu?`)) return
    for (const s of negatifler) {
      await supabase.from('uys_stok_hareketler').insert({
        id: uid(), tarih: today(), malkod: s.malkod, malad: s.malad,
        miktar: Math.abs(s.miktar), tip: 'giris',
        aciklama: 'Stok onarım — negatif düzeltme',
      })
    }
    loadAll(); toast.success(negatifler.length + ' malzeme düzeltildi')
  }

  // Stok Excel Import
  function importExcel() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      if (!rows.length) { toast.error('Excel boş'); return }
      let count = 0
      for (const row of rows) {
        const malkod = String(row['Kod'] || row['Malzeme Kodu'] || row['malkod'] || '').trim()
        const miktar = parseFloat(String(row['Miktar'] || row['miktar'] || row['Stok'] || '0')) || 0
        const tip = String(row['Tip'] || row['tip'] || 'giris').toLowerCase().includes('çık') ? 'cikis' : 'giris'
        if (!malkod || miktar <= 0) continue
        const mat = materials.find(m => m.kod === malkod)
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), tarih: today(), malkod, malad: mat?.ad || malkod,
          miktar, tip, aciklama: 'Excel import',
        })
        count++
      }
      loadAll(); toast.success(count + ' stok hareketi yüklendi')
    }
    input.click()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filteredStok.map(s => ({ Kod: s.malkod, Malzeme: s.malad, Stok: Math.round(s.miktar * 100) / 100 }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Stok')
      XLSX.writeFile(wb, `stok_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Depolar</h1><p className="text-xs text-zinc-500">{stokHareketler.length} hareket · {stokMap.length} malzeme</p></div>
        <div className="flex gap-2">
          <button onClick={importExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          <button onClick={() => stokOnar()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-amber" title="Negatif stokları sıfırla">🔧 Onar</button>
          <button onClick={async () => {
            const lines = await showPrompt('Toplu stok girişi (her satır: malzeme_kodu,miktar)', 'H-001,100')
            if (!lines) return
            const rows = lines.split('\n').filter(l => l.includes(','))
            let count = 0
            for (const line of rows) {
              const [malkod, miktarStr] = line.split(',').map(s => s.trim())
              const miktar = parseFloat(miktarStr) || 0
              if (!malkod || miktar <= 0) continue
              const mat = materials.find(m => m.kod === malkod)
              await supabase.from('uys_stok_hareketler').insert({
                id: uid(), tarih: today(), malkod, malad: mat?.ad || malkod,
                miktar, tip: 'giris', aciklama: 'Toplu giriş',
              })
              count++
            }
            loadAll(); toast.success(count + ' stok girişi yapıldı')
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">📦 Toplu Giriş</button>
          <button onClick={() => setShowGiris(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Manuel Giriş/Çıkış</button>
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <select value={tab} onChange={e => setTab(e.target.value as 'stok'|'hareketler'|'sayim')} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="stok">Anlık Stok</option>
          <option value="hareketler">Hareketler</option>
          <option value="sayim">Stok Sayım</option>
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ara..." className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <MultiCheckDropdown label="Malzeme Tipi"
          options={tipler}
          selected={tipFilter} onChange={setTipFilter} />
      </div>

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-[65vh] overflow-y-auto">
        {tab === 'stok' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Stok</th><th className="text-left px-3 py-2.5">Birim</th><th className="text-right px-3 py-2.5">Min</th></tr></thead>
            <tbody>
              {filteredStok.map(s => {
                const mat = materials.find(m => m.kod === s.malkod)
                const minStokAlt = mat?.minStok && s.miktar < mat.minStok
                return (
                <tr key={s.malkod} className={`border-b border-border/30 hover:bg-bg-3/30 ${minStokAlt ? 'bg-red/5' : ''}`}>
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{s.malkod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{s.malad}</td>
                  <td className="px-4 py-1.5"><span className="px-1.5 py-0.5 bg-bg-3 rounded text-[9px] text-zinc-500">{mat?.tip || '—'}</span></td>
                  <td className={`px-4 py-1.5 text-right font-mono font-semibold ${s.miktar < 0 ? 'text-red' : minStokAlt ? 'text-amber' : 'text-green'}`}>{Math.round(s.miktar)}</td>
                  <td className="px-3 py-1.5 text-zinc-600 text-[10px]">{mat?.birim || 'Ad'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-zinc-600 text-[10px]">{mat?.minStok || '—'}</td>
                </tr>)
              })}
            </tbody>
          </table>
        )}

        {tab === 'hareketler' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Tarih</th><th className="text-left px-4 py-2.5">Kod</th><th className="text-left px-4 py-2.5">Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Miktar</th><th className="text-left px-4 py-2.5">Açıklama</th></tr></thead>
            <tbody>
              {filteredHareketler.map(h => (
                <tr key={h.id} className="border-b border-border/30 hover:bg-bg-3/30">
                  <td className="px-4 py-1.5 font-mono text-zinc-500">{h.tarih}</td>
                  <td className="px-4 py-1.5 font-mono text-accent text-[11px]">{h.malkod}</td>
                  <td className="px-4 py-1.5 text-zinc-300">{h.malad}</td>
                  <td className="px-4 py-1.5"><span className={`px-1.5 py-0.5 rounded text-[10px] ${h.tip === 'giris' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>{h.tip === 'giris' ? '↑ Giriş' : '↓ Çıkış'}</span></td>
                  <td className="px-4 py-1.5 text-right font-mono">{h.miktar}</td>
                  <td className="px-4 py-1.5 text-zinc-500 max-w-[200px] truncate">{h.aciklama || '—'}</td>
                  <td className="px-4 py-1.5 text-right">
                    {!h.logId && <><button onClick={async () => {
                      const newMiktar = await showPrompt('Yeni miktar', 'Miktar', String(h.miktar))
                      if (!newMiktar) return
                      await supabase.from('uys_stok_hareketler').update({ miktar: parseFloat(newMiktar) || h.miktar }).eq('id', h.id)
                      loadAll(); toast.success('Stok hareketi güncellendi')
                    }} className="text-zinc-600 hover:text-amber text-[10px] mr-1">Düzenle</button>
                    <button onClick={async () => {
                      if (!await showConfirm('Bu stok hareketini silmek istediğinize emin misiniz?')) return
                      await supabase.from('uys_stok_hareketler').delete().eq('id', h.id)
                      loadAll(); toast.success('Stok hareketi silindi')
                    }} className="text-zinc-600 hover:text-red text-[10px]">Sil</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'sayim' && (
          <div className="p-4">
            <p className="text-xs text-zinc-500 mb-3">Fiziksel sayım sonuçlarını girin — sistem stoğuyla karşılaştırılır.</p>
            <div className="space-y-2">
              {filteredStok.slice(0, 30).map(s => (
                <div key={s.malkod} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-accent w-24">{s.malkod}</span>
                  <span className="flex-1 text-zinc-300">{s.malad}</span>
                  <span className="text-zinc-500 w-16 text-right">Sistem: {Math.round(s.miktar)}</span>
                  <input type="number" placeholder="Sayım" data-malkod={s.malkod}
                    className="w-20 px-2 py-1 bg-bg-3 border border-border rounded text-xs text-right focus:outline-none focus:border-accent" />
                </div>
              ))}
            </div>
            <button onClick={async () => {
              const inputs = document.querySelectorAll('[data-malkod]') as NodeListOf<HTMLInputElement>
              let farklar = 0
              inputs.forEach(inp => {
                const sayim = parseFloat(inp.value)
                if (isNaN(sayim)) return
                const malkod = inp.dataset.malkod || ''
                const stokItem = stokMap.find(s => s.malkod === malkod)
                if (!stokItem) return
                const fark = sayim - stokItem.miktar
                if (Math.abs(fark) > 0.01) {
                  supabase.from('uys_stok_hareketler').insert({
                    id: uid(), tarih: today(), malkod, malad: stokItem.malad,
                    miktar: Math.abs(fark), tip: fark > 0 ? 'giris' : 'cikis',
                    aciklama: `Sayım farkı: sistem ${Math.round(stokItem.miktar)}, sayım ${sayim}`,
                  })
                  farklar++
                }
              })
              if (farklar > 0) { loadAll(); toast.success(farklar + ' fark düzeltmesi kaydedildi') }
              else toast.info('Fark bulunamadı')
            }} className="mt-3 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
              Sayımı Uygula
            </button>
          </div>
        )}
      </div>

      {showGiris && <StokGirisModal materials={materials} onClose={() => setShowGiris(false)} onSaved={() => { setShowGiris(false); loadAll(); toast.success('Stok hareketi kaydedildi') }} />}
    </div>
  )
}

function StokGirisModal({ materials, onClose, onSaved }: {
  materials: { id: string; kod: string; ad: string }[]
  onClose: () => void; onSaved: () => void
}) {
  const [malkod, setMalkod] = useState('')
  const [miktar, setMiktar] = useState('')
  const [tip, setTip] = useState<'giris' | 'cikis'>('giris')
  const [aciklama, setAciklama] = useState('')
  const [search, setSearch] = useState('')

  const filteredMats = materials.filter(m => !search || (m.kod + m.ad).toLowerCase().includes(search.toLowerCase())).slice(0, 20)
  const selectedMat = materials.find(m => m.kod === malkod)

  async function save() {
    if (!malkod || !miktar) { toast.error('Malzeme ve miktar zorunlu'); return }
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), tarih: today(), malkod, malad: selectedMat?.ad || malkod,
      miktar: parseFloat(miktar), tip, aciklama: aciklama || (tip === 'giris' ? 'Manuel giriş' : 'Manuel çıkış'),
    })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Manuel Stok Giriş/Çıkış</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme *</label>
            <input value={search} onChange={e => { setSearch(e.target.value); setMalkod('') }} placeholder="Malzeme ara..."
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            {search && !malkod && (
              <div className="mt-1 max-h-32 overflow-y-auto bg-bg-2 border border-border rounded-lg">
                {filteredMats.map(m => (
                  <button key={m.id} onClick={async () => { setMalkod(m.kod); setSearch(m.kod + ' — ' + m.ad) }}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-bg-3 truncate">
                    <span className="font-mono text-accent">{m.kod}</span> — {m.ad}
                  </button>
                ))}
              </div>
            )}
            {malkod && <div className="mt-1 text-[11px] text-green">✓ {selectedMat?.ad}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Tip</label>
            <select value={tip} onChange={e => setTip(e.target.value as 'giris' | 'cikis')} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="giris">Giriş</option><option value="cikis">Çıkış</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Miktar *</label>
            <input type="number" min={0.01} value={miktar} onChange={e => setMiktar(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Açıklama</label>
          <input value={aciklama} onChange={e => setAciklama(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" placeholder="Opsiyonel..." /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Kaydet</button>
        </div>
      </div>
    </div>
  )
}
