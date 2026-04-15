import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { Search, Download, Plus, Pencil, Trash2, Upload, Copy } from 'lucide-react'
import { MultiCheckDropdown } from '@/components/ui/MultiCheckDropdown'
import type { Material } from '@/types'

export function Materials() {
  const { materials, operations, recipes, loadAll } = useStore()
  const { can, isGuest } = useAuth()
  const [search, setSearch] = useState('')
  const [tipFilter, setTipFilter] = useState<Set<string>>(new Set())
  const [hmTipFilter, setHmTipFilter] = useState<Set<string>>(new Set())
  const [dimBoyUz, setDimBoyUz] = useState('')
  const [dimCap, setDimCap] = useState('')
  const [dimKalinlik, setDimKalinlik] = useState('')
  const [receteFilter, setReceteFilter] = useState<string>('')  // '' | 'var' | 'yok'
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Material | null>(null)

  const tipler = useMemo(() => [...new Set(materials.map(m => m.tip).filter(Boolean))].sort(), [materials])
  const hmTipler = useMemo(() => [...new Set(materials.map(m => m.hammaddeTipi).filter(Boolean))].sort(), [materials])
  const receteKodSet = useMemo(() => new Set(recipes.map(r => r.mamulKod)), [recipes])

  // Ölçü eşleştirme: string başlangıç eşleşmesi
  // 60 → 60, 60.3, 600, 6000 ✓   160 ✗
  // 48 → 48, 48.3, 480 ✓         148 ✗
  // 60,3 → 60.3, 60.31 ✓         60, 600 ✗
  function dimMatch(value: number, searchStr: string): boolean {
    if (!searchStr) return true
    if (!value) return false
    const s = searchStr.replace(',', '.').trim()
    if (!s) return true
    return String(value).startsWith(s)
  }

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (tipFilter.size > 0 && !tipFilter.has(m.tip)) return false
      if (hmTipFilter.size > 0 && !hmTipFilter.has(m.hammaddeTipi || '')) return false
      if (receteFilter === 'var' && (m.tip !== 'YarıMamul' || !receteKodSet.has(m.kod))) return false
      if (receteFilter === 'yok' && (m.tip !== 'YarıMamul' || receteKodSet.has(m.kod))) return false
      if (dimBoyUz && !dimMatch(m.boy, dimBoyUz) && !dimMatch(m.uzunluk, dimBoyUz) && !dimMatch(m.en, dimBoyUz)) return false
      if (dimCap && !dimMatch(m.cap, dimCap)) return false
      if (dimKalinlik && !dimMatch(m.kalinlik, dimKalinlik)) return false
      if (search) return (m.kod + ' ' + m.ad).toLowerCase().includes(search.toLowerCase())
      return true
    })
  }, [materials, search, tipFilter, hmTipFilter, dimBoyUz, dimCap, dimKalinlik, receteFilter, receteKodSet])

  async function deleteMat(id: string) {
    if (!await showConfirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_malzemeler').delete().eq('id', id)
    loadAll(); toast.success('Malzeme silindi')
  }

  // #27: Malzeme Excel Import
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

      let created = 0; let updated = 0; let errors = 0
      for (const row of rows) {
        const kod = String(row['Kod'] || row['kod'] || row['Malzeme Kodu'] || '').trim()
        const ad = String(row['Ad'] || row['ad'] || row['Malzeme Adı'] || row['Malzeme'] || '').trim()
        if (!kod && !ad) continue

        const dataRow: Record<string, unknown> = {
          kod, ad,
          tip: String(row['Tip'] || row['tip'] || 'Hammadde'),
          hammadde_tipi: String(row['HM Tipi'] || row['Hammadde Tipi'] || row['hammadde_tipi'] || ''),
          birim: String(row['Birim'] || row['birim'] || 'Adet'),
          boy: parseFloat(String(row['Boy'] || row['boy'] || 0)) || 0,
          en: parseFloat(String(row['En'] || row['en'] || 0)) || 0,
          kalinlik: parseFloat(String(row['Kalınlık'] || row['kalinlik'] || 0)) || 0,
          uzunluk: parseFloat(String(row['Uzunluk'] || row['uzunluk'] || 0)) || 0,
          cap: parseFloat(String(row['Çap'] || row['cap'] || 0)) || 0,
          min_stok: parseFloat(String(row['Min Stok'] || row['min_stok'] || 0)) || 0,
        }

        const existing = materials.find(m => m.kod === kod)
        if (existing) {
          // GÜNCELLE
          const { error } = await supabase.from('uys_malzemeler').update(dataRow).eq('id', existing.id)
          if (error) { errors++; if (errors === 1) console.error('Update hatası:', error.message) }
          else updated++
        } else {
          // YENİ EKLE
          const { error } = await supabase.from('uys_malzemeler').insert({ id: uid(), ...dataRow })
          if (error) { errors++; if (errors === 1) { console.error('Insert hatası:', error.message); toast.error('Hata: ' + error.message) } }
          else created++
        }
      }
      loadAll()
      toast.success(`${created} yeni eklendi · ${updated} güncellendi` + (errors > 0 ? ` · ${errors} hata` : ''))
    }
    input.click()
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = filtered.map(m => ({ Kod: m.kod, Ad: m.ad, Tip: m.tip, 'HM Tipi': m.hammaddeTipi, Birim: m.birim, Boy: m.boy, En: m.en, Kalınlık: m.kalinlik, Uzunluk: m.uzunluk, Çap: m.cap, 'Min Stok': m.minStok }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Malzemeler')
      XLSX.writeFile(wb, `malzemeler_${today()}.xlsx`)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Malzeme Listesi</h1><p className="text-xs text-zinc-500">{materials.length} malzeme</p></div>
        <div className="flex gap-2">
          {can('mat_excel') && <button onClick={importExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Upload size={13} /> Excel Yükle</button>}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel</button>
          {can('mat_add') && <button onClick={async () => { setEditItem(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Plus size={13} /> Yeni Malzeme</button>}
        </div>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kod veya ad ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
        <MultiCheckDropdown label="Malzeme Tipi" options={tipler} selected={tipFilter} onChange={setTipFilter} />
        {hmTipler.length > 0 && <MultiCheckDropdown label="HM Tipi" options={hmTipler} selected={hmTipFilter} onChange={setHmTipFilter} />}
        <div className="relative w-24">
          <input value={dimBoyUz} onChange={e => setDimBoyUz(e.target.value)} placeholder="Boy/Uz" inputMode="decimal"
            className="w-full px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber" title="Boy / Uzunluk / En" />
        </div>
        <div className="relative w-20">
          <input value={dimCap} onChange={e => setDimCap(e.target.value)} placeholder="Çap" inputMode="decimal"
            className="w-full px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber" />
        </div>
        <div className="relative w-20">
          <input value={dimKalinlik} onChange={e => setDimKalinlik(e.target.value)} placeholder="Kalınlık" inputMode="decimal"
            className="w-full px-2 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber" />
        </div>
        <select value={receteFilter} onChange={e => setReceteFilter(e.target.value)}
          className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-accent">
          <option value="">YM Reçete</option>
          <option value="var">✅ Var</option>
          <option value="yok">⚠ Yok</option>
        </select>
        {(tipFilter.size > 0 || hmTipFilter.size > 0 || dimBoyUz || dimCap || dimKalinlik || receteFilter) && (
          <button onClick={() => { setTipFilter(new Set()); setHmTipFilter(new Set()); setDimBoyUz(''); setDimCap(''); setDimKalinlik(''); setReceteFilter('') }}
            className="px-2 py-2 text-zinc-500 hover:text-red text-[10px]">✕ Temizle</button>
        )}
      </div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-zinc-600">{filtered.length} / {materials.length} malzeme gösteriliyor</p>
      </div>
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-3 py-2 w-[130px]">Kod</th><th className="text-left px-2 py-2">Malzeme Adı</th>
                <th className="text-left px-2 py-2 w-[110px]">Tip</th><th className="text-center px-2 py-2 w-[50px]">Birim</th>
                <th className="text-right px-2 py-2 w-[55px]">Boy</th><th className="text-right px-2 py-2 w-[45px]">En</th>
                <th className="text-right px-2 py-2 w-[50px]">Kalınlık</th><th className="text-right px-2 py-2 w-[60px] text-amber">Uzunluk</th>
                <th className="text-left px-2 py-2 w-[120px]">Operasyon</th><th className="px-1 py-2 w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map(m => {
                const op = operations.find(o => o.id === m.opId)
                return (
                  <tr key={m.id} className="border-b border-border/20 hover:bg-bg-3/30 group/row">
                    <td className="px-3 py-[5px] cursor-pointer" onClick={async () => {
                      const yeni = await showPrompt('Malzeme kodu değiştir', 'Yeni kod', m.kod)
                      if (yeni && yeni.trim() !== m.kod) { await supabase.from('uys_malzemeler').update({ kod: yeni.trim() }).eq('id', m.id); loadAll(); toast.success('Kod güncellendi') }
                    }}>
                      <span className="font-mono text-accent text-[10px] leading-tight break-all">{m.kod}</span>
                    </td>
                    <td className="px-2 py-[5px] text-zinc-300 cursor-pointer hover:text-accent truncate max-w-0" onClick={async () => {
                      const yeni = await showPrompt('Malzeme adı değiştir', 'Yeni ad', m.ad)
                      if (yeni && yeni.trim() !== m.ad) { await supabase.from('uys_malzemeler').update({ ad: yeni.trim() }).eq('id', m.id); loadAll(); toast.success('Ad güncellendi') }
                    }}><span className="truncate block">{m.ad}</span></td>
                    <td className="px-2 py-[5px]">
                      <span className="px-1.5 py-0.5 bg-bg-3 rounded text-[10px] text-zinc-400 whitespace-nowrap">{m.tip || '—'}{m.hammaddeTipi && ` · ${m.hammaddeTipi}`}</span>
                      {m.tip === 'YarıMamul' && (
                        receteKodSet.has(m.kod)
                          ? <span className="ml-1 px-1 py-0.5 bg-green/10 text-green rounded text-[9px]">RC ✓</span>
                          : <span className="ml-1 px-1 py-0.5 bg-amber/10 text-amber rounded text-[9px]">RC ✗</span>
                      )}
                    </td>
                    <td className="px-2 py-[5px] text-zinc-500 text-center">{m.birim}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.boy || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.en || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-zinc-500">{m.kalinlik || '—'}</td>
                    <td className="px-2 py-[5px] text-right font-mono text-amber">{m.uzunluk || '—'}</td>
                    <td className="px-2 py-[5px] text-zinc-500 text-[10px] truncate">{op?.ad || '—'}</td>
                    <td className="px-1 py-[5px] text-right whitespace-nowrap opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {can('mat_add') && <button onClick={async () => {
                        const newId = uid()
                        const row = { id: newId, kod: m.kod + '-KOPYA', ad: m.ad + ' (Kopya)', tip: m.tip, hammadde_tipi: m.hammaddeTipi, birim: m.birim, boy: m.boy, en: m.en, kalinlik: m.kalinlik, uzunluk: m.uzunluk, cap: m.cap, min_stok: m.minStok, op_id: m.opId || null, op_kod: m.opKod || null }
                        await supabase.from('uys_malzemeler').insert(row)
                        loadAll(); toast.success('Malzeme kopyalandı')
                      }} className="p-0.5 text-zinc-600 hover:text-amber" title="Kopyala"><Copy size={11} /></button>}
                      {can('mat_edit') && <button onClick={async () => { setEditItem(m); setShowForm(true) }} className="p-0.5 text-zinc-600 hover:text-accent"><Pencil size={11} /></button>}
                      {can('mat_delete') && <button onClick={() => deleteMat(m.id)} className="p-0.5 text-zinc-600 hover:text-red"><Trash2 size={11} /></button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length > 300 && <div className="p-2 text-center text-zinc-600 text-[10px]">+{filtered.length - 300} daha</div>}
        </div>
      </div>
      {showForm && <MatFormModal initial={editItem} operations={operations} tipler={tipler} onClose={() => { setShowForm(false); setEditItem(null) }} onSaved={() => { setShowForm(false); setEditItem(null); loadAll(); toast.success(editItem ? 'Güncellendi' : 'Eklendi') }} />}
    </div>
  )
}

function MatFormModal({ initial, operations, tipler, onClose, onSaved }: {
  initial: Material | null; operations: { id: string; kod: string; ad: string }[]
  tipler: string[]; onClose: () => void; onSaved: () => void
}) {
  const [kod, setKod] = useState(initial?.kod || '')
  const [ad, setAd] = useState(initial?.ad || '')
  const [tip, setTip] = useState(initial?.tip || 'Hammadde')
  const [hammaddeTipi, setHammaddeTipi] = useState(initial?.hammaddeTipi || '')
  const [birim, setBirim] = useState(initial?.birim || 'Adet')
  const [boy, setBoy] = useState(String(initial?.boy || ''))
  const [en, setEn] = useState(String(initial?.en || ''))
  const [kalinlik, setKalinlik] = useState(String(initial?.kalinlik || ''))
  const [uzunluk, setUzunluk] = useState(String(initial?.uzunluk || ''))
  const [cap, setCap] = useState(String(initial?.cap || ''))
  const [minStok, setMinStok] = useState(String(initial?.minStok || ''))
  const [opId, setOpId] = useState(initial?.opId || '')
  const [saving, setSaving] = useState(false)

  // #34: Boy/En Tahmin — benzer malzemelerden öner
  const { materials: allMaterials } = useStore()
  function tahminEt() {
    if (!kod) return
    const prefix = kod.replace(/\d{2,}$/, '') // Son rakamları kaldır
    const benzerler = allMaterials.filter(m => m.kod.startsWith(prefix) && m.kod !== kod && m.boy > 0)
    if (benzerler.length) {
      const avg = { boy: Math.round(benzerler.reduce((a, m) => a + m.boy, 0) / benzerler.length), en: Math.round(benzerler.reduce((a, m) => a + (m.en || 0), 0) / benzerler.length) }
      if (!boy || boy === '0') setBoy(String(avg.boy))
      if ((!en || en === '0') && avg.en > 0) setEn(String(avg.en))
      toast.info(`${benzerler.length} benzer malzemeden tahmin: Boy=${avg.boy}, En=${avg.en}`)
    } else {
      // Ad'dan rakam çıkarmayı dene
      const nums = ad.match(/(\d{3,})/g)
      if (nums && nums.length >= 1) { setBoy(nums[0]); toast.info('Ad\'dan tahmin: Boy=' + nums[0]) }
      else toast.info('Tahmin yapılamadı — benzer malzeme yok')
    }
  }

  async function save() {
    if (!kod.trim() || !ad.trim()) { toast.error('Kod ve Ad zorunlu'); return }
    setSaving(true)
    const op = operations.find(o => o.id === opId)
    const row = {
      kod: kod.trim(), ad: ad.trim(), tip, hammadde_tipi: tip === 'Hammadde' ? hammaddeTipi : '', birim, boy: parseFloat(boy) || 0,
      en: parseFloat(en) || 0, kalinlik: parseFloat(kalinlik) || 0, uzunluk: parseFloat(uzunluk) || 0, cap: parseFloat(cap) || 0,
      min_stok: parseFloat(minStok) || 0, op_id: opId || null, op_kod: op?.kod || null,
    }
    if (initial?.id) {
      await supabase.from('uys_malzemeler').update(row).eq('id', initial.id)
    } else {
      await supabase.from('uys_malzemeler').insert({ id: uid(), ...row })
    }
    setSaving(false); onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">{initial ? 'Malzeme Düzenle' : 'Yeni Malzeme'}</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Kodu *</label>
            <input value={kod} onChange={e => setKod(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Tipi</label>
            <select value={tip} onChange={e => { setTip(e.target.value); if (e.target.value !== 'Hammadde') setHammaddeTipi('') }} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="Hammadde">Hammadde</option><option value="YarıMamul">Yarı Mamul</option>
              <option value="Mamul">Mamul</option><option value="Sarf">Sarf</option>
            </select></div>
          </div>
          {tip === 'Hammadde' && (
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Hammadde Tipi</label>
            <select value={hammaddeTipi} onChange={e => setHammaddeTipi(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              <option value="Boru">Boru</option><option value="Profil">Profil</option>
              <option value="Levha">Levha</option><option value="Sac">Sac</option>
              <option value="Çubuk">Çubuk</option><option value="Lama">Lama</option>
              <option value="Diğer">Diğer</option>
            </select></div>
          )}
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Malzeme Adı *</label>
          <input value={ad} onChange={e => setAd(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Birim</label>
            <select value={birim} onChange={e => setBirim(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option>Adet</option><option>Kg</option><option>Metre</option><option>m²</option><option>Litre</option><option>Takım</option>
            </select></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Çap (mm)</label>
            <input type="number" value={cap} onChange={e => setCap(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
            <div><label className="text-[11px] text-zinc-500 mb-1 block">Min Stok</label>
            <input type="number" value={minStok} onChange={e => setMinStok(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          </div>
          {/* Ölçü alanları — profil/boru/levha/sac */}
          <div className="p-3 bg-bg-3/30 border border-border/50 rounded-lg">
            <div className="text-[10px] text-zinc-500 mb-2">
              {['Profil','Boru','Çubuk','Lama'].includes(hammaddeTipi) ? '📐 Kesit: Genişlik × Yükseklik × Et Kalınlığı + Bar Uzunluğu' : '📐 Plaka/Parça Ölçüleri'}
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div><label className="text-[11px] text-zinc-500 mb-1 block">{['Profil','Boru','Çubuk','Lama'].includes(hammaddeTipi) ? 'Genişlik (mm)' : 'Boy (mm)'}</label>
              <input type="number" value={boy} onChange={e => setBoy(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">{['Profil','Boru','Çubuk','Lama'].includes(hammaddeTipi) ? 'Yükseklik (mm)' : 'En (mm)'}</label>
              <input type="number" value={en} onChange={e => setEn(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-zinc-500 mb-1 block">{['Profil','Boru'].includes(hammaddeTipi) ? 'Et Kalınlığı (mm)' : 'Kalınlık (mm)'}</label>
              <input type="number" value={kalinlik} onChange={e => setKalinlik(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
              <div><label className="text-[11px] text-amber mb-1 block font-semibold">Uzunluk (mm)</label>
              <input type="number" value={uzunluk} onChange={e => setUzunluk(e.target.value)} placeholder="ör: 6000" className="w-full px-3 py-2 bg-bg-2 border border-amber/30 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber" /></div>
            </div>
          </div>
          <button type="button" onClick={tahminEt} className="text-[11px] text-accent hover:underline">🔮 Benzer malzemelerden boy/en tahmin et</button>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Operasyon</label>
            <select value={opId} onChange={e => setOpId(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Seçin —</option>
              {operations.map(o => <option key={o.id} value={o.id}>{o.kod} — {o.ad}</option>)}
            </select></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
        </div>
      </div>
    </div>
  )
}
