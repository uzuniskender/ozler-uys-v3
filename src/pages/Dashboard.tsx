import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { showConfirm } from '@/lib/prompt'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'
import { uid, today, pctColor } from '@/lib/utils'
import { AlertTriangle, Clock, Package, Flame, MessageSquare, Wrench } from 'lucide-react'

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
  const { orders, workOrders, logs, operatorNotes, activeWork, operators, fireLogs, materials, stokHareketler, loadAll } = useStore()
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
    logs.filter(l => l.tarih === todayStr).flatMap(l => l.operatorlar.map(o => o.id))
  )
  const girmeyenler = operators.filter(o => o.aktif && !bugunLogOprIds.has(o.id))

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
        if (data.length < 2) return null
        return (
          <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden p-4">
            <div className="text-xs font-semibold text-zinc-400 mb-3">Son 7 Gün Üretim</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={data}>
                <XAxis dataKey="gun" tick={{ fontSize: 10, fill: '#666' }} />
                <YAxis tick={{ fontSize: 10, fill: '#666' }} width={35} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="uretim" fill="#22c55e" radius={[3, 3, 0, 0]} name="Üretim" />
                <Bar dataKey="fire" fill="#ef4444" radius={[3, 3, 0, 0]} name="Fire" />
              </BarChart>
            </ResponsiveContainer>
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
          <div className="divide-y divide-border/50">
            {operatorNotes.slice(0, 10).map(n => (
              <div key={n.id} className={`px-4 py-2 flex items-center gap-3 text-xs ${!n.okundu ? 'bg-accent/5' : ''}`}>
                <span className={`font-medium ${!n.okundu ? 'text-white' : 'text-zinc-400'}`}>{n.opAd}</span>
                <span className="font-mono text-zinc-600">{n.tarih} {n.saat}</span>
                <span className="flex-1 text-zinc-300 truncate">{n.mesaj}</span>
                {!n.okundu ? (
                  <button onClick={async () => { await supabase.from('uys_operator_notes').update({ okundu: true }).eq('id', n.id); loadAll() }}
                    className="px-2 py-0.5 bg-accent/10 text-accent rounded text-[10px] hover:bg-accent/20 whitespace-nowrap">✓ Okundu</button>
                ) : <span className="text-[10px] text-zinc-600">okundu</span>}
                <button onClick={async () => { if (!await showConfirm('Mesajı silmek istediğinize emin misiniz?')) return; await supabase.from('uys_operator_notes').delete().eq('id', n.id); loadAll() }} className="text-zinc-600 hover:text-red text-[10px]">✕</button>
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
    </div>
  )
}
