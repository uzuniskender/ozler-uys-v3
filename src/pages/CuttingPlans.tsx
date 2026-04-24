import { useAuth } from '@/hooks/useAuth'
import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { showConfirm } from '@/lib/prompt'
import { toast } from 'sonner'
import { optimizeKesim, kesimPlaniKaydet, kesimPlanOlustur, kesimPlanlariKaydet, getHamBoy, getParcaBoy, havuzdanYenidenOptimize } from '@/features/production/cutting'
import type { WorkOrder, AcikBar } from '@/types'
import { Trash2, Plus, Scissors, Zap, Search, Package, ArrowRight } from 'lucide-react'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'
import { advanceFlow } from '@/lib/pendingFlow'
import { FlowProgress } from '@/components/FlowProgress'

export function CuttingPlans() {
  const { cuttingPlans, materials, workOrders, operations, recipes, logs, acikBarlar, loadAll } = useStore()
  const { can, isGuest } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeFlowId = searchParams.get('flow') || ''  // v15.36 — flow akışı
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [artikInfo, setArtikInfo] = useState<{ planId: string; hamMalkod: string; hamMalad: string; fireMm: number; barIdx: number } | null>(null)
  const [showTamamlanan, setShowTamamlanan] = useState(false)
  // v15.35 — havuz önerisi: plan ID'leri kuyruğu (çoklu plan ardışık)
  const [havuzOneriQueue, setHavuzOneriQueue] = useState<string[]>([])
  // v15.36 — flow'da otomatik plan hesabı bir kez çalışsın
  const [flowAutoDone, setFlowAutoDone] = useState(false)

  const bekleyen = cuttingPlans.filter(p => p.durum !== 'tamamlandi')
  const gosterilen = showTamamlanan ? cuttingPlans : bekleyen

  // v15.36 — Flow akışında sayfa ilk açıldığında otomatik plan hesapla
  // v15.36.2 — Plan oluştuktan sonra otomatik MRP'ye ilerle (kullanıcı Kesim'e geri tıklayıp Yeni Sipariş ekleyebilir)
  useEffect(() => {
    if (!activeFlowId || flowAutoDone || !can('cutting_add')) return
    if (!workOrders.length || !recipes.length) return  // Store hazır olana kadar bekle
    ;(async () => {
      try {
        const logsSimple = logs.map(l => ({ woId: l.woId, qty: l.qty }))
        const cpMapped = cuttingPlans.map((p: any) => ({
          id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy,
          hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '',
          tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0,
        }))
        const planlar = kesimPlanOlustur(workOrders, operations as any, recipes, materials, logsSimple, cpMapped as any)
        if (planlar.length) {
          await kesimPlanlariKaydet(planlar as any)
          await loadAll()
          // v15.36.2 — Progress bar'ı "Kesim ✓" yap ve MRP'ye yönlendir
          await advanceFlow(activeFlowId, 'mrp')
          toast.success(`${planlar.length} kesim planı hazır — MRP'ye yönlendiriliyor`, { duration: 2500 })
          setTimeout(() => navigate('/mrp?flow=' + activeFlowId), 1800)
        } else {
          toast.info('Kesim operasyonlu açık İE bulunamadı — MRP adımına geç')
          // Plan oluşmasa bile akışı durdurma: MRP'ye geç
          await advanceFlow(activeFlowId, 'mrp')
          setTimeout(() => navigate('/mrp?flow=' + activeFlowId), 1500)
        }
      } catch (e) {
        console.error('[flow] auto plan:', e)
        toast.error('Otomatik plan hatası')
      } finally {
        setFlowAutoDone(true)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFlowId, workOrders.length, recipes.length])

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
  // v15.32: DISABLE. Artıklar artık uys_acik_barlar havuzunda otomatik izleniyor.
  // Bu fonksiyon çağrılsa da kullanıcıya bilgilendirme toast'u atar, stok yazmaz —
  // aksi takdirde aynı artık hem stok hem havuz olarak çift kayıt olurdu.
  async function artikStokaGir(_planId: string, _hamMalkod: string, _hamMalad: string, _artikBoy: number) {
    toast.info('Artıklar artık "Açık Bar Havuzu"nda otomatik izleniyor — Depolar sayfasındaki yeni tabdan görebilirsiniz.', { duration: 5000 })
  }

  return (
    <div>
      {/* v15.36 — Flow progress bar */}
      {activeFlowId && (
        <FlowProgress
          flowId={activeFlowId}
          current="kesim"
          actions={
            <>
              <button
                onClick={() => navigate('/orders?flow=' + activeFlowId)}
                className="px-3 py-1.5 bg-bg-2 border border-border text-zinc-300 rounded text-xs hover:bg-bg-3"
              >
                + Yeni Sipariş Ekle
              </button>
              <button
                onClick={async () => {
                  await advanceFlow(activeFlowId, 'mrp')
                  navigate('/mrp?flow=' + activeFlowId)
                }}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-xs font-semibold flex items-center gap-1"
              >
                MRP'ye Geç <ArrowRight size={12} />
              </button>
            </>
          }
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Kesim Planları</h1><p className="text-xs text-zinc-500">{cuttingPlans.length} plan · {bekleyen.length} bekleyen · {cuttingPlans.length - bekleyen.length} tamamlanan</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowTamamlanan(!showTamamlanan)} className={`px-3 py-1.5 rounded-lg text-xs border ${showTamamlanan ? 'bg-green/10 border-green/25 text-green' : 'bg-bg-2 border-border text-zinc-500'}`}>
            {showTamamlanan ? '✓ Tamamlananlar Görünür' : '○ Tamamlananları Göster'}
          </button>
          {can('cutting_add') && <button onClick={async () => {
            const logsSimple = logs.map(l => ({ woId: l.woId, qty: l.qty }))
            const cpMapped = cuttingPlans.map((p: any) => ({ id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy, hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '', tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0 }))
            const eskiIdSet = new Set(cuttingPlans.map((p: any) => p.id))
            const planlar = kesimPlanOlustur(workOrders, operations as any, recipes, materials, logsSimple, cpMapped as any)
            if (!planlar.length) { toast.info('Kesim operasyonlu açık İE bulunamadı'); return }
            const yeniSayi = planlar.filter(p => !eskiIdSet.has(p.id)).length
            const birlestirilen = planlar.length - yeniSayi
            await kesimPlanlariKaydet(planlar as any)
            const parcalar = [yeniSayi > 0 && `${yeniSayi} yeni plan`, birlestirilen > 0 && `${birlestirilen} plana İE eklendi`].filter(Boolean).join(' · ')
            loadAll()
            toast.success(parcalar || 'Değişiklik yok')

            // v15.35 — Havuz önerisi: bu planların ham malzemelerinde havuzda KULLANILABILIR açık bar varsa sırayla öner
            // v15.35.2 — Kullanılabilirlik ön-filtre: plandaki en küçük parça boyundan büyük/eşit bar yoksa modal gösterme
            const havuzlulanmisPlanIds: string[] = []
            for (const p of planlar) {
              if (p.durum !== 'bekliyor') continue
              const havuzAcik = acikBarlar.filter(a => a.durum === 'acik' && a.hamMalkod === p.hamMalkod)
              if (havuzAcik.length === 0) continue

              // Plandaki en küçük parça boyunu bul (bekleyen satırlardaki kesimlerden)
              let minParcaBoy = Infinity
              for (const s of (p.satirlar || [])) {
                if (s.durum && s.durum !== 'bekliyor') continue
                for (const k of (s.kesimler || []) as any[]) {
                  const pb = k.parcaBoy || 0
                  if (pb > 0 && pb < minParcaBoy) minParcaBoy = pb
                }
              }
              if (!isFinite(minParcaBoy)) continue  // parça boyu yok, öneri anlamsız

              // En az bir havuz barı bu min parça boyunu kaldırıyor mu?
              const uygunBar = havuzAcik.some(a => (a.uzunlukMm || 0) >= minParcaBoy)
              if (uygunBar) havuzlulanmisPlanIds.push(p.id)
            }
            if (havuzlulanmisPlanIds.length > 0) {
              setHavuzOneriQueue(havuzlulanmisPlanIds)
            }
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-green/10 border border-green/25 text-green rounded-lg text-xs font-semibold hover:bg-green/20"><Zap size={13} /> Otomatik Plan</button>}
          {can('cutting_add') && <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Scissors size={13} /> Manuel Plan</button>}
        </div>
      </div>

      {/* Kesim Önerileri — planlanmamış İE'ler */}
      {(() => {
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
        {gosterilen.length ? (
          <div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-zinc-500"><th className="text-left px-4 py-2.5">Ham Malzeme</th><th className="text-left px-4 py-2.5">Tip</th><th className="text-right px-4 py-2.5">Boy</th><th className="text-right px-4 py-2.5">Gerekli</th><th className="text-left px-4 py-2.5">Durum</th><th className="px-4 py-2.5"></th></tr></thead>
              <tbody>
                {gosterilen.map(p => {
                  const isOpen = selected === p.id
                  const satirlar = (p.satirlar || []) as { id: string; hamAdet: number; fireMm: number; kesimler: { woId: string; ieNo?: string; malkod: string; malad: string; parcaBoy: number; parcaEn?: number; adet: number; tamamlandi: number }[]; durum: string }[]
                  const toplamBar = satirlar.reduce((a, s) => a + (s.hamAdet || 0), 0)
                  // Otomatik durum hesapla: tüm İE'ler tamamlandı mı?
                  const allWoIds = satirlar.flatMap(s => s.kesimler.map(k => k.woId)).filter(Boolean)
                  const allDone = allWoIds.length > 0 && allWoIds.every(woId => {
                    const wo = workOrders.find(w => w.id === woId)
                    if (!wo) return true
                    const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
                    return prod >= wo.hedef
                  })
                  const someDone = allWoIds.some(woId => {
                    const prod = logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0)
                    return prod > 0
                  })
                  const gercekDurum = allDone ? 'tamamlandi' : someDone ? 'kismi' : 'bekliyor'
                  // Auto-update if status is wrong
                  if (gercekDurum === 'tamamlandi' && p.durum !== 'tamamlandi') {
                    supabase.from('uys_kesim_planlari').update({ durum: 'tamamlandi' }).eq('id', p.id).then(() => loadAll())
                  }
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
                        <div className="flex items-center gap-1.5">
                          <select value={p.durum} onChange={e => { e.stopPropagation(); updateDurum(p.id, e.target.value) }} onClick={e => e.stopPropagation()}
                            className={`px-1.5 py-0.5 rounded text-[10px] bg-bg-3 border border-border ${gercekDurum === 'tamamlandi' ? 'text-green' : gercekDurum === 'kismi' ? 'text-amber' : 'text-accent'}`}>
                            <option value="bekliyor">Bekliyor</option><option value="kismi">Kısmi</option><option value="tamamlandi">Tamamlandı</option>
                          </select>
                          {gercekDurum !== p.durum && <span className={`text-[9px] px-1 py-0.5 rounded ${gercekDurum === 'tamamlandi' ? 'bg-green/20 text-green' : 'bg-amber/20 text-amber'}`}>{gercekDurum === 'tamamlandi' ? '✓ Bitti' : '◐ Kısmi'}</span>}
                        </div>
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
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] text-zinc-500 font-mono">Bar #{si + 1} · {s.hamAdet} adet · Fire: {s.fireMm}mm</span>
                                  {s.fireMm > 10 && (
                                    <button onClick={() => setArtikInfo({ planId: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, fireMm: s.fireMm, barIdx: si })}
                                      className="px-2 py-0.5 bg-green/10 border border-green/20 text-green rounded text-[10px] font-semibold hover:bg-green/20">♻ Fire Yönet ({s.fireMm}mm)</button>
                                  )}
                                </div>
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
      {artikInfo && <ArtikOneriModal info={artikInfo} materials={materials} workOrders={workOrders} operations={operations} recipes={recipes} logs={logs} onClose={() => setArtikInfo(null)} onSaved={() => { setArtikInfo(null); loadAll() }} />}
      {havuzOneriQueue.length > 0 && (() => {
        const planId = havuzOneriQueue[0]
        const plan = cuttingPlans.find(p => p.id === planId)
        if (!plan) { setHavuzOneriQueue(q => q.slice(1)); return null }
        const havuzBarlari = acikBarlar.filter(a => a.durum === 'acik' && a.hamMalkod === plan.hamMalkod)
        if (!havuzBarlari.length) { setHavuzOneriQueue(q => q.slice(1)); return null }
        // v15.35.2 — Uygun bar kontrolü (render güvencesi)
        let minParcaBoy = Infinity
        for (const s of (plan.satirlar || [])) {
          if (s.durum && s.durum !== 'bekliyor') continue
          for (const k of (s.kesimler || []) as any[]) {
            const pb = k.parcaBoy || 0
            if (pb > 0 && pb < minParcaBoy) minParcaBoy = pb
          }
        }
        if (isFinite(minParcaBoy) && !havuzBarlari.some(a => (a.uzunlukMm || 0) >= minParcaBoy)) {
          // Uygun bar yok — sessizce atla
          setHavuzOneriQueue(q => q.slice(1))
          return null
        }
        return (
          <HavuzOneriModal
            plan={plan as any}
            havuzBarlari={havuzBarlari}
            workOrders={workOrders}
            materials={materials}
            logs={logs}
            onClose={() => setHavuzOneriQueue(q => q.slice(1))}
            onSaved={() => { loadAll(); setHavuzOneriQueue(q => q.slice(1)) }}
          />
        )
      })()}
    </div>
  )
}

// #8-9: Artık yönetimi — fire'dan stok girişi + uygun parça önerisi
function ArtikOneriModal({ info, materials, workOrders, operations, recipes, logs, onClose, onSaved }: {
  info: { planId: string; hamMalkod: string; hamMalad: string; fireMm: number; barIdx: number }
  materials: import('@/types').Material[]; workOrders: any[]; operations: any[]; recipes: any[]; logs: any[]
  onClose: () => void; onSaved: () => void
}) {
  const { cuttingPlans, loadAll } = useStore()
  const [artikKod, setArtikKod] = useState(info.hamMalkod + '-ARTIK-' + info.fireMm)
  const [stokGirisi, setStokGirisi] = useState(true)
  const [eklenen, setEklenen] = useState<Set<string>>(new Set())

  const fireMm = info.fireMm
  // Kalan fire hesabı — eklenen parçaları çıkar
  const plan = cuttingPlans.find(p => p.id === info.planId) as any
  const bar = plan?.satirlar?.[info.barIdx]
  const ekliParcalar = (bar?.kesimler || []) as any[]

  // Aynı HM'yi kullanan, fire'a sığabilecek açık İE'ler
  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']
  const uygunIEler = workOrders.filter(w => {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
    if (ekliParcalar.some((k: any) => k.woId === w.id)) return false // Zaten planda
    const prod = logs.filter((l: any) => l.woId === w.id).reduce((a: number, l: any) => a + l.qty, 0)
    if (prod >= w.hedef) return false
    const wOp = operations.find((o: any) => o.id === w.opId)
    const opAd = (wOp?.ad || w.opAd || '').toUpperCase()
    if (!kesimOps.some(k => opAd.includes(k))) return false
    if (w.hm?.some((h: any) => h.malkod === info.hamMalkod)) return true
    const rc = recipes.find((r: any) => r.id === w.rcId) || recipes.find((r: any) => r.mamulKod === w.malkod)
    if (rc?.satirlar) {
      const woKirno = w.kirno || '1'
      const depth = woKirno.split('.').length
      const direktAlt = rc.satirlar.filter((s: any) =>
        (s.kirno || '').startsWith(woKirno + '.') &&
        (s.kirno || '').split('.').length === depth + 1
      )
      if (direktAlt.some((s: any) => s.malkod === info.hamMalkod)) return true
    }
    return false
  }).map(w => {
    const prod = logs.filter((l: any) => l.woId === w.id).reduce((a: number, l: any) => a + l.qty, 0)
    const kalan = Math.max(0, w.hedef - prod)
    const m = materials.find(x => x.kod === w.malkod)
    const parcaBoy = m ? getParcaBoy(w.malkod, materials) : 0
    return { ...w, kalan, parcaBoy }
  }).filter(w => w.parcaBoy > 0 && w.parcaBoy <= fireMm)
  .sort((a, b) => b.parcaBoy - a.parcaBoy)

  async function planaEkle(w: any) {
    if (!plan || !bar) return
    const sigacak = Math.min(Math.floor(fireMm / w.parcaBoy), w.kalan)
    if (sigacak <= 0) return
    // Plan satirlarını güncelle — bu bar'a yeni kesim ekle
    const yeniSatirlar = [...(plan.satirlar || [])]
    const yeniKesimler = [...(yeniSatirlar[info.barIdx]?.kesimler || []), {
      woId: w.id, ieNo: w.ieNo, malkod: w.malkod, malad: w.malad,
      parcaBoy: w.parcaBoy, adet: sigacak, tamamlandi: 0,
    }]
    // Yeni fire hesapla
    const toplamKesim = yeniKesimler.reduce((a: number, k: any) => a + k.parcaBoy * k.adet, 0)
    const hamBoy = plan.hamBoy || 0
    const yeniFire = hamBoy - toplamKesim
    yeniSatirlar[info.barIdx] = { ...yeniSatirlar[info.barIdx], kesimler: yeniKesimler, fireMm: Math.max(0, yeniFire) }

    await supabase.from('uys_kesim_planlari').update({ satirlar: yeniSatirlar }).eq('id', info.planId)
    setEklenen(prev => new Set(prev).add(w.id))
    loadAll()
    toast.success(`${w.ieNo} plana eklendi — ${sigacak} adet × ${w.parcaBoy}mm`)
  }

  async function stokaGir() {
    if (!stokGirisi) { onClose(); return }
    // v15.32: DISABLE. Artıklar artık uys_acik_barlar havuzunda otomatik izleniyor.
    // Manuel "artıkı stoka gir" akışı çift kayıt tehlikesi yarattığı için kapatıldı.
    toast.info('Artıklar artık "Açık Bar Havuzu"nda otomatik izleniyor — manuel stoka giriş gerekmez.', { duration: 5000 })
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">♻ Fire Yönetimi</h2>
            <p className="text-xs text-zinc-500">{info.hamMalkod} · Bar #{info.barIdx + 1} · <b className="text-amber">{fireMm}mm</b> fire</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        {/* Stok girişi */}
        <div className="bg-bg-2 border border-border rounded-lg p-3 mb-4">
          <label className="flex items-center gap-2 mb-2 cursor-pointer">
            <input type="checkbox" checked={stokGirisi} onChange={e => setStokGirisi(e.target.checked)} className="accent-green" />
            <span className="text-xs font-semibold">Artık malzemeyi stoka gir</span>
          </label>
          {stokGirisi && (
            <input value={artikKod} onChange={e => setArtikKod(e.target.value)}
              className="w-full px-3 py-2 bg-bg-3 border border-border rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-green" />
          )}
        </div>

        {/* Uygun parça önerileri */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-zinc-400 mb-2">🔍 Fire'a sığabilecek parçalar ({uygunIEler.length})</div>
          {uygunIEler.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {uygunIEler.map(w => {
                const sigacak = Math.min(Math.floor(fireMm / w.parcaBoy), w.kalan)
                const zatenEklendi = eklenen.has(w.id)
                return (
                  <div key={w.id} className="flex items-center justify-between bg-bg-2 border border-border/50 rounded-lg p-2">
                    <div>
                      <span className="font-mono text-accent text-[11px]">{w.ieNo}</span>
                      <div className="text-[10px] text-zinc-400 truncate max-w-[200px]">{w.malad}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-xs font-mono">{w.parcaBoy}mm</div>
                        <div className="text-[10px] text-green font-semibold">{sigacak} adet · {w.kalan} kalan</div>
                      </div>
                      {zatenEklendi ? (
                        <span className="text-[10px] px-2 py-1 bg-green/20 text-green rounded font-semibold">✓ Eklendi</span>
                      ) : (
                        <button onClick={() => planaEkle(w)} className="text-[10px] px-2 py-1 bg-accent/20 text-accent rounded font-semibold hover:bg-accent/30">+ Ekle</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-xs text-zinc-600 bg-bg-2 rounded-lg p-3 text-center">
              {fireMm}mm fire'a sığabilecek açık İE bulunamadı
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={stokaGir} className="px-4 py-2 bg-green hover:bg-green/80 text-black rounded-lg text-xs font-semibold">
            {stokGirisi ? '♻ Stoka Gir & Kapat' : 'Kapat'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Manuel Kesim Planı — HM seç → İE seç → önizle → kaydet
function KesimOlusturModal({ materials, workOrders, onClose, onSaved }: {
  materials: import('@/types').Material[]
  workOrders: WorkOrder[]
  onClose: () => void; onSaved: () => void
}) {
  const { operations, recipes, logs, cuttingPlans } = useStore()
  const [hamMalkod, setHamMalkod] = useState('')
  const [seciliIEler, setSeciliIEler] = useState<Record<string, number>>({}) // woId → adet
  const [showMatSearch, setShowMatSearch] = useState(false)

  // HM listesi — sadece Hammadde (boy veya uzunluk > 0)
  const hmListesi = materials.filter(m => m.tip === 'Hammadde' && (getHamBoy(m) > 0))
  const seciliHM = materials.find(m => m.kod === hamMalkod)
  const hamBoy = seciliHM ? getHamBoy(seciliHM) : 0

  // Bu HM'yi kullanan açık İE'ler
  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']
  const uygunIEler = workOrders.filter(w => {
    if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    if (prod >= w.hedef) return false
    const wOp = operations.find(o => o.id === w.opId)
    const opAd = (wOp?.ad || w.opAd || '').toUpperCase()
    if (!kesimOps.some(k => opAd.includes(k))) return false
    // HM eşleşmesi
    if (w.hm?.some(h => h.malkod === hamMalkod)) return true
    const rc = recipes.find(r => r.id === w.rcId) || recipes.find(r => r.mamulKod === w.malkod)
    if (rc?.satirlar?.some(s => s.malkod === hamMalkod)) return true
    return false
  }).map(w => {
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    const kalan = Math.max(0, w.hedef - prod)
    const pb = getParcaBoy(w.malkod, materials)
    return { ...w, kalan, parcaBoy: pb }
  }).filter(w => w.parcaBoy > 0 && w.parcaBoy <= hamBoy)

  // Ön izleme hesapla
  const barlar: { kesimler: { ieNo: string; malad: string; parcaBoy: number; adet: number }[]; fire: number }[] = []
  if (hamBoy > 0) {
    const ihtiyaclar = Object.entries(seciliIEler)
      .filter(([, a]) => a > 0)
      .map(([woId, adet]) => {
        const ie = uygunIEler.find(w => w.id === woId)
        return ie ? { ieNo: ie.ieNo, malad: ie.malad, parcaBoy: ie.parcaBoy, adet } : null
      })
      .filter(Boolean)
      .sort((a, b) => (b!.parcaBoy || 0) - (a!.parcaBoy || 0)) as { ieNo: string; malad: string; parcaBoy: number; adet: number }[]

    // Best-fit yerleştirme
    const _barlar: { kalan: number; kesimler: typeof ihtiyaclar }[] = []
    for (const iht of ihtiyaclar) {
      let kalanAdet = iht.adet
      while (kalanAdet > 0) {
        let placed = false
        for (const bar of _barlar) {
          const fit = Math.min(Math.floor(bar.kalan / iht.parcaBoy), kalanAdet)
          if (fit > 0) {
            const mev = bar.kesimler.find(k => k.ieNo === iht.ieNo)
            if (mev) mev.adet += fit; else bar.kesimler.push({ ...iht, adet: fit })
            bar.kalan -= fit * iht.parcaBoy; kalanAdet -= fit; placed = true; break
          }
        }
        if (!placed) {
          const fit = Math.min(Math.floor(hamBoy / iht.parcaBoy), kalanAdet)
          _barlar.push({ kalan: hamBoy - fit * iht.parcaBoy, kesimler: [{ ...iht, adet: fit }] })
          kalanAdet -= fit
        }
      }
    }
    _barlar.forEach(b => barlar.push({ kesimler: b.kesimler, fire: b.kalan }))
  }

  const toplamBar = barlar.length
  const toplamFire = barlar.reduce((a, b) => a + b.fire, 0)

  function toggleIE(woId: string, kalan: number) {
    setSeciliIEler(prev => {
      const yeni = { ...prev }
      if (yeni[woId]) delete yeni[woId]
      else yeni[woId] = kalan
      return yeni
    })
  }

  async function kaydet() {
    if (!barlar.length) { toast.error('Kesim satırı yok'); return }
    const satirlar = barlar.map(b => ({
      id: uid(), hamAdet: 1, fireMm: b.fire, durum: 'bekliyor',
      kesimler: b.kesimler.map(k => {
        const ie = uygunIEler.find(w => w.ieNo === k.ieNo)
        return { woId: ie?.id || '', ieNo: k.ieNo, malkod: ie?.malkod || '', malad: k.malad, parcaBoy: k.parcaBoy, adet: k.adet, tamamlandi: 0 }
      })
    }))
    await supabase.from('uys_kesim_planlari').insert({
      id: uid(), ham_malkod: hamMalkod, ham_malad: seciliHM?.ad || hamMalkod,
      ham_boy: hamBoy, ham_en: 0, kesim_tip: 'boy',
      durum: 'bekliyor', satirlar, gerekli_adet: toplamBar, tarih: today(),
    })
    onSaved()
  }

  const COLORS = ['#4f9cf9', '#f97b4f', '#6fcf97', '#bb6bd9', '#f2c94c', '#56ccf2']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-semibold">Manuel Kesim Planı</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg">✕</button>
        </div>

        {/* 1: HM Seç */}
        <div className="mb-4">
          <label className="text-[11px] text-zinc-500 mb-1 block">1. Hammadde Seç</label>
          <div className="flex items-center gap-1">
            <select value={hamMalkod} onChange={e => { setHamMalkod(e.target.value); setSeciliIEler({}) }}
              className="flex-1 px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none">
              <option value="">— Hammadde seçin —</option>
              {hmListesi.map(m => <option key={m.kod} value={m.kod}>{m.kod} — {m.ad} ({getHamBoy(m)}mm)</option>)}
            </select>
            <button type="button" onClick={() => setShowMatSearch(true)} title="Detaylı arama (ölçü filtreli)"
              className="w-9 h-9 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent hover:border-accent/50 shrink-0">
              <Search size={12} />
            </button>
          </div>
        </div>

        {/* 2: İE Seç */}
        {hamMalkod && (
          <div className="mb-4">
            <label className="text-[11px] text-zinc-500 mb-1 block">2. İş Emirlerini Seç ({uygunIEler.length} uygun İE)</label>
            {uygunIEler.length ? (
              <div className="bg-bg-2 border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-zinc-500"><th className="px-3 py-2 w-8"></th><th className="text-left px-3 py-2">İE</th><th className="text-left px-3 py-2">Ürün</th><th className="text-right px-3 py-2">Parça</th><th className="text-right px-3 py-2">Kalan</th><th className="text-right px-3 py-2 w-20">Adet</th></tr></thead>
                  <tbody>
                    {uygunIEler.map(w => (
                      <tr key={w.id} className={`border-b border-border/30 cursor-pointer ${seciliIEler[w.id] ? 'bg-accent/10' : 'hover:bg-bg-3/30'}`}>
                        <td className="px-3 py-1.5"><input type="checkbox" checked={!!seciliIEler[w.id]} onChange={() => toggleIE(w.id, w.kalan)} className="accent-accent" /></td>
                        <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{w.ieNo}</td>
                        <td className="px-3 py-1.5 text-zinc-300 truncate max-w-[180px]">{w.malad}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-500">{w.parcaBoy}mm</td>
                        <td className="px-3 py-1.5 text-right font-mono">{w.kalan}</td>
                        <td className="px-3 py-1.5 text-right">
                          {seciliIEler[w.id] !== undefined && (
                            <input type="number" value={seciliIEler[w.id]} min={1} max={w.kalan}
                              onChange={e => setSeciliIEler(prev => ({ ...prev, [w.id]: Math.min(parseInt(e.target.value) || 1, w.kalan) }))}
                              onClick={e => e.stopPropagation()}
                              className="w-16 px-1.5 py-0.5 bg-bg-3 border border-accent/30 rounded text-[11px] text-zinc-200 text-right focus:outline-none" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="text-xs text-zinc-600 p-3 bg-bg-2 rounded-lg">Bu hammaddeyi kullanan açık kesim İE'si bulunamadı</div>}
          </div>
        )}

        {/* 3: Ön İzleme */}
        {barlar.length > 0 && (
          <div className="mb-4">
            <label className="text-[11px] text-zinc-500 mb-2 block">3. Kesim Ön İzleme — {toplamBar} bar · Fire: {toplamFire}mm</label>
            <div className="space-y-2">
              {barlar.map((bar, bi) => (
                <div key={bi} className="bg-bg-2 border border-border rounded-lg p-2">
                  <div className="text-[10px] text-zinc-500 mb-1">Bar #{bi + 1} · Fire: {bar.fire}mm ({hamBoy > 0 ? Math.round(bar.fire / hamBoy * 100) : 0}%)</div>
                  <svg width="100%" height="32" viewBox={`0 0 ${hamBoy} 30`} className="bg-zinc-900 rounded overflow-hidden mb-1">
                    {(() => {
                      let x = 0; const rects: JSX.Element[] = []
                      bar.kesimler.forEach((k, ki) => {
                        for (let ai = 0; ai < k.adet; ai++) {
                          rects.push(<rect key={`${ki}-${ai}`} x={x} y={1} width={Math.max(1, k.parcaBoy - 1)} height={28} rx={1} fill={COLORS[ki % COLORS.length]} opacity={0.75}><title>{k.ieNo} {k.parcaBoy}mm</title></rect>)
                          x += k.parcaBoy
                        }
                      })
                      if (x < hamBoy) rects.push(<rect key="f" x={x} y={1} width={hamBoy - x - 1} height={28} rx={1} fill="#ef4444" opacity={0.15}><title>Fire {hamBoy - x}mm</title></rect>)
                      return rects
                    })()}
                  </svg>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {bar.kesimler.map((k, ki) => (
                      <span key={ki} className="text-[10px]"><span style={{ color: COLORS[ki % COLORS.length] }}>■</span> {k.ieNo} {k.parcaBoy}mm ×{k.adet}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={kaydet} disabled={!barlar.length} className="px-4 py-2 bg-green hover:bg-green/80 disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            <Scissors size={13} className="inline mr-1" /> Kaydet ({toplamBar} bar)
          </button>
        </div>
      </div>
      {showMatSearch && (
        <MaterialSearchModal
          materials={materials as any}
          allowedTypes={['Hammadde']}
          title="Hammadde Ara — Ölçü Filtreli"
          onSelect={(mat) => { setHamMalkod(mat.kod); setSeciliIEler({}); setShowMatSearch(false) }}
          onClose={() => setShowMatSearch(false)}
        />
      )}
    </div>
  )
}

// ═══ HAVUZ ÖNERİ MODALI — v15.35 ═══
// Otomatik plan oluşturulduktan sonra, eğer ham malzemede havuzda açık bar
// varsa kullanıcıya gösterilir. Kullanıcı hangi havuz barlarını kullanmak
// istediğini seçer → optimizer yeniden çalışır, plan güncellenir.
function HavuzOneriModal({
  plan, havuzBarlari, workOrders, materials, logs, onClose, onSaved,
}: {
  plan: { id: string; hamMalkod: string; hamMalad: string; hamBoy: number; hamEn: number; kesimTip: string; durum: string; satirlar: any[]; gerekliAdet: number; tarih: string }
  havuzBarlari: import('@/types').AcikBar[]
  workOrders: any[]
  materials: any[]
  logs: any[]
  onClose: () => void
  onSaved: () => void
}) {
  // Varsayılan: en uzun havuz barları seçili (kesime en uygun olanlar)
  const sortedBarlar = [...havuzBarlari].sort((a, b) => b.uzunlukMm - a.uzunlukMm)
  const [secilen, setSecilen] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const secilenBarlar = sortedBarlar.filter(b => secilen.has(b.id))
  const secilenMm = secilenBarlar.reduce((a, b) => a + (b.uzunlukMm || 0), 0)

  // Plan'ın mevcut durumu
  const toplamHamAdet = plan.satirlar.reduce((a, s) => a + (s.hamAdet || 0), 0)
  const bekleyenSatirlar = plan.satirlar.filter(s => !s.durum || s.durum === 'bekliyor')
  const kilitliSayi = plan.satirlar.length - bekleyenSatirlar.length

  // v15.35.1 — Plandaki parça boyları + İE özeti
  // Bekleyen satırlardaki kesimleri woId+parcaBoy bazında grupla
  const parcaOzeti = (() => {
    const map: Record<string, { ieNo: string; malad: string; parcaBoy: number; adet: number }> = {}
    for (const s of bekleyenSatirlar) {
      for (const k of s.kesimler || []) {
        const key = (k.woId || '') + '|' + (k.parcaBoy || 0)
        if (!map[key]) {
          map[key] = { ieNo: k.ieNo || '', malad: k.malad || '', parcaBoy: k.parcaBoy || 0, adet: 0 }
        }
        map[key].adet += (k.adet || 0) * (s.hamAdet || 1)
      }
    }
    return Object.values(map).sort((a, b) => b.parcaBoy - a.parcaBoy)
  })()

  // En küçük parça boyu — havuz bar kullanılabilirlik kriteri
  const minParcaBoy = parcaOzeti.length > 0
    ? Math.min(...parcaOzeti.map(p => p.parcaBoy).filter(p => p > 0))
    : 0

  // Havuz bar kullanılabilir mi (en küçük parçayı sığdırabiliyor mu)
  function kullanilabilir(bar: import('@/types').AcikBar): boolean {
    if (!minParcaBoy) return true  // plan boşsa hepsi potansiyel
    return bar.uzunlukMm >= minParcaBoy
  }

  const kullanilabilirSayi = sortedBarlar.filter(kullanilabilir).length

  function toggle(id: string) {
    const y = new Set(secilen)
    if (y.has(id)) y.delete(id); else y.add(id)
    setSecilen(y)
  }
  function tumKullanilabilirSec() {
    setSecilen(new Set(sortedBarlar.filter(kullanilabilir).map(b => b.id)))
  }
  function temizle() { setSecilen(new Set()) }

  async function uygula() {
    if (!secilenBarlar.length) { toast.error('En az bir havuz barı seç'); return }

    setLoading(true)
    try {
      // cutting.ts havuzdanYenidenOptimize fonksiyonu ile plan satırlarını güncelle
      const logsSimple = logs.map(l => ({ woId: l.woId, qty: l.qty }))
      const yeniSatirlar = havuzdanYenidenOptimize(
        plan as any,
        secilenBarlar.map(b => ({ id: b.id, uzunlukMm: b.uzunlukMm })),
        workOrders,
        materials,
        logsSimple,
      )

      // Planı güncelle — yeni satırlar + gerekliAdet (havuz satırları hariç)
      const yeniGerekliAdet = yeniSatirlar.filter(s => !s.havuzBarId).reduce((a, s) => a + (s.hamAdet || 0), 0)
      const { error } = await supabase
        .from('uys_kesim_planlari')
        .update({
          satirlar: yeniSatirlar,
          gerekli_adet: yeniGerekliAdet,
        })
        .eq('id', plan.id)

      if (error) { console.error('[havuz] plan update:', error); toast.error('Plan güncellenemedi: ' + error.message); return }

      // v15.35.1 — Kullanılan / havuzda kalan havuz bar sayısı
      const havuzKullanilan = yeniSatirlar.filter(s => s.havuzBarId).length
      const havuzAtlanan = secilenBarlar.length - havuzKullanilan
      const yeniBarSayisi = yeniSatirlar.filter(s => !s.havuzBarId).reduce((a, s) => a + (s.hamAdet || 0), 0)
      if (havuzAtlanan > 0) {
        toast.success(`Plan güncellendi: ${havuzKullanilan} havuz barı kullanıldı (${havuzAtlanan} bar parça sığmadığı için havuzda kaldı) + ${yeniBarSayisi} yeni bar`, { duration: 6000 })
      } else {
        toast.success(`Plan güncellendi: ${havuzKullanilan} havuz barı + ${yeniBarSayisi} yeni bar`)
      }
      onSaved()
    } catch (e: any) {
      console.error('[havuz] exception:', e)
      toast.error('İşlem başarısız: ' + (e?.message || 'bilinmeyen hata'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Başlık */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-amber" />
            <h2 className="text-sm font-semibold">Havuz Önerisi</h2>
          </div>
          <div className="mt-1 font-mono text-accent text-xs">{plan.hamMalkod}</div>
          <div className="text-zinc-400 text-[11px]">{plan.hamMalad}</div>
          <div className="mt-2 text-[11px] text-zinc-500">
            Plan: <span className="text-zinc-300 font-mono">{toplamHamAdet} yeni bar</span> açılacak
            {kilitliSayi > 0 && <span className="ml-2 text-amber">({kilitliSayi} kilitli satır korunur)</span>}
          </div>
        </div>

        {/* Info + Parça özeti */}
        <div className="px-6 py-3 bg-bg-2/50 border-b border-border text-[11px] text-zinc-400 leading-relaxed">
          Havuzda bu malzemeden <span className="text-zinc-200 font-semibold">{havuzBarlari.length}</span> açık bar var.
          Seçersen plan yeniden hesaplanır; havuz barlarına sığan parçalar önce onlardan kesilir.
          {minParcaBoy > 0 && (
            <span className="block mt-1">
              Plandaki en küçük parça: <span className="text-zinc-200 font-mono">{minParcaBoy} mm</span>.
              {' '}
              <span className="text-zinc-300">{kullanilabilirSayi}</span>/{sortedBarlar.length} havuz barı yeterli boyutta.
            </span>
          )}
        </div>

        {/* Parça listesi — bu plan ne kesiyor */}
        {parcaOzeti.length > 0 && (
          <div className="px-6 py-2 border-b border-border bg-bg-3/20">
            <div className="text-[10px] text-zinc-500 mb-1">Bu plan şu İE'lerin parçalarını kesiyor:</div>
            <div className="flex flex-wrap gap-1.5">
              {parcaOzeti.slice(0, 6).map((p, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-2 border border-border/50 rounded text-[10px]">
                  <span className="font-mono text-accent">{p.ieNo}</span>
                  <span className="text-zinc-500">·</span>
                  <span className="text-zinc-300 font-mono">{p.parcaBoy}mm</span>
                  <span className="text-zinc-500">×</span>
                  <span className="text-zinc-400">{p.adet}</span>
                </span>
              ))}
              {parcaOzeti.length > 6 && (
                <span className="text-[10px] text-zinc-600 self-center">+{parcaOzeti.length - 6} daha</span>
              )}
            </div>
          </div>
        )}

        {/* Kontrol */}
        <div className="px-6 py-2 border-b border-border flex items-center justify-between text-[11px]">
          <div className="text-zinc-400">
            Seçili: <span className="text-zinc-200 font-semibold">{secilenBarlar.length}</span>/{sortedBarlar.length}
            {secilenBarlar.length > 0 && <> · <span className="text-zinc-300 font-mono">{Math.round(secilenMm)}</span> mm</>}
          </div>
          <div className="flex gap-3">
            <button onClick={tumKullanilabilirSec} className="text-accent hover:underline">
              Kullanılabilirleri Seç
            </button>
            <span className="text-zinc-600">·</span>
            <button onClick={temizle} className="text-zinc-400 hover:underline">Temizle</button>
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-2 z-10">
              <tr className="border-b border-border text-zinc-500">
                <th className="w-10 px-3 py-2"></th>
                <th className="text-right px-3 py-2">Uzunluk</th>
                <th className="text-left px-3 py-2">Durum</th>
                <th className="text-left px-3 py-2">Oluşma</th>
                <th className="text-left px-3 py-2">Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {sortedBarlar.map(b => {
                const secili = secilen.has(b.id)
                const uygun = kullanilabilir(b)
                return (
                  <tr key={b.id} className={`border-b border-border/30 ${secili ? 'bg-accent/5' : 'hover:bg-bg-3/30'} ${!uygun ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-1.5 text-center">
                      <input type="checkbox" checked={secili} onChange={() => toggle(b.id)} />
                    </td>
                    <td className="text-right px-3 py-1.5 font-mono text-zinc-200">{Math.round(b.uzunlukMm)} mm</td>
                    <td className="px-3 py-1.5">
                      {uygun ? (
                        <span className="text-green text-[10px]">✓ yeterli</span>
                      ) : (
                        <span className="text-amber text-[10px]" title={`En küçük parça ${minParcaBoy}mm — bu bara sığmaz`}>
                          ⚠ küçük
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-zinc-400">{b.olusmaTarihi || '-'}</td>
                    <td className="px-3 py-1.5 text-zinc-500 font-mono text-[10px]">
                      {b.kaynakPlanId ? '…' + b.kaynakPlanId.slice(-6) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Alt aksiyon */}
        <div className="px-6 py-4 border-t border-border flex justify-between items-center">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs hover:bg-bg-3/70"
          >
            Havuz Kullanma
          </button>
          <button
            onClick={uygula}
            disabled={!secilenBarlar.length || loading}
            className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:bg-bg-3 disabled:text-zinc-600 text-white rounded-lg text-xs font-semibold"
          >
            {loading ? 'Hesaplanıyor…' : `Seçilenleri Kullan (${secilenBarlar.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
