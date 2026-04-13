import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { showConfirm, showPrompt } from '@/lib/prompt'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { uid, today, pctColor } from '@/lib/utils'
import { AlertTriangle, Clock, Package, Flame, MessageSquare, Wrench, CheckCircle, XCircle, ArrowRight } from 'lucide-react'

function StatCard({ value, label, color, icon: Icon }: { value: number | string; label: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-bg-2 border border-border rounded-lg p-4 flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}/10`}>
        <Icon size={18} className={`text-${color}`} />
      </div>
      <div>
        <div className={`text-xl font-light font-mono text-${color}`}>{value}</div>
        <div className="text-[11px] text-zinc-500">{label}</div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const { orders, workOrders, logs, operatorNotes, activeWork, operators, fireLogs, materials, stokHareketler, tedarikler, cuttingPlans, loadAll } = useStore()
  const { isGuest } = useAuth()
  const todayStr = today()

  // Calculations
  const aktifOrders = orders.filter(o => {
    const wos = workOrders.filter(w => w.orderId === o.id)
    const totalProd = wos.reduce((s, w) => {
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
    }, 0)
    const avgPct = wos.length ? totalProd / wos.length : 0
    return avgPct < 100
  })

  const terminGecen = aktifOrders.filter(o => o.termin && o.termin < todayStr)
  const acikWOs = workOrders.filter(w => {
    const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
    return w.hedef > 0 && prod < w.hedef
  })

  const bugunFire = fireLogs.filter(f => f.tarih === todayStr)
  const toplamFire = bugunFire.reduce((a, f) => a + f.qty, 0)

  const okunmamis = operatorNotes.filter(n => !n.okundu)

  // Bugün giriş yapmayan operatörler
  const bugunLogOprIds = new Set(
    logs.filter(l => l.tarih === todayStr).flatMap(l => (Array.isArray(l.operatorlar) ? l.operatorlar : []).map((o: any) => o.id))
  )
  const girmeyenler = operators.filter(o => o.aktif !== false && !bugunLogOprIds.has(o.id))

  // Min stok uyarıları
  const minStokUyari = materials.filter(m => {
    if (!m.minStok || m.minStok <= 0) return false
    const stok = stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
    return stok < m.minStok
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Genel Durum</h1>
          <p className="text-xs text-zinc-500 font-mono">{todayStr}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard value={aktifOrders.length} label="Aktif Sipariş" color="accent" icon={Package} />
        <StatCard value={terminGecen.length} label="Termin Geçmiş" color="red" icon={AlertTriangle} />
        <StatCard value={acikWOs.length} label="Açık İş Emri" color="zinc-300" icon={Clock} />
        <StatCard value={toplamFire || '—'} label="Bugün Fire" color={toplamFire > 0 ? 'red' : 'zinc-500'} icon={Flame} />
        <StatCard value={okunmamis.length} label="Yeni Mesaj" color={okunmamis.length > 0 ? 'amber' : 'zinc-500'} icon={MessageSquare} />
        <StatCard value={activeWork.length} label="Aktif Çalışma" color={activeWork.length > 0 ? 'green' : 'zinc-500'} icon={Wrench} />
      </div>

      {/* Üretim Zinciri Özet */}
      {(() => {
        const bekleyenTed = tedarikler.filter(t => !t.geldi).length
        const bekleyenKP = cuttingPlans.filter(p => p.durum !== 'tamamlandi').length
        const mrpBekleyen = orders.filter(o => o.receteId && (!o.mrpDurum || o.mrpDurum === 'bekliyor') && workOrders.some(w => w.orderId === o.id) && aktifOrders.some(a => a.id === o.id)).length
        const kesimEksik = (() => {
          const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']
          const planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap((s: any) => (s.kesimler || []).map((k: any) => k.woId))))
          return workOrders.filter(w => {
            if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
            const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
            if (prod >= w.hedef) return false
            if (planliWoIds.has(w.id)) return false
            return kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
          }).length
        })()
        if (!bekleyenTed && !bekleyenKP && !mrpBekleyen && !kesimEksik) return null
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {mrpBekleyen > 0 && (
              <button onClick={() => { window.location.hash = '#/mrp' }} className="bg-bg-2 border border-cyan-500/20 rounded-lg p-3 text-left hover:bg-cyan-500/5">
                <div className="text-[10px] text-cyan-400 mb-1">📊 MRP Hesaplanmamış Sipariş</div>
                <div className="text-lg font-mono text-cyan-300">{mrpBekleyen}</div>
                <div className="text-[10px] text-zinc-600">sipariş</div>
              </button>
            )}
            {kesimEksik > 0 && (
              <button onClick={() => { window.location.hash = '#/cutting' }} className="bg-bg-2 border border-amber/20 rounded-lg p-3 text-left hover:bg-amber/5">
                <div className="text-[10px] text-amber mb-1">✂ Kesim Planlanmamış</div>
                <div className="text-lg font-mono text-amber">{kesimEksik}</div>
                <div className="text-[10px] text-zinc-600">iş emri</div>
              </button>
            )}
            {bekleyenKP > 0 && (
              <button onClick={() => { window.location.hash = '#/cutting' }} className="bg-bg-2 border border-green/20 rounded-lg p-3 text-left hover:bg-green/5">
                <div className="text-[10px] text-green mb-1">✂ Kesim Bekliyor</div>
                <div className="text-lg font-mono text-green">{bekleyenKP}</div>
                <div className="text-[10px] text-zinc-600">plan</div>
              </button>
            )}
            {bekleyenTed > 0 && (
              <button onClick={() => { window.location.hash = '#/procurement' }} className="bg-bg-2 border border-purple-500/20 rounded-lg p-3 text-left hover:bg-purple-500/5">
                <div className="text-[10px] text-purple-400 mb-1">📦 Tedarik Bekliyor</div>
                <div className="text-lg font-mono text-purple-300">{bekleyenTed}</div>
                <div className="text-[10px] text-zinc-600">kalem</div>
              </button>
            )}
          </div>
        )
      })()}

      {/* Termin Geçmiş */}
      {terminGecen.length > 0 && (
        <div className="mb-4 p-3 bg-red/5 border border-red/20 rounded-lg">
          <div className="text-sm font-semibold text-red mb-2">
            🚨 {terminGecen.length} siparişin termini geçmiş!
          </div>
          <div className="space-y-1">
            {terminGecen.map(o => (
              <div key={o.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-accent">{o.siparisNo}</span>
                <span className="text-zinc-400">{o.musteri || '—'}</span>
                <span className="font-mono text-red ml-auto">{o.termin}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Min Stok Uyarı */}
      {/* Yedek Uyarısı */}
      {(() => {
        const lastBackup = localStorage.getItem('uys_last_backup')
        if (!lastBackup) return (
          <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg text-xs text-amber">
            ⚠ Henüz yedek alınmamış — <button onClick={() => window.location.hash = '#/data'} className="underline hover:text-white">Veri Yönetimi</button> sayfasından JSON yedek alın.
          </div>
        )
        const days = Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000)
        if (days >= 7) return (
          <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg text-xs text-amber">
            ⚠ Son yedek {days} gün önce ({lastBackup}) — <button onClick={() => window.location.hash = '#/data'} className="underline hover:text-white">yedek alın</button>
          </div>
        )
        return null
      })()}

      {minStokUyari.length > 0 && (
        <div className="mb-4 p-3 bg-amber/5 border border-amber/20 rounded-lg">
          <div className="text-sm font-semibold text-amber mb-2 flex items-center justify-between">
            <span>⚠ {minStokUyari.length} malzeme minimum stok altında</span>
            <button onClick={async () => {
              if (!await showConfirm(`${minStokUyari.length} malzeme için tedarik önerisi oluşturulsun mu?`)) return
              let count = 0
              for (const m of minStokUyari) {
                const stok = stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
                const eksik = Math.max(0, m.minStok - stok)
                if (eksik <= 0) continue
                await supabase.from('uys_tedarikler').insert({
                  id: uid(), malkod: m.kod, malad: m.ad, miktar: Math.ceil(eksik),
                  birim: m.birim || 'Adet', tarih: today(), durum: 'bekliyor', geldi: false,
                  not_: 'Min stok önerisi', siparis_no: '',
                })
                count++
              }
              loadAll(); toast.success(count + ' tedarik önerisi oluşturuldu')
            }} className="px-2 py-1 bg-amber/20 text-amber rounded text-[10px] hover:bg-amber/30">Tedarik Oluştur</button>
          </div>
          <div className="space-y-1">
            {minStokUyari.slice(0, 5).map(m => (
              <div key={m.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-accent">{m.kod}</span>
                <span className="text-zinc-400">{m.ad}</span>
                <span className="font-mono text-red ml-auto">Min: {m.minStok}</span>
              </div>
            ))}
            {minStokUyari.length > 5 && <div className="text-[11px] text-zinc-600">+{minStokUyari.length - 5} daha</div>}
          </div>
        </div>
      )}

      {/* Günlük Üretim Grafiği */}
      {(() => {
        const gunMap: Record<string, { gun: string; uretim: number; fire: number }> = {}
        logs.forEach(l => {
          if (!l.tarih) return
          if (!gunMap[l.tarih]) gunMap[l.tarih] = { gun: l.tarih.slice(5), uretim: 0, fire: 0 }
          gunMap[l.tarih].uretim += l.qty
          gunMap[l.tarih].fire += l.fire || 0
        })
        const data = Object.values(gunMap).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-7)
        return (
          <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-3">📊 Son 7 Gün Üretim</div>
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data}>
                  <XAxis dataKey="gun" tick={{ fontSize: 10, fill: '#666' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} width={35} />
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="uretim" fill="#22c55e" radius={[3, 3, 0, 0]} name="Üretim" />
                  <Bar dataKey="fire" fill="#ef4444" radius={[3, 3, 0, 0]} name="Fire" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="text-xs text-zinc-600 text-center py-6">Henüz üretim kaydı yok — operatör panelinden kayıt girildiğinde grafik burada görünecek</div>}
          </div>
        )
      })()}

      {/* Aktif Çalışmalar */}
      {activeWork.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold flex items-center gap-2">
            <Wrench size={14} className="text-green" /> Aktif Çalışmalar ({activeWork.length})
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2">Operatör</th>
                <th className="text-left px-4 py-2">İE No</th>
                <th className="text-left px-4 py-2">Ürün</th>
                <th className="text-left px-4 py-2">Başlangıç</th>
              </tr>
            </thead>
            <tbody>
              {activeWork.map(a => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="px-4 py-1.5 font-medium">{a.opAd}</td>
                  <td className="px-4 py-1.5 font-mono text-accent">{workOrders.find(w => w.id === a.woId)?.ieNo || a.woId}</td>
                  <td className="px-4 py-1.5 text-zinc-400">{a.woAd}</td>
                  <td className="px-4 py-1.5 font-mono text-zinc-500">{a.baslangic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Operatör Mesajları */}
      {operatorNotes.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold flex items-center gap-2">
            {okunmamis.length > 0 ? '📩' : '📬'} Operatör Mesajları
            {okunmamis.length > 0 && (
              <>
              <span className="bg-red text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {okunmamis.length} yeni
              </span>
              <button onClick={async () => {
                for (const n of okunmamis) { await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id) }
                loadAll()
              }} className="ml-auto text-[10px] text-zinc-500 hover:text-accent">Tümünü Okundu Yap</button>
              </>
            )}
          </div>
          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {operatorNotes.sort((a, b) => (b.tarih + b.saat).localeCompare(a.tarih + a.saat)).slice(0, 20).map(n => (
              <div key={n.id} className={`px-4 py-2 text-xs ${!n.okundu ? 'bg-accent/5' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-medium ${!n.okundu ? 'text-white' : 'text-zinc-400'}`}>{n.opAd}</span>
                  <span className="font-mono text-zinc-600 text-[10px]">{n.tarih} {n.saat}</span>
                  <span className="flex-1" />
                  {!n.okundu && (
                    <button onClick={async () => { await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id); loadAll() }}
                      className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] hover:bg-accent/20">✓</button>
                  )}
                  <button onClick={async () => {
                    const cevap = await showPrompt('Cevap yaz — ' + n.opAd, 'Cevabınız...')
                    if (!cevap) return
                    const now = new Date()
                    const saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')
                    // Yeni mesaj olarak ekle (operatörün göreceği şekilde)
                    await supabase.from('uys_operator_notes').insert({
                      id: uid(), op_id: n.opId, op_ad: '📋 Yönetim', tarih: today(), saat,
                      mesaj: cevap.trim(), okundu: true,
                    })
                    // Orijinal mesajı okundu yap
                    if (!n.okundu) await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id)
                    loadAll(); toast.success('Cevap gönderildi — operatör görecek')
                  }} className="px-2 py-0.5 bg-green/10 text-green rounded text-[10px] hover:bg-green/20">💬 Cevapla</button>
                  <button onClick={async () => { if (!await showConfirm('Mesajı silmek istediğinize emin misiniz?')) return; await supabase.from('uys_operator_notes').delete().eq('id', n.id); loadAll() }} className="text-zinc-600 hover:text-red text-[10px]">✕</button>
                </div>
                {/* Operatör mesajı */}
                <div className="bg-bg-3/50 rounded-lg px-3 py-2 text-zinc-300 mb-1">{n.mesaj}</div>
                {/* Cevap */}
                {n.cevap && (
                  <div className="ml-6 bg-accent/5 border-l-2 border-accent/30 rounded-r-lg px-3 py-2 text-zinc-300">
                    <span className="text-accent text-[10px] font-medium">{n.cevaplayan || 'Yönetim'}</span>
                    <span className="text-zinc-600 text-[10px] ml-2">{n.cevapTarih}</span>
                    <div className="mt-0.5">{n.cevap}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bugün giriş yapmayan */}
      {girmeyenler.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border text-sm font-semibold text-zinc-400">
            Bugün Giriş Yapmayan Operatörler ({girmeyenler.length})
          </div>
          <div className="flex flex-wrap gap-1.5 p-3">
            {girmeyenler.slice(0, 20).map(o => (
              <span key={o.id} className="text-[11px] px-2 py-0.5 bg-bg-3 rounded text-zinc-400">
                {o.ad}
              </span>
            ))}
            {girmeyenler.length > 20 && (
              <span className="text-[11px] text-zinc-600">+{girmeyenler.length - 20} daha</span>
            )}
          </div>
        </div>
      )}

      {/* Aktif Siparişler */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold">Aktif Siparişler</div>
        {aktifOrders.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="text-left px-4 py-2">Sipariş No</th>
                <th className="text-left px-4 py-2">Müşteri</th>
                <th className="text-left px-4 py-2">Termin</th>
                <th className="text-right px-4 py-2">İlerleme</th>
              </tr>
            </thead>
            <tbody>
              {aktifOrders.slice(0, 15).map(o => {
                const wos = workOrders.filter(w => w.orderId === o.id)
                const totalPct = wos.length
                  ? wos.reduce((s, w) => {
                      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
                      return s + (w.hedef > 0 ? Math.min(100, prod / w.hedef * 100) : 0)
                    }, 0) / wos.length
                  : 0
                const pct = Math.round(totalPct)
                const terminColor = o.termin && o.termin < todayStr ? 'text-red' : o.termin && o.termin <= todayStr ? 'text-amber' : 'text-zinc-500'
                return (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-bg-3/50 cursor-pointer">
                    <td className="px-4 py-2 font-mono text-accent">{o.siparisNo}</td>
                    <td className="px-4 py-2 text-zinc-300">{o.musteri || '—'}</td>
                    <td className={`px-4 py-2 font-mono ${terminColor}`}>{o.termin || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`font-mono text-[11px] ${pctColor(pct)}`}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-zinc-600 text-sm">Aktif sipariş yok</div>
        )}
      </div>

      {/* #16: Uzun Süredir Açık İşler */}
      {(() => {
        const now = new Date()
        const uzunAcik = activeWork.filter(a => {
          if (!a.baslangic || !a.tarih) return false
          const baslangic = new Date(a.tarih + 'T' + a.baslangic + ':00')
          const dakika = Math.round((now.getTime() - baslangic.getTime()) / 60000)
          return dakika > 480
        }).map(a => {
          const baslangic = new Date(a.tarih + 'T' + a.baslangic + ':00')
          const dakika = Math.round((now.getTime() - baslangic.getTime()) / 60000)
          const wo = workOrders.find(w => w.id === a.woId)
          return { ...a, dakika, saat: Math.floor(dakika / 60), ieNo: wo?.ieNo || '—' }
        })
        if (!uzunAcik.length) return null
        return (
          <div className="mt-4 p-3 bg-red/5 border border-red/20 rounded-lg">
            <div className="text-sm font-semibold text-red mb-2">⏰ {uzunAcik.length} iş 8+ saattir açık — kapatılmayı unutmuş olabilir!</div>
            {uzunAcik.map(a => (
              <div key={a.id} className="flex items-center gap-3 text-xs py-1">
                <span className="text-zinc-300 font-semibold">{a.opAd}</span>
                <span className="font-mono text-accent">{a.ieNo}</span>
                <span className="text-zinc-500 truncate">{a.woAd?.slice(0, 30)}</span>
                <span className="ml-auto font-mono text-red font-bold">{a.saat}s {a.dakika % 60}dk</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* #14: Yapılması Gerekenler — Akıllı Yönlendirme */}
      {(() => {
        const adimlar: { icon: string; mesaj: string; link: string }[] = []
        const recetesiz = orders.filter(o => !o.receteId)
        if (recetesiz.length) adimlar.push({ icon: '📋', mesaj: `${recetesiz.length} siparişin reçetesi bağlı değil`, link: '#/orders' })
        const ieSiz = orders.filter(o => o.receteId && !workOrders.some(w => w.orderId === o.id))
        if (ieSiz.length) adimlar.push({ icon: '⚙', mesaj: `${ieSiz.length} sipariş için İE oluşturulmamış`, link: '#/orders' })
        const mrpYok = orders.filter(o => o.receteId && (!o.mrpDurum || o.mrpDurum === 'bekliyor') && workOrders.some(w => w.orderId === o.id) && aktifOrders.some(a => a.id === o.id)).length
        if (mrpYok) adimlar.push({ icon: '📊', mesaj: `${mrpYok} siparişin malzeme ihtiyacı (MRP) henüz hesaplanmadı`, link: '#/mrp' })
        const _kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']
        const _planliWoIds = new Set(cuttingPlans.flatMap(p => (p.satirlar || []).flatMap((s: any) => (s.kesimler || []).map((k: any) => k.woId))))
        const _kesimEksik = workOrders.filter(w => {
          if (w.durum === 'iptal' || w.durum === 'tamamlandi') return false
          const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
          if (prod >= w.hedef) return false
          if (_planliWoIds.has(w.id)) return false
          return _kesimOps.some(k => (w.opAd || '').toUpperCase().includes(k))
        }).length
        if (_kesimEksik) adimlar.push({ icon: '✂', mesaj: `${_kesimEksik} İE kesim planlanmamış`, link: '#/cutting' })
        const _bekleyenTed = tedarikler.filter(t => !t.geldi).length
        if (_bekleyenTed) adimlar.push({ icon: '📦', mesaj: `${_bekleyenTed} tedarik bekliyor`, link: '#/procurement' })
        if (!adimlar.length) return (
          <div className="mt-4 p-4 bg-green/5 border border-green/20 rounded-lg flex items-center gap-3">
            <CheckCircle size={18} className="text-green" />
            <div><div className="text-sm font-semibold text-green">Tüm Süreçler Güncel</div><div className="text-[11px] text-zinc-500">Bekleyen adım yok</div></div>
          </div>
        )
        return (
          <div className="mt-4 bg-bg-2 border border-amber/20 rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border text-sm font-semibold text-amber flex items-center gap-2">
              <AlertTriangle size={14} /> Yapılması Gerekenler ({adimlar.length})
            </div>
            <div className="divide-y divide-border/30">
              {adimlar.map((a, i) => (
                <button key={i} onClick={() => { window.location.hash = a.link }} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-3/30">
                  <span className="text-lg">{a.icon}</span>
                  <span className="flex-1 text-xs text-zinc-300">{a.mesaj}</span>
                  <ArrowRight size={14} className="text-amber" />
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* #17: Operasyon Bazlı Dağılım */}
      {(() => {
        const deptMap: Record<string, number> = {}
        logs.forEach(l => {
          const wo = workOrders.find(w => w.id === l.woId)
          const dept = wo?.opAd?.split(' ')[0] || 'Diğer'
          deptMap[dept] = (deptMap[dept] || 0) + l.qty
        })
        const data = Object.entries(deptMap).map(([name, value]) => ({ name: name.slice(0, 12), value })).sort((a, b) => b.value - a.value).slice(0, 8)
        const COLORS = ['#4f9cf9', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']
        if (data.length < 1) return null
        return (
          <div className="mt-4 bg-bg-2 border border-border rounded-lg overflow-hidden p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-3">Operasyon Bazlı Üretim Dağılımı</div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="40%" height={140}>
                <PieChart>
                  <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={55} strokeWidth={0}>
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1">
                {data.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-zinc-400 flex-1">{d.name}</span>
                    <span className="font-mono text-zinc-300">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* #13: Sistem Durumu */}
      <div className="mt-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-sm font-semibold text-zinc-400">🔧 Sistem Durumu</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/30">
          {[
            { ad: 'Malzemeler', d: materials.length },
            { ad: 'Siparişler', d: orders.length },
            { ad: 'İş Emirleri', d: workOrders.length },
            { ad: 'Operatörler', d: operators.length },
            { ad: 'Kesim Planları', d: cuttingPlans.length },
            { ad: 'Stok Hareketleri', d: stokHareketler.length },
            { ad: 'Tedarikler', d: tedarikler.length },
            { ad: 'Üretim Logları', d: logs.length },
          ].map(c => (
            <div key={c.ad} className="bg-bg-2 p-3 flex items-center gap-2">
              {c.d > 0 ? <CheckCircle size={12} className="text-green" /> : <XCircle size={12} className="text-zinc-600" />}
              <div>
                <div className="text-[10px] text-zinc-500">{c.ad}</div>
                <div className="text-xs font-mono text-zinc-300">{c.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
