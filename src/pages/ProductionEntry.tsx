import { useAuth } from '@/hooks/useAuth'
import { logAction } from '@/lib/activityLog'
import { stokTuketimIsle } from '@/features/production/stokTuketim'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today, pctColor } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Search, Play, CheckCircle, ScanBarcode } from 'lucide-react'

export function ProductionEntry() {
  const { workOrders, logs, operators, operations, loadAll } = useStore()
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [bolumFilter, setBolumFilter] = useState('')
  const [selectedOpr, setSelectedOpr] = useState<string | null>(null)
  const [entryWO, setEntryWO] = useState<string | null>(null)
  const [showToplu, setShowToplu] = useState(false)
  const [barkodAktif, setBarkodAktif] = useState(false)

  // #18: Barkod Okuyucu
  const barkodBuf = useRef('')
  const barkodTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!barkodAktif) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && barkodBuf.current.length > 3) {
        const code = barkodBuf.current.trim()
        barkodBuf.current = ''
        const wo = workOrders.find(w => w.ieNo === code || w.malkod === code)
        if (wo) { setEntryWO(wo.id); toast.success('Barkod: ' + code) }
        else toast.error('Barkod eşleşmedi: ' + code)
        return
      }
      if (e.key.length === 1) {
        barkodBuf.current += e.key
        if (barkodTimer.current) clearTimeout(barkodTimer.current)
        barkodTimer.current = setTimeout(() => { barkodBuf.current = '' }, 200)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [barkodAktif, workOrders])

  // Operasyonların bölüm alanından benzersiz bölüm listesi
  const opBolumMap = useMemo(() => {
    const map: Record<string, string> = {}
    operations.forEach(o => { if (o.bolum) map[o.id] = o.bolum })
    return map
  }, [operations])
  function getWoBolum(w: { opId: string; opAd: string }) {
    return opBolumMap[w.opId] || w.opAd || ''
  }
  const bolumler = useMemo(() =>
    [...new Set(workOrders.map(w => getWoBolum(w)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')),
  [workOrders, opBolumMap])

  function wProd(woId: string): number {
    return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  }

  const acikWOs = useMemo(() => {
    return workOrders.filter(w => {
      if (w.hedef <= 0) return false
      if (wProd(w.id) >= w.hedef) return false
      if (bolumFilter && getWoBolum(w) !== bolumFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(w.ieNo + w.malad + w.opAd).toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [workOrders, logs, search, bolumFilter])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Üretim Girişi</h1><p className="text-xs text-zinc-500">{!bolumFilter ? 'Bölüm seçin' : !selectedOpr ? 'Operatör seçin' : bolumFilter + ' — ' + acikWOs.length + ' İE'}</p></div>
        <div className="flex gap-2">
          <button onClick={() => setBarkodAktif(!barkodAktif)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${barkodAktif ? 'bg-green/20 text-green border border-green/30' : 'bg-bg-2 border border-border text-zinc-400'}`}>
            <ScanBarcode size={13} /> {barkodAktif ? 'Barkod Açık' : 'Barkod'}
          </button>
          {can('prod_bulk') && <button onClick={() => setShowToplu(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><CheckCircle size={13} /> Toplu Giriş</button>}
        </div>
      </div>

      {/* ADIM 1: Bölüm Seç */}
      {!bolumFilter ? (
        <div className="bg-bg-2 border border-border rounded-lg p-6">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">1. Bölüm Seçin</div>
          <div className="flex flex-wrap gap-2">
            {bolumler.map(b => {
              const bWOs = workOrders.filter(w => getWoBolum(w) === b && w.hedef > 0 && wProd(w.id) < w.hedef)
              return (
                <button key={b} onClick={() => { setBolumFilter(b); setSelectedOpr(null) }}
                  className={`px-4 py-3 border rounded-lg text-sm transition-colors ${bWOs.length > 0 ? 'bg-green/10 border-green/30 text-green hover:bg-green/20' : 'bg-red/10 border-red/30 text-red/70 hover:bg-red/20'}`}>
                  <div className="font-medium">{b}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{bWOs.length} açık İE</div>
                </button>
              )
            })}
            {bolumler.length === 0 && <div className="text-zinc-600 text-sm">Operasyona bağlı İE bulunamadı</div>}
          </div>
        </div>

      ) : !selectedOpr ? (
        /* ADIM 2: Operatör Seç */
        <div className="bg-bg-2 border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">2. Operatör — <span className="text-accent">{bolumFilter}</span></div>
            <button onClick={() => setBolumFilter('')} className="text-xs text-zinc-500 hover:text-white">← Bölüm Değiştir</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {operators.filter(o => o.aktif !== false && o.bolum === bolumFilter).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(o => (
              <button key={o.id} onClick={() => setSelectedOpr(o.id)}
                className="px-4 py-3 bg-bg-3 border border-border rounded-lg text-sm hover:border-accent hover:text-accent transition-colors">
                <div className="font-medium">{o.ad}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{o.kod || o.bolum}</div>
              </button>
            ))}
            {operators.filter(o => o.aktif !== false && o.bolum === bolumFilter).length === 0 && (
              <div className="text-zinc-600 text-sm">Bu bölümde aktif operatör yok</div>
            )}
          </div>
        </div>

      ) : (<>

      {/* ADIM 3: İE Listesi (bölüm + operatör seçili) */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => { setBolumFilter(''); setSelectedOpr(null) }} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">← Bölüm</button>
        <button onClick={() => setSelectedOpr(null)} className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">← Operatör Değiştir</button>
        <span className="px-3 py-2 bg-accent/10 text-accent rounded-lg text-xs font-medium">
          {operators.find(o => o.id === selectedOpr)?.ad} · {bolumFilter}
        </span>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="İE no veya malzeme ara..."
            className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
        </div>
      </div>

      <div className="space-y-2">
        {acikWOs.map(w => {
          const prod = wProd(w.id)
          const kalan = Math.max(0, w.hedef - prod)
          const pct = Math.min(100, Math.round(prod / w.hedef * 100))
          return (
            <div key={w.id} className={`bg-bg-2 border rounded-lg p-3 hover:border-border-2 transition-colors ${prod > 0 ? 'border-green/30' : 'border-red/30'}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-accent text-xs">{w.ieNo}</span>
                    <span className="px-1.5 py-0.5 bg-bg-3 rounded text-[9px] text-zinc-500">{w.opAd}</span>
                  </div>
                  <div className="text-sm font-medium truncate">{w.malad}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-zinc-500">Hedef: <span className="font-mono">{w.hedef}</span></span>
                    <span className="text-[11px] text-green">Üretilen: <span className="font-mono">{prod}</span></span>
                    <span className="text-[11px] text-amber">Kalan: <span className="font-mono">{kalan}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className={`text-lg font-mono font-light ${pctColor(pct)}`}>{pct}%</div>
                    <div className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button onClick={() => setEntryWO(w.id)} className="p-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20" title="Üretim Gir">
                    <Play size={16} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {!acikWOs.length && <div className="bg-bg-2 border border-border rounded-lg p-8 text-center text-zinc-600 text-sm">Bu bölümde açık iş emri yok</div>}
      </div>
      </>)}

      {entryWO && (
        <EntryModal
          woId={entryWO}
          operators={operators}
          defaultOprId={selectedOpr || undefined}
          onClose={() => setEntryWO(null)}
          onSaved={() => { setEntryWO(null); loadAll(); toast.success('Üretim kaydedildi') }}
        />
      )}

      {showToplu && (
        <TopluUretimModal
          acikWOs={acikWOs}
          operators={operators}
          onClose={() => setShowToplu(false)}
          onSaved={() => { setShowToplu(false); loadAll(); toast.success('Toplu üretim kaydedildi') }}
        />
      )}
    </div>
  )
}

function EntryModal({ woId, operators, defaultOprId, onClose, onSaved }: {
  woId: string; operators: { id: string; ad: string; bolum: string; aktif?: boolean }[]
  defaultOprId?: string
  onClose: () => void; onSaved: () => void
}) {
  const { workOrders, logs, durusKodlari, stokHareketler, recipes } = useStore()
  const { can } = useAuth()
  const w = workOrders.find(x => x.id === woId)!
  const [qty, setQty] = useState('')
  const [fire, setFire] = useState('')
  const [not, setNot] = useState('')
  const [tarih, setTarih] = useState(today())
  const [saving, setSaving] = useState(false)
  const [duruslar, setDuruslar] = useState<{ kodId: string; kodAd: string; sure: number; bas: string; bit: string }[]>([])

  // ═══ STOK KONTROL ═══
  const rc = recipes.find(r => r.id === w?.rcId)
  const hmSatirlar = useMemo(() => {
    const mamulKodlar = [w?.malkod, w?.mamulKod].filter(Boolean)
    // Önce wo.hm'den, yoksa reçeteden al — mamulü filtrele
    if (w?.hm?.length) return w.hm.filter(h => !mamulKodlar.includes(h.malkod)).map(h => ({ malkod: h.malkod, malad: h.malad, miktar: h.miktarTotal / (w.hedef || 1) }))
    if (rc?.satirlar?.length) return rc.satirlar.filter((s: { tip: string; malkod?: string; kod?: string }) =>
      (s.tip === 'Hammadde' || s.tip === 'hammadde' || s.tip === 'YarıMamul') && !mamulKodlar.includes(s.malkod || s.kod || '')
    ).map((s: { malkod?: string; kod?: string; malad?: string; ad?: string; miktar?: number }) => ({ malkod: s.malkod || s.kod || '', malad: s.malad || s.ad || '', miktar: s.miktar || 0 }))
    return []
  }, [w, rc])

  function stokNet(malkod: string) {
    return stokHareketler.filter(h => h.malkod === malkod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
  }

  const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
  const kalan = w ? Math.max(0, w.hedef - prod) : 0

  const maxUretim = useMemo(() => {
    if (!hmSatirlar.length) return kalan
    let min = kalan
    for (const hm of hmSatirlar) {
      const mevcut = stokNet(hm.malkod)
      const birimIhtiyac = (hm.miktar || 0) * (w?.mpm || 1)
      if (birimIhtiyac > 0) {
        const yapilabilir = Math.floor(mevcut / birimIhtiyac)
        if (yapilabilir < min) min = yapilabilir
      }
    }
    return Math.max(0, min)
  }, [hmSatirlar, stokHareketler, w, kalan])

  // Çoklu operatör — varsayılan operatör otomatik ekle
  const defaultOpr = defaultOprId ? operators.find(o => o.id === defaultOprId) : null
  const now = new Date()
  const nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  const [oprList, setOprList] = useState<{ id: string; ad: string; bas: string; bit: string }[]>(
    defaultOpr ? [{ id: defaultOpr.id, ad: defaultOpr.ad, bas: nowHHMM, bit: nowHHMM }] : []
  )
  const [selOprId, setSelOprId] = useState('')

  function addOpr() {
    if (!selOprId) { toast.error('Operatör seçin'); return }
    const op = operators.find(o => o.id === selOprId)
    if (!op) return
    if (oprList.some(o => o.id === selOprId)) { toast.error('Bu operatör zaten ekli'); return }
    setOprList([...oprList, { id: op.id, ad: op.ad, bas: nowHHMM, bit: nowHHMM }])
    setSelOprId('')
  }
  function removeOpr(i: number) { setOprList(prev => prev.filter((_, idx) => idx !== i)) }
  function updateOpr(i: number, field: string, value: string) {
    setOprList(prev => prev.map((o, idx) => idx === i ? { ...o, [field]: value } : o))
  }

  function addDurus() { setDuruslar([...duruslar, { kodId: '', kodAd: '', sure: 0, bas: nowHHMM, bit: nowHHMM }]) }
  function removeDurus(i: number) { setDuruslar(prev => prev.filter((_, idx) => idx !== i)) }
  function updateDurus(i: number, field: string, value: string | number) {
    setDuruslar(prev => prev.map((d, idx) => {
      if (idx !== i) return d
      if (field === 'kodId') {
        const dk = durusKodlari.find(k => k.id === value)
        return { ...d, kodId: value as string, kodAd: dk?.ad || '' }
      }
      if (field === 'bas') {
        const yeni = { ...d, bas: value as string }
        if (yeni.bit && value) {
          const [bH, bM] = (value as string).split(':').map(Number); const [eH, eM] = yeni.bit.split(':').map(Number)
          const dk = (eH * 60 + eM) - (bH * 60 + bM); if (dk > 0) yeni.sure = dk
        }
        return yeni
      }
      if (field === 'bit') {
        const yeni = { ...d, bit: value as string }
        if (yeni.bas && value) {
          const [bH, bM] = yeni.bas.split(':').map(Number); const [eH, eM] = (value as string).split(':').map(Number)
          const dk = (eH * 60 + eM) - (bH * 60 + bM); if (dk > 0) yeni.sure = dk
        }
        return yeni
      }
      return { ...d, [field]: value }
    }))
  }

  async function save() {
    const q = parseInt(qty) || 0
    const f = parseInt(fire) || 0
    const hasDurus = duruslar.some(d => d.kodId && d.sure > 0)
    if (q <= 0 && f <= 0 && !hasDurus) { toast.error('Miktar, fire veya duruş girmelisiniz'); return }
    if (q < 0 || f < 0) { toast.error('Negatif değer girilemez'); return }
    // #2: Fazla üretim kontrolü — HARD BLOCK (fire dahil)
    // Güncel üretim + fire'ı Supabase'den çek (stale data riski)
    const { data: freshLogs } = await supabase.from('uys_logs').select('qty, fire').eq('wo_id', woId)
    const freshProd = (freshLogs || []).reduce((a: number, l: any) => a + (l.qty || 0), 0)
    const freshFire = (freshLogs || []).reduce((a: number, l: any) => a + (l.fire || 0), 0)
    const freshKapasite = Math.max(0, w.hedef - freshProd - freshFire)
    const toplamYeni = q + f
    if (toplamYeni > freshKapasite) {
      toast.error(
        `İE kapasitesi aşılamaz! Hedef: ${w.hedef}\n` +
        `Mevcut: ${freshProd} sağlam + ${freshFire} fire = ${freshProd + freshFire}\n` +
        `Kalan kapasite: ${freshKapasite}\n` +
        `Girmek istediğin: ${q} sağlam + ${f} fire = ${toplamYeni}\n\n` +
        `Hat kenarına gelen hammadde tükenmiştir. Fire varsa yeni İE açılacak.`
      )
      return
    }
    // Stok kontrolü kaldırıldı — İE hedefi zaten hammadde tahsisi demek, İE oluşturma anında kontrol edildi
    setSaving(true)

    const logId = uid()
    const nowTs = new Date()
    const saatStr = String(nowTs.getHours()).padStart(2, '0') + ':' + String(nowTs.getMinutes()).padStart(2, '0')

    // Üretim logu
    await supabase.from('uys_logs').insert({
      id: logId, wo_id: woId, tarih, saat: saatStr, qty: q, fire: f,
      operatorlar: oprList.length > 0 ? oprList : [],
      duruslar: duruslar.filter(d => d.kodId && d.sure > 0).map(d => ({ kodId: d.kodId, kodAd: d.kodAd, sure: d.sure, bas: d.bas, bit: d.bit })),
      not_: not, malkod: w.malkod, ie_no: w.ieNo,
      operator_id: oprList[0]?.id || null, vardiya: '',
    })

    // Stok girişi (üretilen mamul) — sadece sağlam adet varsa
    if (q > 0) {
      await supabase.from('uys_stok_hareketler').insert({
        id: uid(), tarih, malkod: w.malkod, malad: w.malad,
        miktar: q, tip: 'giris', log_id: logId, wo_id: woId,
        aciklama: 'Üretim — ' + w.ieNo,
      })
    }

    // Fire logu (fire mamul stoğuna girmediği için çıkış kaydı yok — HM tüketimi aşağıda q+f üzerinden hesaplanır)
    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), log_id: logId, wo_id: woId, tarih,
        malkod: w.malkod, malad: w.malad, qty: f,
        ie_no: w.ieNo, op_ad: w.opAd,
        operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad })),
        not_: not,
      })
    }

    // HM stok tüketimi — sağlam + fire = toplam harcanan malzeme
    const toplamTuketilen = q + f
    if (toplamTuketilen > 0 && hmSatirlar.length > 0) {
      for (const hm of hmSatirlar) {
        const hmMiktar = (hm.miktar || 0) * (w.mpm || 1) * toplamTuketilen
        if (hmMiktar > 0) {
          await supabase.from('uys_stok_hareketler').insert({
            id: uid(), tarih, malkod: hm.malkod, malad: hm.malad,
            miktar: Math.round(hmMiktar * 100) / 100, tip: 'cikis',
            log_id: logId, wo_id: woId,
            aciklama: `HM tüketim — ${w.ieNo} (${q} sağlam${f > 0 ? ' + ' + f + ' fire' : ''})`,
          })
        }
      }
    }

    // Fire kaydedildi — telafi İE otomatik açılmaz, yönetim Reports → Fire'dan onaylayacak
    if (f > 0) {
      toast.info(`⚠ ${f} fire kaydedildi. Telafi İE için Reports → Fire sekmesinden onay verin.`, { duration: 5000 })
    }

    // Auto-close: İE kapasitesi doldu mu? (q + fire >= hedef)
    const yeniProdToplam = freshProd + q
    const yeniFireToplam = freshFire + f
    const yeniKapasite = yeniProdToplam + yeniFireToplam
    if (yeniKapasite >= w.hedef && w.durum !== 'tamamlandi') {
      await supabase.from('uys_work_orders').update({ durum: 'tamamlandi' }).eq('id', woId)
      if (yeniProdToplam < w.hedef) {
        toast.info(`İE kapasite dolduğu için kapatıldı (${yeniProdToplam} sağlam, ${yeniFireToplam} fire). Fire için telafi İE açıldı.`)
      }
    } else if (freshProd === 0 && w.durum !== 'uretimde') {
      // İlk üretim girişi → durum "üretimde"
      await supabase.from('uys_work_orders').update({ durum: 'uretimde' }).eq('id', woId)
    }

    logAction('Üretim girişi', w.ieNo + ' — ' + (parseInt(qty) || 0) + ' adet')
    // Garantili UI güncelleme — realtime/reload beklemeden direkt store'u yenile
    try {
      await useStore.getState().reloadTables(['uys_work_orders', 'uys_logs', 'uys_fire_logs', 'uys_stok_hareketler', 'uys_active_work'])
    } catch (e) { console.error('Post-save reload:', e) }
    onSaved()
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Üretim Girişi</h2>
            <p className="text-xs text-zinc-500">{w.ieNo} · {w.malad}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-bg-2 border border-border rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500">Hedef</div>
            <div className="font-mono text-sm">{w.hedef}</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500">Üretilen</div>
            <div className="font-mono text-sm text-green">{prod}</div>
          </div>
          <div className="bg-bg-2 border border-border rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500">Kalan</div>
            <div className="font-mono text-sm text-amber">{kalan}</div>
          </div>
        </div>

        {/* HM Stok Kontrol — bilgi amaçlı (İE oluşumunda HM tahsisi zaten yapıldı) */}
        {hmSatirlar.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-zinc-500 mb-1 flex items-center justify-between">
              <span>Hammadde DB Stoğu</span>
              <span className="text-[9px] text-zinc-600">bilgi amaçlı — HM iş emrine tahsislidir</span>
            </div>
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-border text-zinc-600"><th className="text-left px-2 py-1">Malzeme</th><th className="text-right px-2 py-1">DB Stok</th><th className="text-right px-2 py-1">Gerekli</th></tr></thead>
                <tbody>{hmSatirlar.map((hm, i) => {
                  const mevcut = Math.round(stokNet(hm.malkod))
                  const q_ = parseInt(qty) || kalan
                  const gerekli = Math.ceil((hm.miktar || 0) * (w.mpm || 1) * q_)
                  return (
                    <tr key={i} className="border-b border-border/20">
                      <td className="px-2 py-1 text-zinc-300 truncate max-w-[140px]" title={hm.malkod}>{hm.malad || hm.malkod}</td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-400">{mevcut}</td>
                      <td className="px-2 py-1 text-right font-mono text-zinc-500">{gerekli}</td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-zinc-500">Kayıt Tarihi</label>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value)}
              className="px-2 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
            {tarih !== today() && <span className="text-[10px] text-amber font-semibold">⚠ Farklı tarih</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Üretim Adedi *</label>
              <input type="number" min={1} max={kalan} value={qty} onChange={e => setQty(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus placeholder={String(kalan)} />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Fire / Iskarta</label>
              <input type="number" min={0} value={fire} onChange={e => setFire(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" placeholder="0" />
            </div>
          </div>

          {/* Çoklu Operatör */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-500">Operatörler ({oprList.length})</label>
            </div>
            <div className="flex gap-2 mb-2">
              <select value={selOprId} onChange={e => setSelOprId(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none">
                <option value="">— Operatör seçin —</option>
                {operators.filter(o => o.aktif !== false).sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map(o => <option key={o.id} value={o.id}>{o.ad} ({o.bolum})</option>)}
              </select>
              <button type="button" onClick={addOpr} className="px-3 py-1.5 bg-accent text-white rounded text-xs">+ Ekle</button>
            </div>
            {oprList.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2 mb-1 text-xs">
                <span className="flex-1 text-zinc-300">{o.ad}</span>
                <input type="time" value={o.bas} onChange={e => updateOpr(i, 'bas', e.target.value)} className="w-20 px-1 py-0.5 bg-bg-3 border border-border rounded text-[10px] text-zinc-300" title="Başlama" />
                <span className="text-zinc-600">—</span>
                <input type="time" value={o.bit} onChange={e => updateOpr(i, 'bit', e.target.value)} className="w-20 px-1 py-0.5 bg-bg-3 border border-border rounded text-[10px] text-zinc-300" title="Bitiş" />
                <button type="button" onClick={() => removeOpr(i)} className="text-zinc-500 hover:text-red">✕</button>
              </div>
            ))}
          </div>

          {/* Duruş Girişi */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] text-zinc-500">Duruşlar ({duruslar.length})</label>
              <button type="button" onClick={addDurus} className="text-[11px] text-accent hover:underline">+ Duruş Ekle</button>
            </div>
            {duruslar.map((d, i) => (
              <div key={i} className="bg-bg-2 rounded-lg p-2 mb-2">
                <div className="flex gap-2 mb-1.5">
                  <select value={d.kodId} onChange={e => updateDurus(i, 'kodId', e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none">
                    <option value="">— Duruş kodu —</option>
                    {durusKodlari.map(k => <option key={k.id} value={k.id}>{k.kod} — {k.ad}</option>)}
                  </select>
                  <button type="button" onClick={() => removeDurus(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="time" value={d.bas} onChange={e => updateDurus(i, 'bas', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                  <span className="text-[10px] text-zinc-600">→</span>
                  <input type="time" value={d.bit} onChange={e => updateDurus(i, 'bit', e.target.value)} className="w-[85px] px-1.5 py-1 bg-bg-3 border border-border rounded text-[11px] text-zinc-200" />
                  <span className="text-[10px] text-zinc-500">=</span>
                  <input type="number" min={1} value={d.sure || ''} onChange={e => updateDurus(i, 'sure', parseInt(e.target.value) || 0)}
                    placeholder="dk" className="w-14 px-2 py-1 bg-bg-3 border border-border rounded text-[11px] text-center text-zinc-200" />
                  <span className="text-[10px] text-zinc-600">dk</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" placeholder="Opsiyonel..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:text-white">İptal</button>
          <button onClick={save} disabled={saving || !can('prod_entry')} className="flex items-center gap-1.5 px-4 py-2 bg-green hover:bg-green/80 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            <CheckCircle size={13} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// #12: Toplu Üretim Girişi Modal
function TopluUretimModal({ acikWOs, operators, onClose, onSaved }: {
  acikWOs: { id: string; ieNo: string; malad: string; opAd: string; hedef: number; malkod: string }[]
  operators: { id: string; ad: string; bolum: string; aktif?: boolean }[]
  onClose: () => void; onSaved: () => void
}) {
  const { workOrders, recipes } = useStore()
  const { can } = useAuth()
  const [rows, setRows] = useState<{ woId: string; qty: string; fire: string }[]>(
    acikWOs.slice(0, 20).map(w => ({ woId: w.id, qty: '', fire: '' }))
  )
  const [oprId, setOprId] = useState('')
  const [tarih, setTarih] = useState(today())
  const [saving, setSaving] = useState(false)

  function updateRow(i: number, field: string, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  async function save() {
    const validRows = rows.filter(r => parseInt(r.qty) > 0)
    if (!validRows.length) { toast.error('En az bir satıra miktar girin'); return }
    setSaving(true)

    const opr = operators.find(o => o.id === oprId)
    const now = new Date()
    const saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')

    for (const r of validRows) {
      const q = parseInt(r.qty) || 0
      const f = parseInt(r.fire) || 0
      const wo = acikWOs.find(w => w.id === r.woId)
      if (!wo || (q <= 0 && f <= 0)) continue

      // Hedef kontrolü — güncel veri ile (fire dahil)
      const { data: fLogs } = await supabase.from('uys_logs').select('qty, fire').eq('wo_id', r.woId)
      const fProd = (fLogs || []).reduce((a: number, l: any) => a + (l.qty || 0), 0)
      const fFire = (fLogs || []).reduce((a: number, l: any) => a + (l.fire || 0), 0)
      const fKalan = Math.max(0, wo.hedef - fProd - fFire)
      if (q + f > fKalan) {
        toast.error(`${wo.ieNo}: Hedef aşılamaz! Kalan kapasite: ${fKalan}, girilen: ${q} sağlam + ${f} fire = ${q + f}`)
        continue
      }

      const logId = uid()
      await supabase.from('uys_logs').insert({
        id: logId, wo_id: r.woId, tarih, saat, qty: q, fire: f,
        operatorlar: opr ? [{ id: opr.id, ad: opr.ad, bas: saat, bit: saat }] : [],
        duruslar: [], malkod: wo.malkod, ie_no: wo.ieNo, operator_id: oprId || null,
      })

      if (q > 0) {
        await supabase.from('uys_stok_hareketler').insert({
          id: uid(), tarih, malkod: wo.malkod, malad: wo.malad,
          miktar: q, tip: 'giris', log_id: logId, wo_id: r.woId,
          aciklama: 'Toplu üretim — ' + wo.ieNo,
        })
      }

      // HM tüketim — sağlam + fire (fire da hammadde harcar)
      await stokTuketimIsle(r.woId, q + f, logId, workOrders, recipes)

      if (f > 0) {
        await supabase.from('uys_fire_logs').insert({
          id: uid(), log_id: logId, wo_id: r.woId, tarih,
          malkod: wo.malkod, malad: wo.malad, qty: f,
          ie_no: wo.ieNo, op_ad: wo.opAd,
          operatorlar: opr ? [{ id: opr.id, ad: opr.ad }] : [],
        })
      }
    }
    setSaving(false); onSaved()
  }

  const aktifOprs = operators.filter(o => o.aktif !== false).sort((a, b) => a.ad.localeCompare(b.ad, 'tr'))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Toplu Üretim Girişi</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        <div className="mb-4 flex items-end gap-4">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Operatör (tümü için)</label>
            <select value={oprId} onChange={e => setOprId(e.target.value)} className="w-full max-w-xs px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200">
              <option value="">— Seçin —</option>
              {aktifOprs.map(o => <option key={o.id} value={o.id}>{o.ad} ({o.bolum})</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kayıt Tarihi</label>
            <input type="date" value={tarih} onChange={e => setTarih(e.target.value)}
              className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
          {tarih !== today() && <span className="text-[10px] text-amber font-semibold pb-2">⚠ Farklı tarih</span>}
        </div>

        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-zinc-500">
            <th className="text-left px-3 py-2">İE No</th><th className="text-left px-3 py-2">Malzeme</th>
            <th className="text-left px-3 py-2">Operasyon</th><th className="text-right px-3 py-2">Hedef</th>
            <th className="text-right px-3 py-2 w-20">Adet</th><th className="text-right px-3 py-2 w-16">Fire</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const wo = acikWOs.find(w => w.id === r.woId)
              if (!wo) return null
              return (
                <tr key={r.woId} className="border-b border-border/30">
                  <td className="px-3 py-1.5 font-mono text-accent">{wo.ieNo}</td>
                  <td className="px-3 py-1.5 text-zinc-300 max-w-[180px] truncate">{wo.malad}</td>
                  <td className="px-3 py-1.5 text-zinc-500">{wo.opAd}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{wo.hedef}</td>
                  <td className="px-3 py-1.5"><input type="number" min={0} value={r.qty} onChange={e => updateRow(i, 'qty', e.target.value)} placeholder="0" className="w-full px-2 py-1 bg-bg-2 border border-border rounded text-right text-xs focus:outline-none focus:border-accent" /></td>
                  <td className="px-3 py-1.5"><input type="number" min={0} value={r.fire} onChange={e => updateRow(i, 'fire', e.target.value)} placeholder="0" className="w-full px-2 py-1 bg-bg-2 border border-border rounded text-right text-xs focus:outline-none" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-green hover:bg-green/80 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            {saving ? 'Kaydediliyor...' : 'Toplu Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}
