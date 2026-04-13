import { getActivityLog, clearActivityLog } from '@/lib/activityLog'

import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { Download, Upload, RefreshCw, AlertTriangle } from 'lucide-react'
import { today } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showAlert, showPrompt } from '@/lib/prompt'

export function DataManagement() {
  const store = useStore()
  
  const tables = [
    { label: 'Siparişler', key: 'orders', table: 'uys_orders' },
    { label: 'İş Emirleri', key: 'workOrders', table: 'uys_work_orders' },
    { label: 'Üretim Logları', key: 'logs', table: 'uys_logs' },
    { label: 'Malzemeler', key: 'materials', table: 'uys_malzemeler' },
    { label: 'Operasyonlar', key: 'operations', table: 'uys_operations' },
    { label: 'İstasyonlar', key: 'stations', table: 'uys_stations' },
    { label: 'Operatörler', key: 'operators', table: 'uys_operators' },
    { label: 'Reçeteler', key: 'recipes', table: 'uys_recipes' },
    { label: 'Ürün Ağaçları', key: 'bomTrees', table: 'uys_bom_trees' },
    { label: 'Stok Hareketleri', key: 'stokHareketler', table: 'uys_stok_hareketler' },
    { label: 'Kesim Planları', key: 'cuttingPlans', table: 'uys_kesim_planlari' },
    { label: 'Tedarikler', key: 'tedarikler', table: 'uys_tedarikler' },
    { label: 'Tedarikçiler', key: 'tedarikciler', table: 'uys_tedarikciler' },
    { label: 'Duruş Kodları', key: 'durusKodlari', table: 'uys_durus_kodlari' },
    { label: 'Müşteriler', key: 'customers', table: 'uys_customers' },
    { label: 'Sevkiyatlar', key: 'sevkler', table: 'uys_sevkler' },
    { label: 'Operatör Mesajları', key: 'operatorNotes', table: 'uys_operator_notes' },
    { label: 'Aktif Çalışmalar', key: 'activeWork', table: 'uys_active_work' },
    { label: 'Fire Logları', key: 'fireLogs', table: 'uys_fire_logs' },
  ]

  function exportJSON() {
    const data: Record<string, unknown> = {}
    tables.forEach(t => { data[t.key] = (store as unknown as Record<string, unknown>)[t.key] })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `uys_backup_${today()}.json`; a.click()
    localStorage.setItem('uys_last_backup', today())
    URL.revokeObjectURL(url)
  }

  // #17: JSON Import
  async function importJSON() {
    if (!await showConfirm('JSON yedeğini yüklemek mevcut verilerin ÜZERİNE YAZACAKTIR. Devam etmek istiyor musunuz?')) return
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        let restored = 0
        for (const t of tables) {
          const arr = data[t.key]
          if (Array.isArray(arr) && arr.length > 0) {
            // Tabloyu temizle ve yeniden yaz
            await supabase.from(t.table).delete().neq('id', '___impossible___')
            for (let i = 0; i < arr.length; i += 100) {
              await supabase.from(t.table).upsert(arr.slice(i, i + 100), { onConflict: 'id' })
            }
            restored++
          }
        }
        store.loadAll()
        toast.success(`${restored} tablo geri yüklendi`)
      } catch (err) {
        toast.error('JSON dosyası okunamadı')
      }
    }
    input.click()
  }

  // #20: Min Stok Uyarı
  const minStokUyarilari = store.materials.filter(m => {
    if (!m.minStok || m.minStok <= 0) return false
    const stok = store.stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
    return stok < m.minStok
  }).map(m => {
    const stok = store.stokHareketler.filter(h => h.malkod === m.kod).reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0)
    return { ...m, stok: Math.round(stok), eksik: Math.round(m.minStok - stok) }
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-semibold">Veri Yönetimi</h1></div>
        <div className="flex gap-2">
          <button onClick={() => store.loadAll()} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><RefreshCw size={13} /> Yenile</button>
          <button onClick={importJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 border border-amber/25 text-amber rounded-lg text-xs hover:bg-amber/20"><Upload size={13} /> JSON Geri Yükle</button>
          <button onClick={() => {
            import('xlsx').then(XLSX => {
              const wb = XLSX.utils.book_new()
              tables.forEach(t => {
                const arr = (store as unknown as Record<string, unknown[]>)[t.key] || []
                if (!arr.length) return
                const ws = XLSX.utils.json_to_sheet(arr as Record<string, unknown>[])
                XLSX.utils.book_append_sheet(wb, ws, t.label.slice(0, 31))
              })
              XLSX.writeFile(wb, `uys_tum_veriler_${today()}.xlsx`)
              toast.success('Tüm veriler Excel\'e aktarıldı')
            })
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel Aktar</button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Download size={13} /> JSON Yedek</button>
        </div>
      </div>

      {/* Min Stok Uyarıları */}
      {minStokUyarilari.length > 0 && (
        <div className="mb-4 p-3 bg-red/5 border border-red/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm font-semibold text-red mb-2">
            <AlertTriangle size={14} /> {minStokUyarilari.length} malzeme minimum stok altında!
          </div>
          <div className="space-y-1">
            {minStokUyarilari.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-accent w-24">{m.kod}</span>
                <span className="flex-1 text-zinc-300">{m.ad}</span>
                <span className="font-mono text-red">Stok: {m.stok}</span>
                <span className="font-mono text-zinc-500">Min: {m.minStok}</span>
                <span className="font-mono text-amber">Eksik: {m.eksik}</span>
              </div>
            ))}
            {minStokUyarilari.length > 10 && <div className="text-xs text-zinc-500">+{minStokUyarilari.length - 10} daha</div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {tables.map(t => {
          const arr = (store as unknown as Record<string, unknown[]>)[t.key] || []
          return (
            <div key={t.key} className="bg-bg-2 border border-border rounded-lg p-3">
              <div className="text-xs text-zinc-400">{t.label}</div>
              <div className="text-lg font-mono font-light text-accent">{arr.length}</div>
              <div className="text-[10px] text-zinc-600 font-mono">{t.table}</div>
            </div>
          )
        })}
      </div>

      {/* #28: Kullanıcı Log */}
      <div className="bg-bg-2 border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-zinc-400">İşlem Geçmişi (son 50)</div>
          <button onClick={async () => { clearActivityLog(); toast.success('Log temizlendi') }} className="text-[10px] text-zinc-600 hover:text-red">Temizle</button>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {getActivityLog().slice(0, 50).map((log, i) => (
            <div key={i} className="flex gap-2 text-[10px]">
              <span className="text-zinc-600 font-mono w-32 shrink-0">{log.ts}</span>
              <span className="text-zinc-500 w-16 shrink-0">{log.user}</span>
              <span className="text-accent">{log.action}</span>
              <span className="text-zinc-600 truncate">{log.detail}</span>
            </div>
          ))}
          {getActivityLog().length === 0 && <div className="text-zinc-600 text-xs">Henüz log yok</div>}
        </div>
      </div>

      <div className="bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-xs text-zinc-400 mb-2">Bağlantı Durumu</div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${store.synced ? 'bg-green' : 'bg-red'}`} />
          <span className="text-sm">{store.synced ? 'Supabase bağlı — normalize tablolardan okunuyor' : 'Çevrimdışı'}</span>
        </div>
      </div>

      {/* #24: Sistem Testi */}
      <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-sm font-semibold mb-2">🔍 Sistem Testi</div>
        <button onClick={async () => {
          const sorunlar: string[] = []
          // Orphan İE kontrolü
          const orphanWO = store.workOrders.filter(w => w.orderId && !store.orders.find(o => o.id === w.orderId))
          if (orphanWO.length) sorunlar.push(`${orphanWO.length} İE'nin siparişi bulunamadı (orphan)`)
          // Negatif stok
          const stokMap: Record<string, number> = {}
          store.stokHareketler.forEach(h => { stokMap[h.malkod] = (stokMap[h.malkod] || 0) + (h.tip === 'giris' ? h.miktar : -h.miktar) })
          const negatif = Object.entries(stokMap).filter(([, v]) => v < -0.01)
          if (negatif.length) sorunlar.push(`${negatif.length} malzemede negatif stok`)
          // Reçetesiz sipariş
          const noRecipe = store.orders.filter(o => !o.receteId)
          if (noRecipe.length) sorunlar.push(`${noRecipe.length} sipariş reçetesiz`)
          // İE'siz sipariş
          const noWO = store.orders.filter(o => !store.workOrders.some(w => w.orderId === o.id))
          if (noWO.length) sorunlar.push(`${noWO.length} siparişin iş emri yok`)
          // Hedefi 0 olan İE
          const zeroHedef = store.workOrders.filter(w => w.hedef <= 0)
          if (zeroHedef.length) sorunlar.push(`${zeroHedef.length} İE'nin hedefi 0`)
          // Bölümsüz operasyon
          const bolumYok = store.operations.filter(o => !o.bolum)
          if (bolumYok.length) sorunlar.push(`${bolumYok.length} operasyonun bölümü yok (operatör eşleşmesi çalışmaz)`)
          // Kesim planında orphan woId
          const woIdSet = new Set(store.workOrders.map(w => w.id))
          let orphanKesim = 0
          store.cuttingPlans.forEach(p => (p.satirlar || []).forEach((s: any) => (s.kesimler || []).forEach((k: any) => { if (k.woId && !woIdSet.has(k.woId)) orphanKesim++ })))
          if (orphanKesim) sorunlar.push(`${orphanKesim} kesim kaydında silinmiş İE referansı (orphan)`)
          // Gelmiş tedarik ama stok girişi yok
          const gelmisTed = store.tedarikler.filter(t => t.geldi)
          const stokTedIds = new Set(store.stokHareketler.filter(h => h.aciklama?.includes('Tedarik')).map(h => h.malkod))
          const stokYokTed = gelmisTed.filter(t => !stokTedIds.has(t.malkod))
          if (stokYokTed.length) sorunlar.push(`${stokYokTed.length} tedarik "geldi" ama stok girişi bulunamadı`)

          if (sorunlar.length) {
            toast.warning(`${sorunlar.length} sorun bulundu`)
            await showAlert(sorunlar.length ? sorunlar.map((s, i) => `${i + 1}. ${s}`).join('\n') : 'Sorun bulunamadı ✓', 'Sistem Testi Sonuçları')
          } else {
            toast.success('Sistem testi başarılı — sorun bulunamadı')
          }
        }} className="px-4 py-2 bg-accent/10 border border-accent/25 text-accent rounded-lg text-xs hover:bg-accent/20">
          Sistem Testi Çalıştır
        </button>
      </div>

      {/* Test Modu */}
      <div className="bg-bg-2 border border-border rounded-lg p-4 mb-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">🧪 Test Ortamı</div>
        <p className="text-xs text-zinc-500 mb-3">Açıldığında ekranın üstünde sarı "TEST ORTAMI" banner'ı görünür. Test verilerini ayırt etmek için kullanın.</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={localStorage.getItem('uys_test_mode') === 'true'}
              onChange={e => { localStorage.setItem('uys_test_mode', String(e.target.checked)); window.location.reload() }}
              className="accent-amber" />
            <span className="text-xs text-zinc-300">Test Modu {localStorage.getItem('uys_test_mode') === 'true' ? '(Açık)' : '(Kapalı)'}</span>
          </label>
          {localStorage.getItem('uys_test_mode') === 'true' && (
            <button onClick={async () => {
              if (!await showConfirm('"TEST" içeren tüm sipariş ve iş emirleri silinecek. Devam?')) return
              const { data: testOrders } = await supabase.from('uys_orders').select('id').ilike('siparis_no', '%TEST%')
              if (testOrders) { for (const o of testOrders) { await supabase.from('uys_orders').delete().eq('id', o.id) } }
              const { data: testWOs } = await supabase.from('uys_work_orders').select('id').ilike('ie_no', '%TEST%')
              if (testWOs) { for (const w of testWOs) { await supabase.from('uys_work_orders').delete().eq('id', w.id) } }
              store.loadAll(); toast.success('Test verileri temizlendi')
            }} className="px-3 py-1.5 bg-red/10 text-red rounded-lg text-xs hover:bg-red/20">🗑 Test Verilerini Temizle</button>
          )}
        </div>
      </div>

      {/* Admin Şifre */}
      <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">🔐 Admin Şifre (Silme Koruması)</div>
        <p className="text-xs text-zinc-500 mb-3">Ayarlanırsa İE silme/iptal işlemlerinde şifre sorulur.</p>
        <div className="flex gap-2">
          <input id="admin-pass-input" type="password" placeholder={localStorage.getItem('uys_admin_pass') ? '••••• (ayarlı)' : 'Şifre belirleyin'}
            className="flex-1 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
          <button onClick={() => {
            const inp = (document.getElementById('admin-pass-input') as HTMLInputElement)?.value
            if (inp) { localStorage.setItem('uys_admin_pass', inp); toast.success('Admin şifre ayarlandı') }
            else { localStorage.removeItem('uys_admin_pass'); toast.success('Admin şifre kaldırıldı') }
          }} className="px-3 py-2 bg-accent text-white rounded-lg text-xs">Kaydet</button>
        </div>
      </div>

      {/* #35: Sıfırlama İşlemleri — seçimli */}
      <div className="mt-6 bg-red/5 border border-red/20 rounded-lg p-4">
        <div className="text-sm font-semibold text-red mb-3">⚠ Sıfırlama İşlemleri — Silinecek kalemleri seçin</div>
        <SifirlamaSecimli />
      </div>
    </div>
  )
}

function SifirlamaSecimli() {
  const store = useStore()
  const { loadAll } = store
  const [secili, setSecili] = useState<Set<string>>(new Set())
  const [siliniyor, setSiliniyor] = useState(false)

  const kalemler = [
    { key: 'siparisler', ad: '📋 Siparişler', tablo: 'uys_orders', sayi: store.orders.length },
    { key: 'isEmirleri', ad: '🔧 İş Emirleri', tablo: 'uys_work_orders', sayi: store.workOrders.length },
    { key: 'uretimLog', ad: '📝 Üretim Logları', tablo: 'uys_logs', sayi: store.logs.length },
    { key: 'fireLog', ad: '🔥 Fire Logları', tablo: 'uys_fire_logs', sayi: store.fireLogs.length },
    { key: 'stokHareket', ad: '📦 Stok Hareketleri', tablo: 'uys_stok_hareketler', sayi: store.stokHareketler.length },
    { key: 'tedarik', ad: '🚚 Tedarikler', tablo: 'uys_tedarikler', sayi: store.tedarikler.length },
    { key: 'kesimPlan', ad: '✂ Kesim Planları', tablo: 'uys_kesim_planlari', sayi: store.cuttingPlans.length },
    { key: 'sevk', ad: '🚛 Sevkiyatlar', tablo: 'uys_sevkler', sayi: store.sevkler.length },
    { key: 'mesaj', ad: '💬 Operatör Mesajları', tablo: 'uys_operator_notes', sayi: store.operatorNotes.length },
    { key: 'aktifIs', ad: '▶ Aktif Çalışmalar', tablo: 'uys_active_work', sayi: store.activeWork.length },
    { key: 'recete', ad: '📋 Reçeteler', tablo: 'uys_recipes', sayi: (store as any).recipes?.length || 0 },
    { key: 'bom', ad: '🌳 Ürün Ağaçları', tablo: 'uys_bom_trees', sayi: (store as any).bomTrees?.length || 0 },
    { key: 'malzeme', ad: '🧱 Malzemeler', tablo: 'uys_malzemeler', sayi: store.materials.length },
    { key: 'operator', ad: '👷 Operatörler', tablo: 'uys_operators', sayi: store.operators.length },
    { key: 'operasyon', ad: '⚙ Operasyonlar', tablo: 'uys_operations', sayi: store.operations.length },
  ]

  function toggle(key: string) { setSecili(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }) }
  function tumunuSec() { secili.size === kalemler.length ? setSecili(new Set()) : setSecili(new Set(kalemler.map(k => k.key))) }

  // Hızlı seçimler
  function secUretimVerileri() { setSecili(new Set(['siparisler', 'isEmirleri', 'uretimLog', 'fireLog', 'stokHareket', 'tedarik', 'kesimPlan', 'sevk', 'mesaj', 'aktifIs'])) }

  async function sil() {
    if (!secili.size) { toast.error('Silinecek kalem seçin'); return }
    const seciliKalemler = kalemler.filter(k => secili.has(k.key))
    if (!await showConfirm(`${seciliKalemler.length} kategori silinecek:\n${seciliKalemler.map(k => k.ad).join(', ')}\n\nDevam?`)) return
    setSiliniyor(true)
    for (const k of seciliKalemler) {
      await supabase.from(k.tablo).delete().neq('id', '___impossible___')
    }
    setSecili(new Set()); setSiliniyor(false); loadAll()
    toast.success(seciliKalemler.length + ' kategori sıfırlandı')
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button onClick={tumunuSec} className="text-[10px] text-zinc-500 hover:text-white px-2 py-1 bg-bg-3 rounded">{secili.size === kalemler.length ? '☐ Hiçbiri' : '☑ Tümü'}</button>
        <button onClick={secUretimVerileri} className="text-[10px] text-amber hover:text-white px-2 py-1 bg-bg-3 rounded">Üretim Verileri</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {kalemler.map(k => (
          <label key={k.key} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${secili.has(k.key) ? 'bg-red/10 border-red/30' : 'bg-bg-2 border-border/50 hover:border-border'}`}>
            <input type="checkbox" checked={secili.has(k.key)} onChange={() => toggle(k.key)} className="accent-red" />
            <div>
              <div className="text-xs">{k.ad}</div>
              <div className="text-[10px] text-zinc-600 font-mono">{k.sayi} kayıt</div>
            </div>
          </label>
        ))}
      </div>
      <button onClick={sil} disabled={!secili.size || siliniyor} className="w-full px-4 py-2.5 bg-red/20 border border-red/30 text-red rounded-lg text-xs hover:bg-red/30 font-semibold disabled:opacity-30">
        {siliniyor ? 'Siliniyor...' : `🗑 Seçili ${secili.size} Kategoriyi Sıfırla`}
      </button>
    </div>
  )
}
