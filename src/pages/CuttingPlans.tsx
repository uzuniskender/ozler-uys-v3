import React, { useState } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showPrompt, showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { optimizeKesim, kesimPlaniKaydet, kesimPlanOlustur, kesimPlanlariKaydet } from '@/features/production/cutting'
import { Trash2, Plus, Scissors, Zap } from 'lucide-react'

export function CuttingPlans() {
  const { cuttingPlans, materials, workOrders, operations, recipes, logs, loadAll } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const bekleyen = cuttingPlans.filter(p => p.durum !== 'tamamlandi')

  async function deletePlan(id: string) {
    if (!await showConfirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('uys_kesim_planlari').delete().eq('id', id)
    loadAll(); toast.success('Kesim planı silindi')
  }

  async function updateDurum(id: string, durum: string) {
    await supabase.from('uys_kesim_planlari').update({ durum }).eq('id', id)
    loadAll(); toast.success('Durum güncellendi')
  }

  // #10: Kesim artığını stoka gir
  async function artikStokaGir(_planId: string, hamMalkod: string, hamMalad: string, artikBoy: number) {
    if (artikBoy <= 0) return
    const kod = await showPrompt('Artık malzeme kodu', '', hamMalkod + '-ARTIK')
    if (!kod) return
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), tarih: today(), malkod: kod, malad: hamMalad + ' (kesim artığı)',
      miktar: 1, tip: 'giris', aciklama: 'Kesim artığı — ' + artikBoy + 'mm',
    })
    toast.success('Artık stoka girildi: ' + artikBoy + 'mm')
    loadAll()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Kesim Planları</h1><p className="text-xs text-zinc-500">{cuttingPlans.length} plan · {bekleyen.length} bekleyen</p></div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const logsSimple = logs.map(l => ({ woId: l.woId, qty: l.qty }))
            const cpMapped = cuttingPlans.map((p: any) => ({ id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy, hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '', tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0 }))
            const planlar = kesimPlanOlustur(workOrders, operations as any, recipes, materials, logsSimple, cpMapped as any)
            if (!planlar.length) { toast.info('Kesim operasyonlu açık İE bulunamadı'); return }
            const count = await kesimPlanlariKaydet(planlar as any)
            loadAll(); toast.success(count + ' kesim planı oluşturuldu/güncellendi')
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs font-semibold hover:bg-green/20"><Zap size={13} /> Otomatik Plan</button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Scissors size={13} /> Manuel Plan</button>
        </div>
      </div>

      {/* Kesim Önerileri — planlanmamış İE'ler */}
      {(() => {
        const { logs } = useStore.getState()
        const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']
        const planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap(s => (s.kesimler || []).map((k: { woId?: string }) => k.woId))))
        const oneriler = workOrders.filter(w => {
          if (planliWoIds.has(w.id)) return false
          if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
          const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
          if (prod >= w.hedef) return false
          return kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
        })
        if (!oneriler.length) return null
        return (
          <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg">
            <div className="text-xs font-semibold text-amber mb-2">✂ Kesim Önerileri — {oneriler.length} İE planlanmamış</div>
            <div className="space-y-1">
              {oneriler.slice(0, 8).map(w => (
                <div key={w.id} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-accent">{w.ieNo}</span>
                  <span className="text-zinc-400 truncate flex-1">{w.malad}</span>
                  <span className="text-zinc-500">{w.opAd}</span>
                  <span className="font-mono text-zinc-300">{w.hedef} adet</span>
                </div>
              ))}
              {oneriler.length > 8 && <div className="text-[10px] text-zinc-600">+{oneriler.length - 8} daha</div>}
            </div>
          </div>
        )
      })()}

      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {cuttingPlans.length ? (
          <div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Boy</th><th className="text-right px-4 py-2.5">Gerekli</th><th className="text-left px-4 py-2.5">Durum</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {cuttingPlans.map(p => {
                  const isOpen = selected === p.id
                  const satirlar = (p.satirlar || []) as { id: string; hamAdet: number; fireMm: number; kesimler: { woId: string; ieNo?: string; malkod: string; malad: string; parcaBoy: number; parcaEn?: number; adet: number; tamamlandi: number }[]; durum: string }[]
                  const toplamBar = satirlar.reduce((a, s) => a + (s.hamAdet || 0), 0)
                  return (
                    <React.Fragment key={p.id}>
                    <tr className={`border-b border-border/30 hover:bg-bg-3/30 cursor-pointer ${isOpen ? 'bg-bg-3/20' : ''}`} onClick={() => setSelected(isOpen ? null : p.id)}>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-[10px]">{isOpen ? '▼' : '▶'}</span>
                          <div><div className="font-mono text-accent text-[11px]">{p.hamMalkod}</div><div className="text-zinc-500 text-[10px]">{p.hamMalad}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-zinc-400">{p.kesimTip}</td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-500">{p.hamBoy} mm</td>
                      <td className="px-4 py-2 text-right font-mono">{toplamBar} bar</td>
                      <td className="px-4 py-2">
                        <select value={p.durum} onChange={e => { e.stopPropagation(); updateDurum(p.id, e.target.value) }} onClick={e => e.stopPropagation()}
                          className={`px-1.5 py-0.5 rounded text-[10px] bg-bg-3 border border-border ${p.durum === 'tamamlandi' ? 'text-green' : p.durum === 'kismi' ? 'text-amber' : 'text-accent'}`}>
                          <option value="bekliyor">Bekliyor</option><option value="kismi">Kısmi</option><option value="tamamlandi">Tamamlandı</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => deletePlan(p.id)} className="p-1 text-zinc-500 hover:text-red"><Trash2 size={12} /></button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/30 bg-bg-3/10">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-xs text-zinc-400">{p.hamBoy}mm × {toplamBar} bar</div>
                            <div className="flex gap-2">
                              <button onClick={() => {
                                const topFire = satirlar.reduce((a, s) => a + (s.fireMm || 0) * (s.hamAdet || 1), 0)
                                if (topFire <= 0) { toast.error('Artık yok'); return }
                                artikStokaGir(p.id, p.hamMalkod, p.hamMalad, topFire)
                              }} className="px-2 py-1 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-green">♻ Artık</button>
                            </div>
                          </div>
                          {satirlar.map((s, si) => {
                            const COLORS = ['#4f9cf9', '#f97b4f', '#6fcf97', '#bb6bd9', '#f2c94c', '#56ccf2', '#eb5757', '#219653', '#f78fb3', '#a29bfe']
                            const COLORS_TEXT = ['text-blue-400', 'text-orange-400', 'text-green-400', 'text-purple-400', 'text-yellow-400', 'text-cyan-400', 'text-red-400', 'text-emerald-400']
                            return (
                              <div key={s.id || si} className="mb-3 p-2 bg-bg-3/50 border border-border/50 rounded-lg">
                                <div className="text-[10px] text-zinc-500 font-mono mb-1.5">Bar #{si + 1} · {s.hamAdet} adet · Fire: {s.fireMm}mm</div>
                                {p.hamBoy > 0 && (
                                  <svg width="100%" height="36" viewBox={`0 0 ${p.hamBoy} 34`} className="bg-zinc-900 rounded overflow-hidden mb-1.5">
                                    {(() => {
                                      let x = 0
                                      const rects: JSX.Element[] = []
                                      s.kesimler.forEach((k, ki) => {
                                        if (!k.parcaBoy) return
                                        for (let ai = 0; ai < k.adet; ai++) {
                                          rects.push(<rect key={`${ki}-${ai}`} x={x} y={2} width={Math.max(1, k.parcaBoy - 1)} height={30} rx={1} fill={COLORS[ki % COLORS.length]} opacity={0.75}><title>{k.ieNo || k.woId} — {k.malad || k.malkod} {k.parcaBoy}mm</title></rect>)
                                          x += k.parcaBoy
                                        }
                                      })
                                      if (x < p.hamBoy) rects.push(<rect key="fire" x={x} y={2} width={p.hamBoy - x - 1} height={30} rx={1} fill="#ef4444" opacity={0.15}><title>Fire: {Math.round(p.hamBoy - x)}mm</title></rect>)
                                      return rects
                                    })()}
                                  </svg>
                                )}
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {s.kesimler.map((k, ki) => (
                                    <div key={ki} className="text-[10px] flex items-center gap-1">
                                      <span className={COLORS_TEXT[ki % COLORS_TEXT.length]}>■</span>
                                      <span className="font-mono text-accent">{k.ieNo || '—'}</span>
                                      <span className="text-zinc-400 truncate max-w-[120px]">{k.malad || k.malkod}</span>
                                      <span className="font-mono text-zinc-300">{k.parcaBoy}mm × {k.adet}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="p-8 text-center text-zinc-600 text-sm">Henüz kesim planı yok</div>}
      </div>

      {showCreate && <KesimOlusturModal materials={materials} workOrders={workOrders} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); loadAll(); toast.success('Kesim planları oluşturuldu') }} />}
    </div>
  )
}

// #9: Kesim Planı Oluşturma UI
function KesimOlusturModal({ materials, workOrders, onClose, onSaved }: {
  materials: { id: string; kod: string; ad: string; tip: string; boy: number }[]
  workOrders: { id: string; ieNo: string; malkod: string; malad: string; hm: { malkod: string; malad: string; miktarTotal: number }[] }[]
  onClose: () => void; onSaved: () => void
}) {
  const [satirlar, setSatirlar] = useState<{ malkod: string; malad: string; boy: number; adet: number }[]>([])
  const [malkod, setMalkod] = useState('')
  const [malad, setMalad] = useState('')
  const [boy, setBoy] = useState('')
  const [adet, setAdet] = useState('1')

  // HM ihtiyaçlarından otomatik doldur
  function otoDoldur() {
    const hmItems: Record<string, { malkod: string; malad: string; boy: number; adet: number }> = {}
    workOrders.forEach(wo => {
      wo.hm?.forEach(h => {
        const mat = materials.find(m => m.kod === h.malkod)
        if (mat && mat.boy > 0) {
          const key = h.malkod
          if (!hmItems[key]) hmItems[key] = { malkod: h.malkod, malad: h.malad, boy: mat.boy, adet: 0 }
          hmItems[key].adet += h.miktarTotal
        }
      })
    })
    const items = Object.values(hmItems).filter(i => i.adet > 0)
    if (items.length) { setSatirlar(items); toast.success(items.length + ' malzeme HM ihtiyaçlarından dolduruldu') }
    else toast.info('HM ihtiyacı bulunamadı — manuel ekleyin')
  }

  function ekle() {
    if (!malkod && !malad) return
    setSatirlar([...satirlar, { malkod, malad, boy: parseFloat(boy) || 0, adet: parseInt(adet) || 1 }])
    setMalkod(''); setMalad(''); setBoy(''); setAdet('1')
  }

  function sil(i: number) { setSatirlar(prev => prev.filter((_, idx) => idx !== i)) }

  async function olustur() {
    if (!satirlar.length) { toast.error('En az bir satır ekleyin'); return }
    const hmMalz = materials.filter(m => m.tip === 'Hammadde' && m.boy > 0) as unknown as import('@/types').Material[]
    const sonuclar = optimizeKesim(satirlar, hmMalz)
    if (sonuclar.length) {
      await kesimPlaniKaydet(sonuclar)
      onSaved()
    } else {
      toast.error('Uygun ham malzeme bulunamadı — malzeme boyları kontrol edin')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Kesim Planı Oluştur</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        <button onClick={otoDoldur} className="mb-4 px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs hover:bg-accent/20">
          🔄 HM İhtiyaçlarından Otomatik Doldur
        </button>

        {/* Manuel ekleme */}
        <div className="flex gap-2 mb-3">
          <input value={malkod} onChange={e => setMalkod(e.target.value)} placeholder="Malzeme kodu" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          <input value={malad} onChange={e => setMalad(e.target.value)} placeholder="Malzeme adı" className="flex-[2] px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          <input type="number" value={boy} onChange={e => setBoy(e.target.value)} placeholder="Boy (mm)" className="w-20 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
          <input type="number" value={adet} onChange={e => setAdet(e.target.value)} placeholder="Adet" className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
          <button onClick={ekle} className="px-3 py-1.5 bg-accent text-white rounded text-xs"><Plus size={12} /></button>
        </div>

        {/* Satır listesi */}
        {satirlar.length > 0 && (
          <div className="bg-bg-2 border border-border rounded-lg overflow-hidden mb-4">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-3 py-2">Kod</th><th className="text-left px-3 py-2">Malzeme</th><th className="text-right px-3 py-2">Boy</th><th className="text-right px-3 py-2">Adet</th><th className="px-3 py-2"></th></tr></thead>
              <tbody>
                {satirlar.map((s, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{s.malkod}</td>
                    <td className="px-3 py-1.5 text-zinc-300">{s.malad}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{s.boy} mm</td>
                    <td className="px-3 py-1.5 text-right font-mono">{s.adet}</td>
                    <td className="px-3 py-1.5 text-right"><button onClick={() => sil(i)} className="text-zinc-500 hover:text-red"><Trash2 size={11} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={olustur} disabled={!satirlar.length} className="px-4 py-2 bg-green hover:bg-green/80 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            <Scissors size={13} className="inline mr-1" /> Optimize Et & Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}
