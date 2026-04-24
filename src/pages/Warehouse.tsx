import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { Search, Download, Plus, Upload } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'

export function Warehouse() {
  const { stokHareketler, materials, acikBarlar, loadAll } = useStore()
  const { can, user } = useAuth()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'stok'|'hareketler'|'sayim'|'acikBarlar'|'hurda'>('stok')
  const [showGiris, setShowGiris] = useState(false)
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [detayHam, setDetayHam] = useState<string | null>(null)  // v15.34 — açık bar detay modal

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
          {can('stok_onarim') && <button onClick={() => stokOnar()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-amber" title="Negatif stokları sıfırla">🔧 Onar</button>}
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
          {can('stok_giris') && <button onClick={() => setShowGiris(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Manuel Giriş/Çıkış</button>}
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        <select value={tab} onChange={e => setTab(e.target.value as 'stok'|'hareketler'|'sayim'|'acikBarlar'|'hurda')} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300">
          <option value="stok">Anlık Stok</option>
          <option value="hareketler">Hareketler</option>
          <option value="sayim">Stok Sayım</option>
          <option value="acikBarlar">Açık Bar Havuzu</option>
          <option value="hurda">Hurdaya Gönderilen</option>
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

        {tab === 'acikBarlar' && (() => {
          // Ham malkod bazlı grupla + filtreye göre ara
          const aktifler = acikBarlar.filter(a => a.durum === 'acik')
          const q = search.trim().toLowerCase()
          const filtered = q
            ? aktifler.filter(a => (a.hamMalkod + ' ' + a.hamMalad).toLowerCase().includes(q))
            : aktifler
          const gruplu: Record<string, { hamMalkod: string; hamMalad: string; adet: number; toplamMm: number; barlar: typeof aktifler }> = {}
          filtered.forEach(a => {
            const k = a.hamMalkod
            if (!gruplu[k]) gruplu[k] = { hamMalkod: k, hamMalad: a.hamMalad || k, adet: 0, toplamMm: 0, barlar: [] }
            gruplu[k].adet++
            gruplu[k].toplamMm += a.uzunlukMm
            gruplu[k].barlar.push(a)
          })
          const rows = Object.values(gruplu).sort((a, b) => (a.hamMalad || '').localeCompare(b.hamMalad || '', 'tr'))
          return (
            <div>
              <div className="px-4 py-2 bg-bg-3/40 border-b border-border text-[11px] text-zinc-500">
                {aktifler.length} açık bar · {rows.length} ham malzeme · toplam {Math.round(aktifler.reduce((a, b) => a + b.uzunlukMm, 0))} mm
              </div>
              {!rows.length ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  Açık bar havuzunda kayıt yok. Kesim planları tamamlandıkça artık barlar buraya düşer.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-right px-4 py-2.5">Bar Adet</th><th className="text-right px-4 py-2.5">Toplam mm</th><th className="text-left px-4 py-2.5">Uzunluklar</th><th className="text-right px-4 py-2.5 w-20"></th></tr></thead>
                  <tbody>
                    {rows.map(g => (
                      <tr key={g.hamMalkod} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-4 py-2">
                          <div className="font-mono text-accent text-[11px]">{g.hamMalkod}</div>
                          <div className="text-zinc-500 text-[10px]">{g.hamMalad}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-zinc-200">{g.adet}</td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-300">{Math.round(g.toplamMm)}</td>
                        <td className="px-4 py-2 text-zinc-400 text-[10px]">
                          {g.barlar.sort((a, b) => b.uzunlukMm - a.uzunlukMm).slice(0, 8).map(b => (
                            <span key={b.id} className="inline-block mr-1.5 px-1.5 py-0.5 bg-bg-3 rounded font-mono">{Math.round(b.uzunlukMm)}</span>
                          ))}
                          {g.barlar.length > 8 && <span className="text-zinc-600">+{g.barlar.length - 8}</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => setDetayHam(g.hamMalkod)} className="px-2 py-1 bg-bg-3 hover:bg-bg-3/70 text-zinc-300 hover:text-accent rounded text-[10px]">
                            Detay
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}

        {tab === 'hurda' && (() => {
          // v15.34.2 — Hurdaya Gönderilen barlar. Düz liste, tarih azalan sıralı.
          const hurdalar = [...acikBarlar]
            .filter(a => a.durum === 'hurda')
            .sort((a, b) => (b.hurdaTarihi || '').localeCompare(a.hurdaTarihi || ''))
          const q = search.trim().toLowerCase()
          const filtered = q
            ? hurdalar.filter(a =>
                (a.hamMalkod + ' ' + a.hamMalad + ' ' + (a.hurdaKullaniciAd || '') + ' ' + (a.hurdaSebep || ''))
                  .toLowerCase().includes(q))
            : hurdalar
          const toplamMm = filtered.reduce((a, b) => a + (b.uzunlukMm || 0), 0)
          return (
            <div>
              <div className="px-4 py-2 bg-bg-3/40 border-b border-border text-[11px] text-zinc-500">
                {filtered.length} hurda bar · toplam {Math.round(toplamMm)} mm
                {q && <span className="ml-2">({hurdalar.length} toplam)</span>}
              </div>
              {!filtered.length ? (
                <div className="p-8 text-center text-zinc-500 text-xs">
                  {hurdalar.length ? 'Arama kriterine uyan hurda yok.' : 'Hurda kaydı yok. Açık Bar Havuzu → Detay → "Hurdaya Gönder" ile hurda işaretlenir.'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-2"><tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-4 py-2.5">Ham Malzeme</th>
                    <th className="text-right px-4 py-2.5">Uzunluk</th>
                    <th className="text-left px-4 py-2.5">Hurda Tarihi</th>
                    <th className="text-left px-4 py-2.5">Kullanıcı</th>
                    <th className="text-left px-4 py-2.5">Sebep</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(b => (
                      <tr key={b.id} className="border-b border-border/30 hover:bg-bg-3/30">
                        <td className="px-4 py-2">
                          <div className="font-mono text-accent text-[11px]">{b.hamMalkod}</div>
                          <div className="text-zinc-500 text-[10px]">{b.hamMalad}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                        <td className="px-4 py-2 text-zinc-400 text-[11px] font-mono">
                          {(b.hurdaTarihi || '').slice(0, 16).replace('T', ' ') || '-'}
                        </td>
                        <td className="px-4 py-2 text-zinc-300">{b.hurdaKullaniciAd || '-'}</td>
                        <td className="px-4 py-2 text-zinc-400 text-[11px]">
                          {b.hurdaSebep || <span className="text-zinc-600 italic">sebepsiz</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })()}
      </div>

      {showGiris && <StokGirisModal materials={materials} onClose={() => setShowGiris(false)} onSaved={() => { setShowGiris(false); loadAll(); toast.success('Stok hareketi kaydedildi') }} />}
      {detayHam && (
        <AcikBarHurdaModal
          hamMalkod={detayHam}
          barlar={acikBarlar.filter(b => b.hamMalkod === detayHam)}
          canHurda={can('acikbar_hurda')}
          currentUserId={user?.dbId || user?.email || user?.username || ''}
          currentUserAd={user?.username || ''}
          onClose={() => setDetayHam(null)}
          onSaved={() => { loadAll() }}
        />
      )}
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
  const [showMatSearch, setShowMatSearch] = useState(false)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Manuel Stok Giriş/Çıkış</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Malzeme *</label>
            <div className="flex items-center gap-1">
              <input value={search} onChange={e => { setSearch(e.target.value); setMalkod('') }} placeholder="Malzeme ara..."
                className="flex-1 px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
              <button type="button" onClick={() => setShowMatSearch(true)} title="Detaylı arama (ölçü filtreli)"
                className="w-9 h-9 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent hover:border-accent/50 shrink-0">
                <Search size={12} />
              </button>
            </div>
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
      {showMatSearch && (
        <MaterialSearchModal
          materials={materials as any}
          title="Malzeme Ara — Ölçü Filtreli"
          onSelect={(mat) => { setMalkod(mat.kod); setSearch(mat.kod + ' — ' + mat.ad); setShowMatSearch(false) }}
          onClose={() => setShowMatSearch(false)}
        />
      )}
    </div>
  )
}

// ═══ AÇIK BAR HURDA MODALI — v15.34 ═══
// Belirli bir ham malzemenin açık barlarını listeler, checkbox ile seçim,
// toplu hurdaya gönderme. Hurdaya giden barlar uys_acik_barlar tablosunda
// durum='hurda' + hurda_tarihi/sebep/kullanici alanları ile işaretlenir.
function AcikBarHurdaModal({
  hamMalkod, barlar, canHurda, currentUserId, currentUserAd, onClose, onSaved,
}: {
  hamMalkod: string
  barlar: import('@/types').AcikBar[]
  canHurda: boolean
  currentUserId: string
  currentUserAd: string
  onClose: () => void
  onSaved: () => void
}) {
  const [secimler, setSecimler] = useState<Set<string>>(new Set())
  const [sebep, setSebep] = useState('')
  const [hurdayiGoster, setHurdayiGoster] = useState(false)
  const [loading, setLoading] = useState(false)

  const hamMalad = barlar[0]?.hamMalad || hamMalkod
  const aktifSayi = barlar.filter(b => b.durum === 'acik').length
  const hurdaSayi = barlar.filter(b => b.durum === 'hurda').length
  const tuketilmisSayi = barlar.filter(b => b.durum === 'tuketildi').length

  // Görüntülenecek liste: varsayılan sadece acik; toggle'la hurda da görünür
  const gosterilecek = barlar
    .filter(b => b.durum === 'acik' || (hurdayiGoster && b.durum === 'hurda'))
    .sort((a, b) => {
      // Açıklar önce, sonra uzunluk azalan
      if (a.durum !== b.durum) return a.durum === 'acik' ? -1 : 1
      return (b.uzunlukMm || 0) - (a.uzunlukMm || 0)
    })

  function toggleSec(id: string) {
    const y = new Set(secimler)
    if (y.has(id)) y.delete(id); else y.add(id)
    setSecimler(y)
  }
  function tumAcikSec() {
    setSecimler(new Set(gosterilecek.filter(b => b.durum === 'acik').map(b => b.id)))
  }
  function temizle() { setSecimler(new Set()) }

  const secilenBarlar = barlar.filter(b => secimler.has(b.id) && b.durum === 'acik')
  const toplamMm = secilenBarlar.reduce((a, b) => a + (b.uzunlukMm || 0), 0)

  async function hurdayaGonder() {
    if (!secilenBarlar.length) { toast.error('Seçim yok'); return }
    if (!currentUserAd) { toast.error('Kullanıcı adı tespit edilemedi. Yeniden giriş yap.'); return }
    const onay = await showConfirm(
      `${secilenBarlar.length} açık bar (${Math.round(toplamMm)} mm) hurdaya gönderilecek. Onaylıyor musun?`
    )
    if (!onay) return

    setLoading(true)
    try {
      const now = new Date()
      const nowIso = now.toISOString()
      const tarihKisa = nowIso.slice(0, 10)  // YYYY-MM-DD (fire_logs.tarih formatı)
      const sebepClean = sebep.trim()

      // 1. uys_acik_barlar: durum + hurda alanları
      const { error: e1 } = await supabase
        .from('uys_acik_barlar')
        .update({
          durum: 'hurda',
          hurda_tarihi: nowIso,
          hurda_sebep: sebepClean || null,
          hurda_kullanici_id: currentUserId,
          hurda_kullanici_ad: currentUserAd,
        })
        .in('id', secilenBarlar.map(b => b.id))

      if (e1) { console.error('[hurda] acikBar update:', e1); toast.error('Hurda işlemi başarısız: ' + e1.message); return }

      // 2. uys_fire_logs: her hurda bar için bir fire kaydı (tip='bar_hurda')
      //    Rapor takibi için. qty=1 (bar adedi), uzunluk_mm dolu.
      const fireRows = secilenBarlar.map(b => ({
        id: uid(),
        log_id: null,
        wo_id: null,
        tarih: tarihKisa,
        malkod: b.hamMalkod,
        malad: b.hamMalad,
        qty: 1,
        ie_no: '',
        op_ad: currentUserAd,
        operatorlar: [],
        not_: sebepClean ? 'Açık bar hurda — ' + sebepClean : 'Açık bar hurda',
        tip: 'bar_hurda',
        uzunluk_mm: b.uzunlukMm,
      }))
      const { error: e2 } = await supabase.from('uys_fire_logs').insert(fireRows)
      if (e2) {
        // Hurda zaten kaydedildi, fire log başarısız ise uyar ama geri alma
        console.error('[hurda] fire_log insert:', e2)
        toast.warning('Hurda kaydedildi, fire log yazılamadı: ' + e2.message)
      }

      toast.success(`${secilenBarlar.length} bar hurdaya gönderildi`)
      setSecimler(new Set())
      setSebep('')
      onSaved()
      // Kalan açık bar yoksa modal'ı kapat
      if (aktifSayi - secilenBarlar.length <= 0) onClose()
    } catch (e: any) {
      console.error('[hurda] exception:', e)
      toast.error('Hurda işlemi başarısız: ' + (e?.message || 'bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Başlık */}
        <div className="px-6 py-4 border-b border-border">
          <div className="font-mono text-accent text-sm">{hamMalkod}</div>
          <div className="text-zinc-400 text-xs">{hamMalad}</div>
          <div className="mt-1.5 text-[11px] text-zinc-500">
            <span className="text-green">{aktifSayi} açık</span>
            {hurdaSayi > 0 && <span> · <span className="text-red-400">{hurdaSayi} hurda</span></span>}
            {tuketilmisSayi > 0 && <span> · <span className="text-zinc-500">{tuketilmisSayi} tüketilmiş</span></span>}
          </div>
        </div>

        {/* Kontrol çubuğu */}
        <div className="px-6 py-2.5 border-b border-border flex items-center justify-between text-[11px]">
          <label className="flex items-center gap-2 text-zinc-400 cursor-pointer select-none">
            <input type="checkbox" checked={hurdayiGoster} onChange={e => setHurdayiGoster(e.target.checked)} />
            Hurdaya gidenleri de göster
          </label>
          {canHurda && aktifSayi > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={tumAcikSec} className="text-accent hover:underline">Tüm açıkları seç</button>
              <span className="text-zinc-600">·</span>
              <button onClick={temizle} className="text-zinc-400 hover:underline">Temizle</button>
            </div>
          )}
        </div>

        {/* Tablo */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500">
                {canHurda && <th className="w-10 px-3 py-2"></th>}
                <th className="text-right px-3 py-2">Uzunluk</th>
                <th className="text-left px-3 py-2">Oluşma</th>
                <th className="text-left px-3 py-2">Kaynak Plan</th>
                <th className="text-left px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {gosterilecek.map(b => {
                const isHurda = b.durum === 'hurda'
                const secili = secimler.has(b.id)
                return (
                  <tr key={b.id} className={`border-b border-border/30 ${isHurda ? 'opacity-60' : 'hover:bg-bg-3/30'} ${secili ? 'bg-accent/5' : ''}`}>
                    {canHurda && (
                      <td className="px-3 py-1.5 text-center">
                        {!isHurda ? (
                          <input type="checkbox" checked={secili} onChange={() => toggleSec(b.id)} />
                        ) : null}
                      </td>
                    )}
                    <td className="text-right px-3 py-1.5 font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                    <td className="px-3 py-1.5 text-zinc-400">{b.olusmaTarihi || '-'}</td>
                    <td className="px-3 py-1.5 text-zinc-500 font-mono text-[10px]">
                      {b.kaynakPlanId ? '…' + b.kaynakPlanId.slice(-6) : '-'}
                    </td>
                    <td className="px-3 py-1.5">
                      {isHurda ? (
                        <span
                          className="text-red-400 cursor-help"
                          title={`${b.hurdaKullaniciAd || '?'} · ${b.hurdaTarihi?.slice(0, 16).replace('T', ' ') || ''}${b.hurdaSebep ? '\n' + b.hurdaSebep : ''}`}
                        >
                          HURDA
                        </span>
                      ) : (
                        <span className="text-green">AÇIK</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!gosterilecek.length && (
                <tr>
                  <td colSpan={canHurda ? 5 : 4} className="text-center py-8 text-zinc-500 text-xs">
                    Kayıt yok
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Alt alan — sebep + aksiyon */}
        {canHurda ? (
          <div className="px-6 py-4 border-t border-border space-y-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Hurda sebebi (opsiyonel)</label>
              <input
                value={sebep}
                onChange={e => setSebep(e.target.value)}
                placeholder="Örn: Çok kısa, kullanılamaz"
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-400">
                Seçili: <span className="text-zinc-200 font-semibold">{secilenBarlar.length}</span> bar
                {secilenBarlar.length > 0 && (
                  <> · <span className="text-zinc-300 font-mono">{Math.round(toplamMm)}</span> mm</>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
                <button
                  onClick={hurdayaGonder}
                  disabled={!secilenBarlar.length || loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-bg-3 disabled:text-zinc-600 text-white rounded-lg text-xs font-semibold"
                >
                  {loading ? 'Gönderiliyor…' : 'Hurdaya Gönder'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4 border-t border-border flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
          </div>
        )}
      </div>
    </div>
  )
}
