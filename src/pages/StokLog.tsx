import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useProductionStore, useOrderStore, useWarehouseStore } from '@/store'
import { toast } from 'sonner'
import { Search, X, Download, RefreshCw, ChevronDown, ChevronUp, Edit2, Check, ArrowUpCircle, ArrowDownCircle, Package, Truck, Wrench, AlertCircle, Plus } from 'lucide-react'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { today } from '@/lib/utils'
import { addStokHareketi } from '@/lib/stokHelper'

const _malkodSecimSchema = z.object({
  kod: z.string().trim().min(1, 'Malzeme kodu zorunlu').max(50, 'Malzeme kodu en fazla 50 karakter')
    .refine(s => !/\s/.test(s), 'Malzeme kodu boşluk içeremez'),
  ad: z.string().trim().min(1, 'Malzeme adı zorunlu').max(200, 'Malzeme adı en fazla 200 karakter'),
})

const _aciklamaSchema = z.string().trim().max(500, 'Açıklama en fazla 500 karakter')

const manuelHareketSchema = z.object({
  malkod:   z.string().trim().min(1, 'Malzeme seçimi zorunlu'),
  malad:    z.string().trim(),
  miktar:   z.number({ invalid_type_error: 'Geçersiz miktar' }).positive('Miktar 0\'dan büyük olmalı').finite('Geçersiz miktar'),
  tip:      z.enum(['giris', 'cikis'] as const),
  aciklama: z.string().trim().max(500, 'Açıklama en fazla 500 karakter'),
  tarih:    z.string().min(1, 'Tarih zorunlu'),
})

/* ───────── tipler ───────── */
interface StokHareket {
  id: string
  tarih: string
  malkod: string
  malad: string | null
  miktar: number
  tip: 'giris' | 'cikis' | 'bar_acilis' | 'rezerv'
  log_id: string | null
  wo_id: string | null
  aciklama: string | null
  updated_at: string
  test_run_id: string | null
  rezerv_order_id: string | null
  tedarik_id: string | null
  // join
  wo_order_id?: string | null
  siparis_no?: string | null
  ie_no?: string | null
}

type Kaynak = 'uretim' | 'manuel' | 'sevkiyat' | 'tedarik' | 'diger'

function kaynak(h: StokHareket): Kaynak {
  if (h.tedarik_id) return 'tedarik'
  if (h.log_id || h.wo_id) return 'uretim'
  if (h.aciklama?.toLowerCase().startsWith('sevkiyat')) return 'sevkiyat'
  if (h.tip === 'giris') return 'manuel'
  return 'diger'
}

function kaynakLabel(k: Kaynak) {
  switch (k) {
    case 'uretim':    return { label: 'Üretim',    cls: 'bg-accent/15 text-accent' }
    case 'manuel':    return { label: 'Manuel',    cls: 'bg-amber/15 text-amber' }
    case 'sevkiyat':  return { label: 'Sevkiyat',  cls: 'bg-green/15 text-green' }
    case 'tedarik':   return { label: 'Tedarik',   cls: 'bg-purple/15 text-purple-400' }
    default:          return { label: 'Diğer',     cls: 'bg-bg-3 text-zinc-400' }
  }
}

/* ───────── yardımcılar ───────── */
function fmtNum(n: number) {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
}
function fmtDate(s: string) {
  return s?.slice(0, 10) ?? '—'
}
function getIeNo(aciklama: string | null): string | null {
  if (!aciklama) return null
  const m = aciklama.match(/IE-[\w\-]+/i)
  return m ? m[0] : null
}
function getSevkNo(aciklama: string | null): string | null {
  if (!aciklama) return null
  const m = aciklama.match(/Sevkiyat\s*[—-]\s*(\S+)/i)
  return m ? m[1] : null
}

/* ───────── ana bileşen ───────── */
export function StokLog() {
  const workOrders = useProductionStore(s => s.workOrders)
  const orders = useOrderStore(s => s.orders)
  const materials = useWarehouseStore(s => s.materials)

  const [rows, setRows]           = useState<StokHareket[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [tipFilter, setTipFilter] = useState<'tumu' | 'giris' | 'cikis' | 'bar_acilis' | 'rezerv'>('tumu')
  const [kaynakFilter, setKaynakFilter] = useState<'tumu' | Kaynak>('tumu')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [selected, setSelected]   = useState<StokHareket | null>(null)
  const [editNote, setEditNote]   = useState('')
  const [editMode, setEditMode]         = useState(false)
  const [editMalkodMode, setEditMalkodMode] = useState(false)
  const [malkodSearch, setMalkodSearch] = useState('')
  const [saving, setSaving]             = useState(false)
  const [showManuelModal, setShowManuelModal] = useState(false)
  const [sortCol, setSortCol]     = useState<'tarih' | 'malkod' | 'miktar'>('tarih')
  const [sortDir, setSortDir]     = useState<'desc' | 'asc'>('desc')
  // v17.05 — sayfalama
  const PAGE_SIZE = 500
  const [page, setPage]           = useState(0)
  const [totalCount, setTotalCount] = useState<number | null>(null)

  /* ── veri çek — server-side filter push-down v17.05 ── */
  async function load(pg = 0) {
    setLoading(true)
    let q = supabase
      .from('uys_stok_hareketler')
      .select('*', { count: 'exact' })
      .order('tarih', { ascending: sortDir === 'asc' })
      .order('updated_at', { ascending: sortDir === 'asc' })

    // Server-side filtreler — limit öncesi DB'de çalışır
    if (tipFilter !== 'tumu') q = q.eq('tip', tipFilter)
    if (dateFrom) q = q.gte('tarih', dateFrom)
    if (dateTo)   q = q.lte('tarih', dateTo)
    if (search.trim()) {
      const s = search.trim()
      q = (q as any).or(`malkod.ilike.%${s}%,malad.ilike.%${s}%,aciklama.ilike.%${s}%`)
    }

    q = q.range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1)

    const { data, error, count } = await q
    if (error) { toast.error('Yüklenemedi: ' + error.message); setLoading(false); return }

    setTotalCount(count ?? null)

    const enriched: StokHareket[] = (data ?? []).map(h => {
      const wo = workOrders.find(w => w.id === h.wo_id)
      const ord = wo ? orders.find(o => o.id === wo.orderId) : null
      return {
        ...h,
        wo_order_id: wo?.orderId ?? null,
        siparis_no: ord ? (ord as any).sipNo ?? ord.id : null,
        ie_no: wo?.ieNo ?? getIeNo(h.aciklama),
      }
    })
    setRows(enriched)
    setPage(pg)
    setLoading(false)
  }

  // Filtre/sort değişince sayfa 0'a dön
  useEffect(() => { load(0) }, [tipFilter, dateFrom, dateTo, search, sortDir, workOrders.length])  // eslint-disable-line

  /* ── filtrele ── */
  const filtered = useMemo(() => {
    let r = rows

    if (tipFilter !== 'tumu') r = r.filter(h => h.tip === tipFilter)
    if (kaynakFilter !== 'tumu') r = r.filter(h => kaynak(h) === kaynakFilter)

    if (dateFrom) r = r.filter(h => h.tarih >= dateFrom)
    if (dateTo)   r = r.filter(h => h.tarih <= dateTo)

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(h =>
        h.malkod.toLowerCase().includes(q) ||
        (h.malad ?? '').toLowerCase().includes(q) ||
        (h.aciklama ?? '').toLowerCase().includes(q) ||
        (h.ie_no ?? '').toLowerCase().includes(q) ||
        (h.id ?? '').toLowerCase().includes(q)
      )
    }

    // sıralama
    r = [...r].sort((a, b) => {
      let v = 0
      if (sortCol === 'tarih')  v = a.tarih.localeCompare(b.tarih)
      if (sortCol === 'malkod') v = a.malkod.localeCompare(b.malkod)
      if (sortCol === 'miktar') v = a.miktar - b.miktar
      return sortDir === 'asc' ? v : -v
    })

    return r
  }, [rows, tipFilter, kaynakFilter, dateFrom, dateTo, search, sortCol, sortDir])

  /* ── özet ── */
  const ozet = useMemo(() => {
    const giris    = filtered.filter(h => h.tip === 'giris').reduce((a, h) => a + h.miktar, 0)
    const cikis    = filtered.filter(h => h.tip === 'cikis' || h.tip === 'bar_acilis' || h.tip === 'rezerv').reduce((a, h) => a + h.miktar, 0)
    return { giris, cikis, net: giris - cikis, sayi: filtered.length }
  }, [filtered])

  /* ── malkod değiştir ── */
  async function saveMalkod(yeniMal: { kod: string; ad: string }, toplu: boolean) {
    if (!selected) return
    const _r = _malkodSecimSchema.safeParse(yeniMal)
    if (!_r.success) { toast.error(_r.error.issues[0].message); return }
    const dogruMal = _r.data
    setSaving(true)
    const update = { malkod: dogruMal.kod, malad: dogruMal.ad }
    let error: any
    if (toplu) {
      // Aynı malkod'daki tüm hareketleri güncelle
      const res = await supabase.from('uys_stok_hareketler')
        .update(update).eq('malkod', selected.malkod)
      error = res.error
    } else {
      // Sadece bu hareketi güncelle
      const res = await supabase.from('uys_stok_hareketler')
        .update(update).eq('id', selected.id)
      error = res.error
    }
    if (error) { toast.error('Kaydedilemedi: ' + error.message); setSaving(false); return }
    toast.success(toplu
      ? `"${selected.malkod}" altındaki tüm hareketler → "${dogruMal.kod}" olarak güncellendi`
      : `Malkod güncellendi → ${dogruMal.kod}`)
    setEditMalkodMode(false)
    setMalkodSearch('')
    setSelected(null)
    await load()
    setSaving(false)
  }

  /* ── açıklama düzenle ── */
  async function saveNote() {
    if (!selected) return
    const _r = _aciklamaSchema.safeParse(editNote)
    if (!_r.success) { toast.error(_r.error.issues[0].message); return }
    const yeniAciklama = _r.data
    setSaving(true)
    const { error } = await supabase
      .from('uys_stok_hareketler')
      .update({ aciklama: yeniAciklama })
      .eq('id', selected.id)
    if (error) { toast.error('Kaydedilemedi'); setSaving(false); return }
    toast.success('Açıklama güncellendi')
    setRows(r => r.map(x => x.id === selected.id ? { ...x, aciklama: yeniAciklama } : x))
    setSelected(s => s ? { ...s, aciklama: yeniAciklama } : s)
    setEditMode(false)
    setSaving(false)
  }

  /* ── excel export ── */
  function exportXlsx() {
    const data = filtered.map(h => ({
      'Tarih':       h.tarih,
      'Malkod':      h.malkod,
      'Malzeme Adı': h.malad ?? '',
      'Miktar':      h.miktar,
      'Tip':         h.tip,
      'Kaynak':      kaynakLabel(kaynak(h)).label,
      'IE No':       h.ie_no ?? '',
      'Sipariş No':  h.siparis_no ?? '',
      'Açıklama':    h.aciklama ?? '',
      'ID':          h.id,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stok Log')
    XLSX.writeFile(wb, `StokLog_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  /* ── sıralama header ── */
  function SortBtn({ col, label }: { col: typeof sortCol; label: string }) {
    const active = sortCol === col
    return (
      <button onClick={() => { setSortCol(col); setSortDir(d => active ? (d === 'asc' ? 'desc' : 'asc') : 'desc') }}
        className={`flex items-center gap-1 ${active ? 'text-accent' : 'text-zinc-400 hover:text-zinc-200'}`}>
        {label}
        {active ? (sortDir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>) : null}
      </button>
    )
  }

  /* ── detay panel içeriği ── */
  function DetailPanel() {
    if (!selected) return null
    const k = kaynak(selected)
    const kl = kaynakLabel(k)
    const sevkNo = getSevkNo(selected.aciklama)
    const sipBagli = !!selected.wo_order_id

    return (
      <div className="w-80 flex-shrink-0 bg-bg-1 border-l border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-zinc-200">Hareket Detayı</span>
          <button onClick={() => setSelected(null)} className="text-zinc-500 hover:text-zinc-200">
            <X size={16}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          {/* Tip badge */}
          <div className="flex items-center gap-2">
            {selected.tip === 'giris'
              ? <ArrowUpCircle size={18} className="text-green-400"/>
              : <ArrowDownCircle size={18} className="text-red-400"/>}
            <span className={`font-bold text-base ${selected.tip === 'giris' ? 'text-green-400' : 'text-red-400'}`}>
              {selected.tip === 'giris' ? '+' : '-'}{fmtNum(selected.miktar)} adet
            </span>
          </div>

          {/* Sipariş bağlantı durumu */}
          {selected.tip === 'giris' && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium ${
              sipBagli ? 'bg-accent/10 text-accent' : 'bg-amber/10 text-amber'
            }`}>
              {sipBagli ? <Truck size={13}/> : <Package size={13}/>}
              {sipBagli
                ? `Sipariş bağlı → Sevk edilecek${selected.siparis_no ? ` (${selected.siparis_no})` : ''}`
                : 'Stok için üretim → Depoda kalır'}
            </div>
          )}

          <div className="space-y-2">
            <Row label="Tarih" val={fmtDate(selected.tarih)}/>
            <Row label="Malkod" val={selected.malkod}/>
            <Row label="Malzeme" val={selected.malad ?? '—'}/>
            <Row label="Kaynak" val={
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${kl.cls}`}>{kl.label}</span>
            }/>
            {selected.ie_no && <Row label="IE No" val={selected.ie_no}/>}
            {sevkNo && <Row label="Sevkiyat ID" val={
              <span className="font-mono text-xs text-green-400">{sevkNo}</span>
            }/>}
            {selected.siparis_no && <Row label="Sipariş No" val={selected.siparis_no}/>}
            <Row label="Hareket ID" val={
              <span className="font-mono text-[10px] text-zinc-500">{selected.id}</span>
            }/>
          </div>

          {/* Malkod Değiştir */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-400">MALZEMEYİ DEĞİŞTİR</span>
              {!editMalkodMode && (
                <button onClick={() => { setEditMalkodMode(true); setMalkodSearch('') }}
                  className="text-zinc-500 hover:text-amber flex items-center gap-1 text-xs">
                  <Edit2 size={11}/> Değiştir
                </button>
              )}
            </div>
            {editMalkodMode ? (
              <div className="space-y-2">
                {/* Uyarı */}
                <div className="text-[10px] text-amber bg-amber/10 rounded px-2 py-1.5">
                  ⚠ Mevcut malkod: <span className="font-mono font-bold">{selected.malkod}</span>
                </div>
                {/* Arama */}
                <input
                  autoFocus
                  value={malkodSearch}
                  onChange={e => setMalkodSearch(e.target.value)}
                  placeholder="Malzeme kodu veya adı ara…"
                  className="w-full px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent"
                />
                {/* Sonuçlar */}
                {malkodSearch.trim().length > 1 && (
                  <div className="max-h-40 overflow-y-auto border border-border rounded bg-bg-2 divide-y divide-border/50">
                    {materials
                      .filter(m => m.aktif && (
                        m.kod.toLowerCase().includes(malkodSearch.toLowerCase()) ||
                        m.ad.toLowerCase().includes(malkodSearch.toLowerCase())
                      ))
                      .slice(0, 20)
                      .map(m => (
                        <div key={m.kod} className="px-2 py-1.5">
                          <div className="text-[10px] font-mono text-accent">{m.kod}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{m.ad}</div>
                          <div className="flex gap-1 mt-1">
                            <button
                              onClick={() => saveMalkod({ kod: m.kod, ad: m.ad }, false)}
                              disabled={saving}
                              className="px-2 py-0.5 bg-accent text-white text-[10px] rounded disabled:opacity-40">
                              Bu hareketi değiştir
                            </button>
                            <button
                              onClick={() => saveMalkod({ kod: m.kod, ad: m.ad }, true)}
                              disabled={saving}
                              className="px-2 py-0.5 bg-amber/80 text-black text-[10px] rounded disabled:opacity-40">
                              Tümünü taşı ({selected.malkod})
                            </button>
                          </div>
                        </div>
                      ))}
                    {materials.filter(m => m.aktif && (
                      m.kod.toLowerCase().includes(malkodSearch.toLowerCase()) ||
                      m.ad.toLowerCase().includes(malkodSearch.toLowerCase())
                    )).length === 0 && (
                      <div className="px-2 py-2 text-[10px] text-zinc-500">Sonuç bulunamadı</div>
                    )}
                  </div>
                )}
                <button onClick={() => { setEditMalkodMode(false); setMalkodSearch('') }}
                  className="text-xs text-zinc-500 hover:text-zinc-300">İptal</button>
              </div>
            ) : (
              <div className="text-xs text-zinc-500 italic">
                Yanlış malkod girişlerini buradan malzeme kartından seçerek düzeltebilirsin.
                "Tümünü taşı" seçeneği aynı eski malkod'a ait tüm hareketleri taşır.
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-zinc-400">AÇIKLAMA</span>
              {!editMode && (
                <button onClick={() => { setEditNote(selected.aciklama ?? ''); setEditMode(true) }}
                  className="text-zinc-500 hover:text-accent flex items-center gap-1 text-xs">
                  <Edit2 size={11}/> Düzenle
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-2">
                <textarea
                  value={editNote}
                  onChange={e => setEditNote(e.target.value)}
                  rows={3}
                  className="w-full bg-bg-2 border border-border rounded px-2 py-1.5 text-xs text-zinc-200 resize-none focus:outline-none focus:border-accent"
                />
                <div className="flex gap-2">
                  <button onClick={saveNote} disabled={saving}
                    className="flex items-center gap-1 px-3 py-1 bg-accent text-white text-xs rounded disabled:opacity-50">
                    <Check size={11}/>{saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-3 py-1 bg-bg-3 text-zinc-400 text-xs rounded hover:text-zinc-200">
                    İptal
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-300 bg-bg-2 rounded px-2 py-1.5 min-h-[36px] whitespace-pre-wrap">
                {selected.aciklama || <span className="text-zinc-600 italic">Açıklama yok</span>}
              </p>
            )}
          </div>

          {/* Manuel giriş uyarısı */}
          {k === 'manuel' && selected.tip === 'giris' && (
            <div className="flex gap-2 bg-amber/10 border border-amber/20 rounded p-2 text-xs text-amber">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5"/>
              <span>Manuel giriş — IE/üretim logu yok. Kaynak açıklamayı düzenleyerek belgelenebilir.</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  function Row({ label, val }: { label: string; val: React.ReactNode }) {
    return (
      <div className="flex gap-2">
        <span className="text-zinc-500 w-24 flex-shrink-0">{label}</span>
        <span className="text-zinc-200 flex-1 text-right">{val}</span>
      </div>
    )
  }

  /* ── render ── */
  return (
    <div className="flex flex-col h-full">
      {/* Başlık */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Stok Log</h1>
          <p className="text-xs text-zinc-500">Tüm stok hareketleri — arama, filtreleme ve düzeltme</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowManuelModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent/90">
            <Plus size={13}/> Manuel Hareket Ekle
          </button>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 text-zinc-400 hover:text-zinc-200 rounded text-xs border border-border">
            <RefreshCw size={13}/> Yenile
          </button>
          <button onClick={exportXlsx} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 text-zinc-400 hover:text-zinc-200 rounded text-xs border border-border">
            <Download size={13}/> Excel
          </button>
        </div>
      </div>

      {/* Filtreler */}
      <div className="px-6 py-3 border-b border-border flex flex-wrap gap-3 items-end">
        {/* Arama */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"/>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Malkod, IE no, sevkiyat ID, açıklama…"
            className="w-full pl-8 pr-8 py-1.5 bg-bg-2 border border-border rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"><X size={12}/></button>}
        </div>

        {/* Tip */}
        <div className="flex rounded border border-border overflow-hidden text-xs">
          {(['tumu','giris','cikis','bar_acilis','rezerv'] as const).map(t => (
            <button key={t} onClick={() => setTipFilter(t)}
              className={`px-3 py-1.5 ${tipFilter===t ? 'bg-accent text-white font-medium' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
              {t === 'tumu' ? 'Tümü' : t === 'giris' ? '↑ Giriş' : '↓ Çıkış'}
            </button>
          ))}
        </div>

        {/* Kaynak */}
        <select value={kaynakFilter} onChange={e => setKaynakFilter(e.target.value as any)}
          className="bg-bg-2 border border-border rounded text-xs text-zinc-300 px-2 py-1.5 focus:outline-none focus:border-accent">
          <option value="tumu">Kaynak: Tümü</option>
          <option value="uretim">Üretim</option>
          <option value="manuel">Manuel</option>
          <option value="sevkiyat">Sevkiyat</option>
          <option value="tedarik">Tedarik</option>
          <option value="diger">Diğer</option>
        </select>

        {/* Tarih */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1.5 text-zinc-300 text-xs focus:outline-none focus:border-accent"/>
          <span>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="bg-bg-2 border border-border rounded px-2 py-1.5 text-zinc-300 text-xs focus:outline-none focus:border-accent"/>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo('') }} className="text-zinc-500 hover:text-zinc-300">
              <X size={12}/>
            </button>
          )}
        </div>
      </div>

      {/* Özet şerit */}
      <div className="px-6 py-2 border-b border-border flex gap-6 text-xs text-zinc-500 flex-wrap items-center">
        <span>
          <span className="text-zinc-300 font-mono">{ozet.sayi}</span> kayıt
          {totalCount !== null && totalCount > PAGE_SIZE && (
            <span className="ml-1 text-zinc-600">/ {totalCount} toplam</span>
          )}
        </span>
        <span>↑ Giriş: <span className="text-green-400 font-mono">{fmtNum(ozet.giris)}</span> <span className="text-zinc-600">adet</span></span>
        <span>↓ Çıkış: <span className="text-red-400 font-mono">{fmtNum(ozet.cikis)}</span> <span className="text-zinc-600">adet</span></span>
        <span title="Giriş − Çıkış toplamı (bar açılışları dahil)">Net: <span className={`font-mono font-semibold ${ozet.net >= 0 ? 'text-accent' : 'text-red-400'}`}>{fmtNum(ozet.net)}</span> <span className="text-zinc-600">adet</span></span>
        {/* v17.05 — Sayfa navigasyonu */}
        {totalCount !== null && totalCount > PAGE_SIZE && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              disabled={page === 0 || loading}
              onClick={() => load(page - 1)}
              className="px-2 py-0.5 bg-bg-3 border border-border rounded text-[10px] disabled:opacity-40 hover:bg-bg-2"
            >← Önceki</button>
            <span className="text-[10px] text-zinc-400">
              {page + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
            </span>
            <button
              disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
              onClick={() => load(page + 1)}
              className="px-2 py-0.5 bg-bg-3 border border-border rounded text-[10px] disabled:opacity-40 hover:bg-bg-2"
            >Sonraki →</button>
          </div>
        )}
      </div>

      {/* İçerik */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tablo */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">Yükleniyor…</div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-zinc-600 text-sm">Kayıt bulunamadı</div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-bg-1 z-10">
                <tr className="border-b border-border text-xs text-zinc-500">
                  <th className="px-4 py-2 text-left font-medium"><SortBtn col="tarih" label="Tarih"/></th>
                  <th className="px-4 py-2 text-left font-medium w-6">Tip</th>
                  <th className="px-4 py-2 text-left font-medium"><SortBtn col="malkod" label="Malkod"/></th>
                  <th className="px-4 py-2 text-left font-medium">Malzeme Adı</th>
                  <th className="px-4 py-2 text-right font-medium"><SortBtn col="miktar" label="Miktar"/></th>
                  <th className="px-4 py-2 text-left font-medium">Kaynak</th>
                  <th className="px-4 py-2 text-left font-medium">IE / Sevkiyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => {
                  const k = kaynak(h)
                  const kl = kaynakLabel(k)
                  const ie = h.ie_no
                  const sevk = getSevkNo(h.aciklama)
                  const isSelected = selected?.id === h.id
                  return (
                    <tr key={h.id}
                      onClick={() => { setSelected(h); setEditMode(false) }}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-accent/10' : i % 2 === 0 ? 'bg-bg-0 hover:bg-bg-2' : 'bg-bg-1 hover:bg-bg-2'
                      }`}>
                      <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{fmtDate(h.tarih)}</td>
                      <td className="px-4 py-2">
                        {h.tip === 'giris'
                          ? <ArrowUpCircle size={15} className="text-green-400"/>
                          : h.tip === 'bar_acilis'
                          ? <Wrench size={15} className="text-orange-400"/>
                          : h.tip === 'rezerv'
                          ? <Package size={15} className="text-purple-400"/>
                          : <ArrowDownCircle size={15} className="text-red-400"/>}
                      </td>
                      <td className="px-4 py-2 text-zinc-200 font-mono text-xs">{h.malkod}</td>
                      <td className="px-4 py-2 text-zinc-400 text-xs max-w-[220px] truncate">{h.malad ?? '—'}</td>
                      <td className={`px-4 py-2 text-right font-mono font-semibold ${h.tip === 'giris' ? 'text-green-400' : 'text-red-400'}`}>
                        {h.tip === 'giris' ? '+' : '-'}{fmtNum(h.miktar)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${kl.cls}`}>{kl.label}</span>
                      </td>
                      <td className="px-4 py-2 text-zinc-500 text-xs font-mono">
                        {ie ?? sevk ?? <span className="text-zinc-700">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detay paneli */}
        {selected && <DetailPanel />}
      </div>

      {showManuelModal && (
        <ManuelHareketModal
          materials={materials}
          onClose={() => setShowManuelModal(false)}
          onSaved={() => load(0)}
        />
      )}
    </div>
  )
}

/* ───────── Manuel Hareket Modal ───────── */
interface ManuelHareketModalProps {
  materials: { kod: string; ad: string; aktif?: boolean }[]
  onClose: () => void
  onSaved: () => void
}

function ManuelHareketModal({ materials, onClose, onSaved }: ManuelHareketModalProps) {
  const [malkodSearch, setMalkodSearch] = useState('')
  const [secilenMal, setSecilenMal]     = useState<{ kod: string; ad: string } | null>(null)
  const [miktar, setMiktar]             = useState('')
  const [tip, setTip]                   = useState<'giris' | 'cikis'>('giris')
  const [aciklama, setAciklama]         = useState('')
  const [tarih, setTarih]               = useState(today())
  const [saving, setSaving]             = useState(false)

  const suggestions = useMemo(() => {
    const q = malkodSearch.trim().toLowerCase()
    if (!q) return []
    return materials
      .filter(m => m.aktif !== false && (
        m.kod.toLowerCase().includes(q) ||
        m.ad.toLowerCase().includes(q)
      ))
      .slice(0, 15)
  }, [malkodSearch, materials])

  async function kaydet() {
    const parsed = manuelHareketSchema.safeParse({
      malkod:   secilenMal?.kod ?? '',
      malad:    secilenMal?.ad ?? '',
      miktar:   parseFloat(miktar),
      tip,
      aciklama,
      tarih,
    })
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    const d = parsed.data
    setSaving(true)
    const { error } = await addStokHareketi({
      malkod:   d.malkod,
      malad:    d.malad,
      miktar:   d.miktar,
      tip:      d.tip,
      aciklama: d.aciklama || undefined,
      tarih:    d.tarih,
    })
    setSaving(false)
    if (error) { toast.error('Kaydedilemedi: ' + (error as any).message); return }
    toast.success(`Manuel ${tip === 'giris' ? 'giriş' : 'çıkış'} kaydedildi — ${d.malkod}`)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-bg-1 border border-border rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Manuel Hareket Ekle</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={16}/></button>
        </div>

        {/* Malzeme arama */}
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Malzeme</label>
          {secilenMal ? (
            <div className="flex items-center justify-between bg-bg-2 border border-accent/50 rounded px-3 py-2">
              <div>
                <div className="text-xs font-mono text-accent">{secilenMal.kod}</div>
                <div className="text-[11px] text-zinc-400">{secilenMal.ad}</div>
              </div>
              <button onClick={() => { setSecilenMal(null); setMalkodSearch('') }}
                className="text-zinc-500 hover:text-zinc-200"><X size={13}/></button>
            </div>
          ) : (
            <div className="relative">
              <input
                autoFocus
                value={malkodSearch}
                onChange={e => setMalkodSearch(e.target.value)}
                placeholder="Malzeme kodu veya adı ara…"
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 max-h-44 overflow-y-auto border border-border rounded bg-bg-0 shadow-lg divide-y divide-border/50">
                  {suggestions.map(m => (
                    <button key={m.kod}
                      onClick={() => { setSecilenMal(m); setMalkodSearch('') }}
                      className="w-full text-left px-3 py-2 hover:bg-bg-2">
                      <div className="text-[11px] font-mono text-accent">{m.kod}</div>
                      <div className="text-[11px] text-zinc-400 truncate">{m.ad}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Miktar + Tip */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Miktar</label>
            <input
              type="number"
              min="0.001"
              step="any"
              value={miktar}
              onChange={e => setMiktar(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Tip</label>
            <div className="flex rounded border border-border overflow-hidden text-xs h-[34px]">
              <button
                onClick={() => setTip('giris')}
                className={`flex-1 ${tip === 'giris' ? 'bg-green-600/80 text-white font-medium' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
                ↑ Giriş
              </button>
              <button
                onClick={() => setTip('cikis')}
                className={`flex-1 ${tip === 'cikis' ? 'bg-red-600/80 text-white font-medium' : 'bg-bg-2 text-zinc-400 hover:text-zinc-200'}`}>
                ↓ Çıkış
              </button>
            </div>
          </div>
        </div>

        {/* Tarih */}
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Tarih</label>
          <input
            type="date"
            value={tarih}
            onChange={e => setTarih(e.target.value)}
            className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Açıklama */}
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Açıklama <span className="text-zinc-600">(isteğe bağlı)</span></label>
          <textarea
            value={aciklama}
            onChange={e => setAciklama(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Hareket nedeni, referans no vb."
            className="w-full px-3 py-2 bg-bg-2 border border-border rounded text-xs text-zinc-200 resize-none focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose}
            className="px-4 py-2 bg-bg-3 text-zinc-400 text-xs rounded hover:text-zinc-200">
            İptal
          </button>
          <button onClick={kaydet} disabled={saving}
            className="px-4 py-2 bg-accent text-white text-xs rounded hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
