import { useAuth } from '@/hooks/useAuth'
import { ACTION_GROUPS, ROLE_LIST, DEFAULTS, type AdminRole } from '@/lib/permissions'
import { getActivityLog, clearActivityLog } from '@/lib/activityLog'
import { useState, useEffect, Fragment } from 'react'
import { useStore } from '@/store'
import { supabase } from '@/lib/supabase'
import { Download, Upload, RefreshCw, AlertTriangle } from 'lucide-react'
import { today, uid } from '@/lib/utils'
import { toast } from 'sonner'
import { showConfirm, showAlert, showPrompt } from '@/lib/prompt'
import { cuttingPlanTemizle, rezerveleriSenkronla, hesaplaMRP } from '@/features/production/mrp'
import { tedarikStokId } from '@/lib/tedarikHelpers'

// ═══ SAĞLIK RAPORU TİPLERİ ═══
type SaglikDurum = 'pass' | 'warn' | 'fail'
interface SaglikKontrolu {
  no: number
  ad: string
  durum: SaglikDurum
  mesaj: string
  neden?: string
  aksiyon?: string
  autoFixEtiket?: string
  autoFix?: () => Promise<string>
  detay?: any
}
interface SaglikRaporu {
  timestamp: string
  version: string
  ozet: { pass: number; warn: number; fail: number }
  kontroller: SaglikKontrolu[]
}

export function DataManagement() {
  const store = useStore()
  const { loadAll } = store
  const { can } = useAuth()

  // ═══ SAĞLIK RAPORU STATE ═══
  const [report, setReport] = useState<SaglikRaporu | null>(null)
  const [running, setRunning] = useState(false)
  const [autoFixing, setAutoFixing] = useState<number | null>(null)

  async function saglikRaporuCalistir() {
    setRunning(true)
    const kontroller: SaglikKontrolu[] = []
    try {
      const [woRes, logRes, fireRes, stokRes, tedRes, matsRes, planRes, rezRes, orderRes, recRes, bomRes] = await Promise.all([
        supabase.from('uys_work_orders').select('*'),
        supabase.from('uys_logs').select('*'),
        supabase.from('uys_fire_logs').select('*'),
        supabase.from('uys_stok_hareketler').select('*'),
        supabase.from('uys_tedarikler').select('*'),
        supabase.from('uys_malzemeler').select('*'),
        supabase.from('uys_kesim_planlari').select('*'),
        supabase.from('uys_mrp_rezerve').select('*'),
        supabase.from('uys_orders').select('*'),
        supabase.from('uys_recipes').select('*'),
        supabase.from('uys_bom_trees').select('*'),
      ])
      const wos = woRes.data || []
      const logs = logRes.data || []
      const fires = fireRes.data || []
      const stoks = stokRes.data || []
      const teds = tedRes.data || []
      const mats = matsRes.data || []
      const plans = planRes.data || []
      const rezs = rezRes.data || []
      const orders = orderRes.data || []
      const recs = recRes.data || []
      const boms = bomRes.data || []

      const aktifOrders = orders.filter((o: any) => o.durum !== 'kapalı' && o.durum !== 'iptal')
      const aktifOrderIds = new Set(aktifOrders.map((o: any) => o.id))
      const woIds = new Set(wos.map((w: any) => w.id))
      const logIds = new Set(logs.map((l: any) => l.id))

      // 1. Sipariş–İE tutarlılığı
      const siparisIEyok = aktifOrders.filter((o: any) => {
        const u = o.urunler || []
        const rcVar = u.some((x: any) => x.rcId) || o.recete_id
        return rcVar && wos.filter((w: any) => w.order_id === o.id).length === 0
      })
      kontroller.push({
        no: 1, ad: 'Sipariş–İE tutarlılığı',
        durum: siparisIEyok.length ? 'warn' : 'pass',
        mesaj: siparisIEyok.length ? `${siparisIEyok.length} reçeteli sipariş için iş emri yok` : `${aktifOrders.length} aktif sipariş temiz`,
        neden: siparisIEyok.length ? 'Reçete atanmış ama iş emri üretilmemiş. Eski veri veya revize sırasında oluşur.' : undefined,
        aksiyon: siparisIEyok.length ? 'Sipariş detayında "Yeniden Çalıştır" tıklayın veya siparişi açıp tekrar Kaydet.' : undefined,
        detay: siparisIEyok.length ? { siparisler: siparisIEyok.map((o: any) => ({ id: o.id, no: o.siparis_no })) } : undefined,
      })

      // 2. İE–Reçete tutarlılığı
      const rcIds = new Set(recs.map((r: any) => r.id))
      const ieRecetesiz = wos.filter((w: any) => w.recete_id && !rcIds.has(w.recete_id))
      kontroller.push({
        no: 2, ad: 'İE–Reçete tutarlılığı',
        durum: ieRecetesiz.length ? 'fail' : 'pass',
        mesaj: ieRecetesiz.length ? `${ieRecetesiz.length} İE'nin reçetesi silinmiş` : `${wos.length} İE temiz`,
        neden: ieRecetesiz.length ? 'Reçete silindi ama bağlı İE duruyor.' : undefined,
        aksiyon: ieRecetesiz.length ? 'Siparişi silip tekrar oluşturun veya reçeteyi yeniden atayın.' : undefined,
        detay: ieRecetesiz.length ? { ieler: ieRecetesiz.map((w: any) => ({ id: w.id, ieNo: w.ie_no })) } : undefined,
      })

      // 3. Cutting plan–İE tutarlılığı (orphan kesim)
      const orphanKesimler: { planId: string; woId: string }[] = []
      plans.forEach((p: any) => (p.satirlar || []).forEach((s: any) => (s.kesimler || []).forEach((k: any) => { if (k.woId && !woIds.has(k.woId)) orphanKesimler.push({ planId: p.id, woId: k.woId }) })))
      const orphanWoIds = [...new Set(orphanKesimler.map(k => k.woId))]
      kontroller.push({
        no: 3, ad: 'Cutting plan–İE tutarlılığı',
        durum: orphanKesimler.length ? 'warn' : 'pass',
        mesaj: orphanKesimler.length ? `${orphanKesimler.length} kesim kaydı silinmiş İE'ye bağlı (${orphanWoIds.length} farklı woId)` : `${plans.length} plan temiz`,
        neden: orphanKesimler.length ? 'Sipariş silindiğinde/revize edildiğinde plan güncellenmemiş. v15.25 öncesi bug.' : undefined,
        aksiyon: orphanKesimler.length ? 'Otomatik Düzelt — orphan kesimler plan satırlarından çıkarılır, boşalan plan silinir.' : undefined,
        autoFixEtiket: orphanKesimler.length ? 'Orphan kesimleri temizle' : undefined,
        autoFix: orphanKesimler.length ? async () => {
          const planObjs = plans.map((p: any) => ({ id: p.id, satirlar: p.satirlar || [] }))
          const r = await cuttingPlanTemizle(orphanWoIds, planObjs)
          return `${r.temizlenenKesim} kesim · ${r.guncellenenPlan} plan güncellendi · ${r.silinenPlan} plan silindi`
        } : undefined,
        detay: orphanKesimler.length ? { planSayisi: new Set(orphanKesimler.map(k => k.planId)).size, orphanWoIds } : undefined,
      })

      // 4. Tedarik–Stok tutarlılığı (geldi ama stok yok)
      // Case-insensitive match: malkod'lar normalize edilerek karşılaştırılır
      const normalize = (s: string | null | undefined) => (s || '').trim().toLocaleUpperCase('tr-TR')
      const stokTedarikMap = new Set<string>()
      stoks.filter((h: any) => h.tip === 'giris' && (h.aciklama || '').toLowerCase().includes('tedarik'))
        .forEach((h: any) => stokTedarikMap.add(normalize(h.malkod)))
      const tedStokEksik = teds.filter((t: any) => t.geldi && !stokTedarikMap.has(normalize(t.malkod)))
      kontroller.push({
        no: 4, ad: 'Tedarik–Stok tutarlılığı',
        durum: tedStokEksik.length ? 'fail' : 'pass',
        mesaj: tedStokEksik.length ? `${tedStokEksik.length} tedarik "geldi" ama stok girişi yok` : `${teds.filter((t: any) => t.geldi).length} gelmiş tedarik temiz`,
        neden: tedStokEksik.length ? 'Tedarik "geldi" olarak işaretlenmiş ama stok hareketi oluşturulmamış. Muhtemel sebep: eski bir bug veya kullanıcı manuel işaretleme yapmış.' : undefined,
        aksiyon: tedStokEksik.length ? 'Malzeme fiziksel olarak geldiyse "🔧 Stok girişlerini yaz" tıklayın. Gelmediyse Tedarikler sayfasından "geldi" işaretini kaldırın.' : undefined,
        autoFixEtiket: tedStokEksik.length ? 'Stok girişlerini yaz' : undefined,
        autoFix: tedStokEksik.length ? async () => {
          // Deterministik ID ile upsert — tıklamayı 2 kez yaparsa duplicate oluşmaz
          const kayitlar = tedStokEksik.map((t: any) => ({
            id: tedarikStokId(t.id),
            tarih: today(),
            malkod: t.malkod,
            malad: t.malad,
            miktar: t.miktar,
            tip: 'giris',
            aciklama: `Tedarik girişi${t.siparis_no ? ' — ' + t.siparis_no : ''}${t.tedarikci_ad ? ' — ' + t.tedarikci_ad : ''}`,
          }))
          const { error } = await supabase.from('uys_stok_hareketler').upsert(kayitlar)
          if (error) return `Hata: ${error.message}`
          return `${kayitlar.length} stok girişi yazıldı`
        } : undefined,
        detay: tedStokEksik.length ? { tedarikler: tedStokEksik.map((t: any) => ({ id: t.id, malkod: t.malkod, miktar: t.miktar, tarih: t.tarih, siparisNo: t.siparis_no || '(yok)' })) } : undefined,
      })

      // 5. Rezerve–Stok dengesi
      const fizMap = new Map<string, number>()
      stoks.forEach((h: any) => {
        const key = (h.malkod || '').trim().toLowerCase()
        if (!key) return
        fizMap.set(key, (fizMap.get(key) || 0) + (h.tip === 'giris' ? (h.miktar || 0) : -(h.miktar || 0)))
      })
      const rezMap = new Map<string, number>()
      rezs.forEach((r: any) => {
        const key = (r.malkod || '').trim().toLowerCase()
        if (!key) return
        rezMap.set(key, (rezMap.get(key) || 0) + (r.miktar || 0))
      })
      const asimlar: any[] = []
      rezMap.forEach((rezerve, key) => {
        const stok = fizMap.get(key) || 0
        if (rezerve > stok + 0.01) asimlar.push({ malkod: key, rezerve, stok })
      })
      kontroller.push({
        no: 5, ad: 'Rezerve–Stok dengesi',
        durum: asimlar.length ? 'fail' : 'pass',
        mesaj: asimlar.length ? `${asimlar.length} malzemede toplam rezerve fiziksel stoğu aşıyor` : `${rezMap.size} rezerveli malzemede aşım yok`,
        neden: asimlar.length ? 'Rezerve dağılımı bozulmuş. Stok hareketi silinmiş veya eski rezerve kaydı kalmış.' : undefined,
        aksiyon: asimlar.length ? 'Otomatik Düzelt — rezerveleri termin-FIFO ile tüm aktif siparişler için yeniden dağıtır.' : undefined,
        autoFixEtiket: asimlar.length ? 'Rezerveleri yeniden senkronize et' : undefined,
        autoFix: asimlar.length ? async () => {
          const s = useStore.getState()
          const cpMapped = s.cuttingPlans.map((p: any) => ({ hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '', gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [] }))
          await rezerveleriSenkronla(s.orders as any, s.workOrders, s.recipes, s.stokHareketler, s.tedarikler, cpMapped, s.materials)
          return 'Rezerveler yeniden dağıtıldı'
        } : undefined,
        detay: asimlar.length ? { asimlar } : undefined,
      })

      // 6. Rezerve–Sipariş eşleşmesi (orphan rezerve)
      const orphanRez = rezs.filter((r: any) => r.order_id && !aktifOrderIds.has(r.order_id))
      kontroller.push({
        no: 6, ad: 'Rezerve–Sipariş eşleşmesi',
        durum: orphanRez.length ? 'warn' : 'pass',
        mesaj: orphanRez.length ? `${orphanRez.length} rezerve kaydı silinmiş/kapalı siparişe bağlı (orphan)` : `${rezs.length} rezerve kaydı temiz`,
        neden: orphanRez.length ? 'Sipariş silindi veya kapatıldı ama rezerve temizlenmedi.' : undefined,
        aksiyon: orphanRez.length ? 'Otomatik Düzelt — orphan rezerveleri sil.' : undefined,
        autoFixEtiket: orphanRez.length ? 'Orphan rezerveleri sil' : undefined,
        autoFix: orphanRez.length ? async () => {
          const ids = orphanRez.map((r: any) => r.id)
          for (let i = 0; i < ids.length; i += 50) await supabase.from('uys_mrp_rezerve').delete().in('id', ids.slice(i, i + 50))
          return `${ids.length} orphan rezerve silindi`
        } : undefined,
        detay: orphanRez.length ? { rezerveIds: orphanRez.map((r: any) => r.id) } : undefined,
      })

      // 7. MRP durumu senkron (basit: tamam diyor ama rezerve yok)
      const mrpSenkronsuz = aktifOrders.filter((o: any) => o.mrp_durum === 'tamam' && !rezs.some((r: any) => r.order_id === o.id))
      kontroller.push({
        no: 7, ad: 'MRP durumu senkron',
        durum: mrpSenkronsuz.length ? 'warn' : 'pass',
        mesaj: mrpSenkronsuz.length ? `${mrpSenkronsuz.length} sipariş "MRP tamam" işaretli ama rezervesi yok` : `${aktifOrders.length} aktif sipariş MRP durumu uyumlu`,
        neden: mrpSenkronsuz.length ? 'mrp_durum alanı eski veri migrasyonundan kalma veya senkron hatası.' : undefined,
        aksiyon: mrpSenkronsuz.length ? 'Siparişler sayfasında "Toplu MRP" çalıştırın.' : undefined,
        detay: mrpSenkronsuz.length ? { siparisler: mrpSenkronsuz.map((o: any) => ({ id: o.id, no: o.siparis_no })) } : undefined,
      })

      // 8. Malzeme kartı tutarlılığı (kart duplicate + hareketlerde kart kodu varyasyonu)
      // Alt-A: Kart duplicate (aynı normalize kod birden fazla kartla)
      const matGroup: Record<string, any[]> = {}
      mats.forEach((m: any) => {
        const norm = (m.kod || '').trim().toLocaleUpperCase('tr-TR')
        if (!norm) return
        if (!matGroup[norm]) matGroup[norm] = []
        matGroup[norm].push(m)
      })
      const dupPairler = Object.entries(matGroup).filter(([, arr]) => arr.length > 1)

      // Alt-B: Hareket/BOM/reçete/İE/kesim'de kart ile yazım farkı olan malkod
      // (normalize ile kart'la eşleşiyor ama ham string uyuşmuyor → tutarsızlık)
      const normKartMap = new Map<string, { kod: string; ad: string }>()
      mats.forEach((m: any) => {
        const norm = (m.kod || '').trim().toLocaleUpperCase('tr-TR')
        if (!norm) return
        if (!normKartMap.has(norm)) normKartMap.set(norm, { kod: m.kod, ad: m.ad })
      })
      const isVar = (raw: string | null | undefined) => {
        if (!raw) return false
        const norm = raw.trim().toLocaleUpperCase('tr-TR')
        const k = normKartMap.get(norm)
        return !!k && k.kod !== raw
      }
      const vStok = stoks.filter((h: any) => isVar(h.malkod)).length
      let vBom = 0
      boms.forEach((bt: any) => {
        (bt.rows || []).forEach((r: any) => { if (isVar(r.malkod)) vBom++ })
        if (isVar(bt.mamul_kod)) vBom++
      })
      let vRc = 0
      recs.forEach((rc: any) => {
        (rc.satirlar || []).forEach((r: any) => { if (isVar(r.malkod)) vRc++ })
        if (isVar(rc.mamul_kod)) vRc++
      })
      let vWo = 0
      wos.forEach((w: any) => {
        if (isVar(w.malkod)) vWo++
        if (isVar(w.mamul_kod)) vWo++
        ;(w.hm || []).forEach((h: any) => { if (isVar(h.malkod)) vWo++ })
      })
      let vKes = 0
      plans.forEach((p: any) => {
        if (isVar(p.ham_malkod)) vKes++
        ;(p.satirlar || []).forEach((s: any) => {
          (s.kesimler || []).forEach((k: any) => { if (isVar(k.malkod)) vKes++ })
        })
      })
      const vTed = teds.filter((t: any) => isVar(t.malkod)).length
      const vTotal = vStok + vBom + vRc + vWo + vKes + vTed
      const hasIssue = dupPairler.length > 0 || vTotal > 0

      kontroller.push({
        no: 8, ad: 'Malzeme kartı tutarlılığı',
        durum: hasIssue ? 'warn' : 'pass',
        mesaj: hasIssue
          ? [
              dupPairler.length ? `${dupPairler.length} duplicate kart` : '',
              vTotal ? `${vTotal} kayıtta kart kodu yazım tutarsızlığı (stok:${vStok} · BOM:${vBom} · reçete:${vRc} · İE:${vWo} · kesim:${vKes} · tedarik:${vTed})` : '',
            ].filter(Boolean).join(' · ')
          : `${mats.length} malzeme kartı tekil · tüm kayıtlar kart koduyla eşleşiyor`,
        neden: hasIssue
          ? dupPairler.length && vTotal
            ? 'Aynı malzeme küçük/büyük harfli olarak iki kez oluşturulmuş ve bazı hareketler kart kodundan farklı yazımla kaydedilmiş.'
            : dupPairler.length
              ? 'Aynı malzeme küçük/büyük harfli olarak iki kez oluşturulmuş.'
              : 'Bazı hareket/BOM/reçete kayıtlarında malkod yazımı kart kodundan farklı (ör. "BORU mm" vs kart "BORU MM"). Depolar sayfası bunları ayrı kalem gibi gösterir.'
          : undefined,
        aksiyon: hasIssue ? 'Otomatik Düzelt — duplicate kartlar birleştirilir, tüm kayıtlardaki malkod kart koduna eşitlenir.' : undefined,
        autoFixEtiket: hasIssue ? (dupPairler.length && vTotal ? 'Kart + kayıtları birleştir' : dupPairler.length ? 'Duplicate kartları birleştir' : 'Kayıt malkod yazımını kart koduyla eşitle') : undefined,
        autoFix: hasIssue ? async () => {
          const [{ data: bomFresh }, { data: rcFresh }, { data: woFresh }, { data: stokFresh }, { data: kesimFresh }, { data: tedFresh }] = await Promise.all([
            supabase.from('uys_bom_trees').select('*'),
            supabase.from('uys_recipes').select('*'),
            supabase.from('uys_work_orders').select('*'),
            supabase.from('uys_stok_hareketler').select('*'),
            supabase.from('uys_kesim_planlari').select('*'),
            supabase.from('uys_tedarikler').select('*'),
          ])
          let merged = 0, updBom = 0, updRc = 0, updWo = 0, updStok = 0, updKesim = 0, updTed = 0
          // === Faz 1: Duplicate kartları birleştir (mevcut mantık) ===
          for (const [normKod, arr] of dupPairler) {
            const sorted = [...arr].sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''))
            const keep = sorted[0]
            const dels = sorted.slice(1)
            const newKod = (keep.kod || '').toLocaleUpperCase('tr-TR').trim()
            const newAd = (keep.ad || '').toLocaleUpperCase('tr-TR')
            if (newKod !== keep.kod || newAd !== keep.ad) {
              await supabase.from('uys_malzemeler').update({ kod: newKod, ad: newAd }).eq('id', keep.id)
            }
            const kodMatch = (k: string | null | undefined) => (k || '').toLocaleUpperCase('tr-TR').trim() === normKod
            const upAd = (a: string | null | undefined) => (a || '').toLocaleUpperCase('tr-TR')
            for (const bt of (bomFresh || [])) {
              let changed = false
              const newRows = (bt.rows || []).map((r: any) => {
                if (kodMatch(r.malkod)) { changed = true; return { ...r, malkod: newKod, malad: upAd(r.malad) } }
                return r
              })
              const upd: Record<string, unknown> = {}
              if (changed) upd.rows = newRows
              if (kodMatch(bt.mamul_kod)) { upd.mamul_kod = newKod; upd.mamul_ad = upAd(bt.mamul_ad); upd.ad = upAd(bt.ad) }
              if (Object.keys(upd).length > 0) { await supabase.from('uys_bom_trees').update(upd).eq('id', bt.id); updBom++ }
            }
            for (const rc of (rcFresh || [])) {
              let changed = false
              const newSat = (rc.satirlar || []).map((r: any) => {
                if (kodMatch(r.malkod)) { changed = true; return { ...r, malkod: newKod, malad: upAd(r.malad) } }
                return r
              })
              const upd: Record<string, unknown> = {}
              if (changed) upd.satirlar = newSat
              if (kodMatch(rc.mamul_kod)) { upd.mamul_kod = newKod; upd.mamul_ad = upAd(rc.mamul_ad); upd.ad = upAd(rc.ad) }
              if (Object.keys(upd).length > 0) { await supabase.from('uys_recipes').update(upd).eq('id', rc.id); updRc++ }
            }
            for (const wo of (woFresh || [])) {
              const upd: Record<string, unknown> = {}
              if (kodMatch(wo.malkod)) { upd.malkod = newKod; upd.malad = upAd(wo.malad) }
              if (kodMatch(wo.mamul_kod)) { upd.mamul_kod = newKod; upd.mamul_ad = upAd(wo.mamul_ad) }
              const hmOld = wo.hm || []
              const hmNew = hmOld.map((h: any) => kodMatch(h.malkod) ? { ...h, malkod: newKod, malad: upAd(h.malad) } : h)
              if (JSON.stringify(hmOld) !== JSON.stringify(hmNew)) upd.hm = hmNew
              if (Object.keys(upd).length > 0) { await supabase.from('uys_work_orders').update(upd).eq('id', wo.id); updWo++ }
            }
            for (const h of (stokFresh || [])) {
              if (kodMatch(h.malkod)) {
                await supabase.from('uys_stok_hareketler').update({ malkod: newKod, malad: upAd(h.malad) }).eq('id', h.id)
                updStok++
              }
            }
            for (const p of (kesimFresh || [])) {
              let changed = false
              const newSat = (p.satirlar || []).map((s: any) => {
                const newKes = (s.kesimler || []).map((k: any) => {
                  if (kodMatch(k.malkod)) { changed = true; return { ...k, malkod: newKod, malad: upAd(k.malad) } }
                  return k
                })
                return { ...s, kesimler: newKes }
              })
              if (changed) { await supabase.from('uys_kesim_planlari').update({ satirlar: newSat }).eq('id', p.id); updKesim++ }
            }
            // Tedarikler (malkod kolon)
            for (const t of (tedFresh || [])) {
              if (kodMatch(t.malkod)) {
                await supabase.from('uys_tedarikler').update({ malkod: newKod, malad: upAd(t.malad) }).eq('id', t.id)
                updTed++
              }
            }
            for (const d of dels) {
              await supabase.from('uys_malzemeler').delete().eq('id', d.id)
              merged++
            }
          }

          // === Faz 2: Kart varyasyonlarını kart koduyla eşitle (yeni) ===
          // Mats'i tazeleyelim (Faz 1 sonrası kart kodları değişmiş olabilir)
          const { data: matsAfter } = await supabase.from('uys_malzemeler').select('*')
          const normMap2 = new Map<string, { kod: string; ad: string }>()
          ;(matsAfter || []).forEach((m: any) => {
            const norm = (m.kod || '').trim().toLocaleUpperCase('tr-TR')
            if (!norm) return
            if (!normMap2.has(norm)) normMap2.set(norm, { kod: m.kod, ad: m.ad })
          })
          const canonFor = (raw: string | null | undefined) => {
            if (!raw) return null
            const norm = raw.trim().toLocaleUpperCase('tr-TR')
            const k = normMap2.get(norm)
            return (k && k.kod !== raw) ? k : null
          }
          let varStok = 0, varBom = 0, varRc = 0, varWo = 0, varKes = 0, varTed = 0
          // Faz 2 için yeniden fetch (Faz 1'den sonra state değişti)
          const [{ data: bomF2 }, { data: rcF2 }, { data: woF2 }, { data: stokF2 }, { data: kesF2 }, { data: tedF2 }] = await Promise.all([
            supabase.from('uys_bom_trees').select('*'),
            supabase.from('uys_recipes').select('*'),
            supabase.from('uys_work_orders').select('*'),
            supabase.from('uys_stok_hareketler').select('*'),
            supabase.from('uys_kesim_planlari').select('*'),
            supabase.from('uys_tedarikler').select('*'),
          ])
          // Stok hareketleri
          for (const h of (stokF2 || [])) {
            const c = canonFor(h.malkod)
            if (c) {
              await supabase.from('uys_stok_hareketler').update({ malkod: c.kod, malad: c.ad }).eq('id', h.id)
              varStok++
            }
          }
          // BOM — mamul_kod + rows[].malkod
          for (const bt of (bomF2 || [])) {
            let changed = false
            const newRows = (bt.rows || []).map((r: any) => {
              const c = canonFor(r.malkod)
              if (c) { changed = true; return { ...r, malkod: c.kod, malad: c.ad } }
              return r
            })
            const upd: Record<string, unknown> = {}
            if (changed) upd.rows = newRows
            const mc = canonFor(bt.mamul_kod)
            if (mc) { upd.mamul_kod = mc.kod; upd.mamul_ad = mc.ad; changed = true }
            if (Object.keys(upd).length > 0) { await supabase.from('uys_bom_trees').update(upd).eq('id', bt.id); varBom++ }
          }
          // Recipe — mamul_kod + satirlar[].malkod
          for (const rc of (rcF2 || [])) {
            let changed = false
            const newSat = (rc.satirlar || []).map((r: any) => {
              const c = canonFor(r.malkod)
              if (c) { changed = true; return { ...r, malkod: c.kod, malad: c.ad } }
              return r
            })
            const upd: Record<string, unknown> = {}
            if (changed) upd.satirlar = newSat
            const mc = canonFor(rc.mamul_kod)
            if (mc) { upd.mamul_kod = mc.kod; upd.mamul_ad = mc.ad; changed = true }
            if (Object.keys(upd).length > 0) { await supabase.from('uys_recipes').update(upd).eq('id', rc.id); varRc++ }
          }
          // İş emri — malkod, mamul_kod, hm[].malkod
          for (const wo of (woF2 || [])) {
            const upd: Record<string, unknown> = {}
            const cM = canonFor(wo.malkod)
            if (cM) { upd.malkod = cM.kod; upd.malad = cM.ad }
            const cMM = canonFor(wo.mamul_kod)
            if (cMM) { upd.mamul_kod = cMM.kod; upd.mamul_ad = cMM.ad }
            const hmOld = wo.hm || []
            let hmChanged = false
            const hmNew = hmOld.map((h: any) => {
              const c = canonFor(h.malkod)
              if (c) { hmChanged = true; return { ...h, malkod: c.kod, malad: c.ad } }
              return h
            })
            if (hmChanged) upd.hm = hmNew
            if (Object.keys(upd).length > 0) { await supabase.from('uys_work_orders').update(upd).eq('id', wo.id); varWo++ }
          }
          // Kesim planları — ham_malkod + satirlar[].kesimler[].malkod
          for (const p of (kesF2 || [])) {
            const upd: Record<string, unknown> = {}
            const cH = canonFor(p.ham_malkod)
            if (cH) { upd.ham_malkod = cH.kod; upd.ham_malad = cH.ad }
            let satChanged = false
            const newSat = (p.satirlar || []).map((s: any) => {
              const newKes = (s.kesimler || []).map((k: any) => {
                const c = canonFor(k.malkod)
                if (c) { satChanged = true; return { ...k, malkod: c.kod, malad: c.ad } }
                return k
              })
              return { ...s, kesimler: newKes }
            })
            if (satChanged) upd.satirlar = newSat
            if (Object.keys(upd).length > 0) { await supabase.from('uys_kesim_planlari').update(upd).eq('id', p.id); varKes++ }
          }
          // Tedarikler — malkod
          for (const t of (tedF2 || [])) {
            const c = canonFor(t.malkod)
            if (c) {
              await supabase.from('uys_tedarikler').update({ malkod: c.kod, malad: c.ad }).eq('id', t.id)
              varTed++
            }
          }

          const fazlar = []
          if (merged > 0) fazlar.push(`${merged} kart birleşti`)
          if (updBom || varBom) fazlar.push(`${updBom + varBom} BOM`)
          if (updRc || varRc) fazlar.push(`${updRc + varRc} reçete`)
          if (updWo || varWo) fazlar.push(`${updWo + varWo} İE`)
          if (updStok || varStok) fazlar.push(`${updStok + varStok} stok`)
          if (updKesim || varKes) fazlar.push(`${updKesim + varKes} kesim`)
          if (updTed || varTed) fazlar.push(`${updTed + varTed} tedarik`)
          return fazlar.length ? fazlar.join(' · ') + ' güncellendi' : 'Değişiklik yok'
        } : undefined,
        detay: hasIssue ? {
          dupGruplar: dupPairler.map(([k, arr]) => ({ norm: k, sayim: arr.length })),
          varyasyonlar: vTotal > 0 ? { stok: vStok, bom: vBom, recete: vRc, ie: vWo, kesim: vKes, tedarik: vTed } : undefined,
        } : undefined,
      })

      // 9. Orphan log/fire/stok hareketi
      const orphanLog = logs.filter((l: any) => l.wo_id && !woIds.has(l.wo_id))
      const orphanFire = fires.filter((f: any) => (f.wo_id && !woIds.has(f.wo_id)) || (f.log_id && !logIds.has(f.log_id)))
      const orphanStok = stoks.filter((h: any) => (h.wo_id && !woIds.has(h.wo_id)) || (h.log_id && !logIds.has(h.log_id)))
      const toplamOrphan = orphanLog.length + orphanFire.length + orphanStok.length
      kontroller.push({
        no: 9, ad: 'Orphan log/fire/stok',
        durum: toplamOrphan ? 'warn' : 'pass',
        mesaj: toplamOrphan ? `${orphanLog.length} log · ${orphanFire.length} fire · ${orphanStok.length} stok hareketi silinmiş İE'ye bağlı` : `${logs.length + fires.length + stoks.length} kayıt temiz`,
        neden: toplamOrphan ? 'İE silindi ama bağlı kayıtlar kaldı.' : undefined,
        aksiyon: toplamOrphan ? 'Otomatik Düzelt — orphan kayıtları topluca sil.' : undefined,
        autoFixEtiket: toplamOrphan ? 'Orphan kayıtları sil' : undefined,
        autoFix: toplamOrphan ? async () => {
          if (orphanLog.length) { const ids = orphanLog.map((l: any) => l.id); for (let i = 0; i < ids.length; i += 50) await supabase.from('uys_logs').delete().in('id', ids.slice(i, i + 50)) }
          if (orphanFire.length) { const ids = orphanFire.map((f: any) => f.id); for (let i = 0; i < ids.length; i += 50) await supabase.from('uys_fire_logs').delete().in('id', ids.slice(i, i + 50)) }
          if (orphanStok.length) { const ids = orphanStok.map((h: any) => h.id); for (let i = 0; i < ids.length; i += 50) await supabase.from('uys_stok_hareketler').delete().in('id', ids.slice(i, i + 50)) }
          return `${toplamOrphan} kayıt silindi`
        } : undefined,
        detay: toplamOrphan ? { logSayim: orphanLog.length, fireSayim: orphanFire.length, stokSayim: orphanStok.length } : undefined,
      })

      // 10. BOM / Reçete eksik
      const recetesizAktif = aktifOrders.filter((o: any) => !(o.urunler || []).some((x: any) => x.rcId) && !o.recete_id)
      kontroller.push({
        no: 10, ad: 'BOM / Reçete eksik',
        durum: recetesizAktif.length ? 'warn' : 'pass',
        mesaj: recetesizAktif.length ? `${recetesizAktif.length} aktif sipariş reçetesiz` : `${aktifOrders.length - recetesizAktif.length} aktif sipariş reçeteli`,
        neden: recetesizAktif.length ? 'Bu siparişlerde MRP, kesim planı veya İE oluşturulamaz.' : undefined,
        aksiyon: recetesizAktif.length ? 'İlgili siparişleri açıp reçete atayın.' : undefined,
        detay: recetesizAktif.length ? { siparisler: recetesizAktif.map((o: any) => ({ id: o.id, no: o.siparis_no })) } : undefined,
      })
    } catch (e: any) {
      toast.error('Sağlık Raporu hatası: ' + e.message)
      console.error(e)
      setRunning(false)
      return
    }

    const ozet = {
      pass: kontroller.filter(k => k.durum === 'pass').length,
      warn: kontroller.filter(k => k.durum === 'warn').length,
      fail: kontroller.filter(k => k.durum === 'fail').length,
    }
    setReport({ timestamp: new Date().toISOString(), version: 'v15.25', ozet, kontroller })
    setRunning(false)
    if (ozet.fail || ozet.warn) toast.warning(`${ozet.fail} hata · ${ozet.warn} uyarı tespit edildi`)
    else toast.success('✓ Sistem tamamen sağlıklı')
  }

  async function autoFixCalistir(kontrolNo: number) {
    if (!report) return
    const k = report.kontroller.find(x => x.no === kontrolNo)
    if (!k?.autoFix) return
    setAutoFixing(kontrolNo)
    try {
      const sonuc = await k.autoFix()
      // autoFix string döner; "Hata:" ile başlıyorsa kırmızı toast
      if (sonuc.toLowerCase().startsWith('hata:')) {
        toast.error(`Kontrol #${kontrolNo}: ${sonuc}`)
      } else {
        toast.success(`Kontrol #${kontrolNo}: ${sonuc}`)
      }
      await loadAll()
      // Raporu yeniden çalıştır
      await saglikRaporuCalistir()
    } catch (e: any) {
      toast.error(`Kontrol #${kontrolNo}: ${e.message || 'bilinmeyen hata'}`)
    }
    setAutoFixing(null)
  }

  function kopyalaJSON() {
    if (!report) return
    const json = JSON.stringify({
      timestamp: report.timestamp,
      version: report.version,
      ozet: report.ozet,
      kontroller: report.kontroller.map(k => ({
        no: k.no, ad: k.ad, durum: k.durum, mesaj: k.mesaj,
        neden: k.neden, aksiyon: k.aksiyon, detay: k.detay,
      })),
    }, null, 2)
    navigator.clipboard.writeText(json).then(() => toast.success('JSON kopyalandı')).catch(() => toast.error('Kopyalama hatası'))
  }

  const tables = [
    { label: 'Siparişler', key: 'orders', table: 'uys_orders' },
    { label: 'İş Emirleri', key: 'workOrders', table: 'uys_work_orders' },
    { label: 'Üretim Logları', key: 'logs', table: 'uys_logs' },
    { label: 'Malzemeler', key: 'materials', table: 'uys_malzemeler' },
    { label: 'HM Tipleri', key: 'hmTipler', table: 'uys_hm_tipleri' },
    { label: 'Operasyonlar', key: 'operations', table: 'uys_operations' },
    { label: 'İstasyonlar', key: 'stations', table: 'uys_stations' },
    { label: 'Operatörler', key: 'operators', table: 'uys_operators' },
    { label: 'Reçeteler', key: 'recipes', table: 'uys_recipes' },
    { label: 'Ürün Ağaçları', key: 'bomTrees', table: 'uys_bom_trees' },
    { label: 'Stok Hareketleri', key: 'stokHareketler', table: 'uys_stok_hareketler' },
    { label: 'Kesim Planları', key: 'cuttingPlans', table: 'uys_kesim_planlari' },
    { label: 'Tedarikler', key: 'tedarikler', table: 'uys_tedarikler' },
    { label: 'MRP Rezerve', key: 'mrpRezerve', table: 'uys_mrp_rezerve' },
    { label: 'Açık Bar Havuzu', key: 'acikBarlar', table: 'uys_acik_barlar' },
    { label: 'Tedarikçiler', key: 'tedarikciler', table: 'uys_tedarikciler' },
    { label: 'Duruş Kodları', key: 'durusKodlari', table: 'uys_durus_kodlari' },
    { label: 'Müşteriler', key: 'customers', table: 'uys_customers' },
    { label: 'Sevkiyatlar', key: 'sevkler', table: 'uys_sevkler' },
    { label: 'Operatör Mesajları', key: 'operatorNotes', table: 'uys_operator_notes' },
    { label: 'Aktif Çalışmalar', key: 'activeWork', table: 'uys_active_work' },
    { label: 'Fire Logları', key: 'fireLogs', table: 'uys_fire_logs' },
    { label: 'Problem Takip', key: 'problemler', table: 'pt_problemler' },
    { label: 'İzinler', key: 'izinler', table: 'uys_izinler' },
    { label: 'Kullanıcılar', key: 'kullanicilar', table: 'uys_kullanicilar' },
    { label: 'Yetki Ayarları', key: 'yetkiAyarlari', table: 'uys_yetki_ayarlari' },
    { label: 'Ekip Notları', key: 'notes', table: 'uys_notes' },
    { label: 'Checklist/Görevler', key: 'checklist', table: 'uys_checklist' },
    { label: 'Chat Kanallar', key: 'chatChannels', table: 'uys_chat_channels' },
    { label: 'Chat Üyeler', key: 'chatMembers', table: 'uys_chat_members' },
    { label: 'Chat Mesajlar', key: 'chatMessages', table: 'uys_chat_messages' },
    { label: 'Chat Mentions', key: 'chatMentions', table: 'uys_chat_mentions' },
    { label: 'Chat Reactions', key: 'chatReactions', table: 'uys_chat_reactions' },
    { label: 'Chat Attachments', key: 'chatAttachments', table: 'uys_chat_attachments' },
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
  // camelCase → snake_case converter
  // Özel eşlemeler: 'not' → 'not_', icCap → 'ic_cap' gibi tüm kolonlar
  function camelToSnake(s: string): string {
    // 'not' özel — DB'de 'not_' (reserved keyword)
    if (s === 'not') return 'not_'
    // Özel eşlemeler — JSON alan adı DB kolon adıyla farklı olanlar
    const specialMap: Record<string, string> = {
      tedarikcId: 'tedarikci_id',
      tedarikcAd: 'tedarikci_ad',
    }
    if (specialMap[s]) return specialMap[s]
    return s.replace(/([A-Z])/g, '_$1').toLowerCase()
  }

  function convertRowToSnake(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      out[camelToSnake(key)] = row[key]
    }
    return out
  }

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
        const errors: string[] = []
        for (const t of tables) {
          const arr = data[t.key]
          if (Array.isArray(arr) && arr.length > 0) {
            // Tabloyu temizle ve yeniden yaz
            await supabase.from(t.table).delete().neq('id', '___impossible___')
            // camelCase alanları snake_case'e çevir
            const snakeArr = arr.map(r => convertRowToSnake(r as Record<string, unknown>))
            for (let i = 0; i < snakeArr.length; i += 100) {
              const { error } = await supabase.from(t.table).upsert(snakeArr.slice(i, i + 100), { onConflict: 'id' })
              if (error) {
                errors.push(`${t.table}: ${error.message}`)
                break
              }
            }
            restored++
          }
        }
        store.loadAll()
        if (errors.length > 0) {
          toast.error(`${restored} tablo yüklendi, ${errors.length} hata`)
          await showAlert(errors.join('\n'), 'Yükleme Hataları')
        } else {
          toast.success(`${restored} tablo geri yüklendi`)
        }
      } catch (err) {
        toast.error('JSON dosyası okunamadı: ' + (err as Error).message)
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
          {can('data_import') && <button onClick={importJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber/10 border border-amber/25 text-amber rounded-lg text-xs hover:bg-amber/20"><Upload size={13} /> JSON Geri Yükle</button>}
          {can('data_export') && <button onClick={() => {
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
          }} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white"><Download size={13} /> Excel Aktar</button>}
          {can('data_backup') && <button onClick={exportJSON} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold"><Download size={13} /> JSON Yedek</button>}
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

      {/* #24: Sağlık Raporu — Tek buton, 10 kontrol, JSON çıktı + otomatik düzeltmeler */}
      {can('data_syscheck') && <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">🩺 Sistem Sağlık Raporu</div>
            <div className="text-[10px] text-zinc-500 mt-1">10 kritik kontrol: sipariş–İE, reçete, kesim planı, tedarik, rezerve, duplicate malzeme, orphan kayıtlar.</div>
          </div>
          <button
            onClick={saglikRaporuCalistir}
            disabled={running}
            className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 text-white rounded-lg text-xs font-semibold">
            {running ? '⏳ Çalışıyor...' : report ? '🔄 Yeniden Çalıştır' : '🩺 Rapor Oluştur'}
          </button>
        </div>

        {report && (
          <div className="space-y-3">
            {/* Özet */}
            <div className="flex gap-2 text-xs">
              <div className="flex-1 px-3 py-2 bg-green/10 border border-green/25 rounded">
                <span className="font-semibold text-green">{report.ozet.pass}</span> <span className="text-zinc-500">temiz</span>
              </div>
              <div className="flex-1 px-3 py-2 bg-amber/10 border border-amber/25 rounded">
                <span className="font-semibold text-amber">{report.ozet.warn}</span> <span className="text-zinc-500">uyarı</span>
              </div>
              <div className="flex-1 px-3 py-2 bg-red/10 border border-red/25 rounded">
                <span className="font-semibold text-red">{report.ozet.fail}</span> <span className="text-zinc-500">hata</span>
              </div>
              <div className="px-3 py-2 bg-bg-3 border border-border rounded text-[10px] text-zinc-500 self-center">
                {new Date(report.timestamp).toLocaleString('tr-TR')}
              </div>
            </div>

            {/* Kontrol listesi */}
            <div className="space-y-2">
              {report.kontroller.map(k => {
                const durumStil = k.durum === 'pass' ? 'bg-green/5 border-green/20' : k.durum === 'warn' ? 'bg-amber/5 border-amber/30' : 'bg-red/5 border-red/30'
                const durumIcon = k.durum === 'pass' ? '✓' : k.durum === 'warn' ? '⚠' : '✗'
                const durumRenk = k.durum === 'pass' ? 'text-green' : k.durum === 'warn' ? 'text-amber' : 'text-red'
                return (
                  <div key={k.no} className={`border rounded-lg p-3 ${durumStil}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-bold ${durumRenk}`}>{durumIcon}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">#{k.no}</span>
                          <span className="text-xs font-semibold text-zinc-200">{k.ad}</span>
                        </div>
                        <div className="text-xs text-zinc-300 mt-1">{k.mesaj}</div>
                        {k.neden && <div className="text-[11px] text-zinc-500 mt-1"><span className="font-semibold">Neden: </span>{k.neden}</div>}
                        {k.aksiyon && <div className="text-[11px] text-zinc-400 mt-1"><span className="font-semibold">Aksiyon: </span>{k.aksiyon}</div>}
                      </div>
                      {k.autoFix && (
                        <button
                          onClick={() => autoFixCalistir(k.no)}
                          disabled={autoFixing === k.no || running}
                          className="shrink-0 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 disabled:opacity-50 border border-accent/40 text-accent text-[11px] rounded whitespace-nowrap">
                          {autoFixing === k.no ? '⏳' : '🔧'} {k.autoFixEtiket || 'Otomatik Düzelt'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* JSON çıktı kutusu */}
            <div className="mt-4 p-3 bg-bg-3 border border-border rounded">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">JSON Rapor (Claude'a paylaş)</span>
                <button onClick={kopyalaJSON} className="px-2 py-1 bg-accent/10 hover:bg-accent/20 border border-accent/25 text-accent text-[10px] rounded">
                  📋 Kopyala
                </button>
              </div>
              <pre className="text-[10px] text-zinc-400 font-mono overflow-x-auto max-h-60 whitespace-pre-wrap">
{JSON.stringify({ timestamp: report.timestamp, version: report.version, ozet: report.ozet, kontroller: report.kontroller.map(k => ({ no: k.no, ad: k.ad, durum: k.durum, mesaj: k.mesaj, neden: k.neden, aksiyon: k.aksiyon, detay: k.detay })) }, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {!report && !running && (
          <div className="text-xs text-zinc-500 italic">Sistemdeki tüm kritik akışları kontrol eder. Her hatalı kontrol için nedeni, önerilen aksiyonu ve mümkün olan yerlerde otomatik düzeltme butonu gösterir.</div>
        )}
      </div>}
      {can('data_test') && <div className="bg-bg-2 border border-border rounded-lg p-4 mb-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">🧪 Test Ortamı</div>
        <p className="text-xs text-zinc-500 mb-3">Açıldığında mevcut verilerin anlık görüntüsü kaydedilir. Test sırasında eklenen tüm veriler tek tuşla silinir.</p>
        <TestModuPanel />
      </div>}

      {/* Admin Şifre */}
      {can('data_pass') && <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
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
      </div>}

      {/* Kullanıcı Yönetimi — RBAC */}
      {can('data_pass') && <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">👥 Kullanıcı Yönetimi (RBAC)</div>
        <p className="text-xs text-zinc-500 mb-3">Sisteme giriş yapabilecek kullanıcıları ve rollerini yönetin.</p>
        <KullaniciPanel />
      </div>}

      {/* Yetki Matrisi — RBAC */}
      {can('data_pass') && <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">🔐 Yetki Matrisi</div>
        <p className="text-xs text-zinc-500 mb-3">Her rol için hangi işlemlere izin verildiğini düzenleyin. Admin her zaman tam yetkilidir.</p>
        <YetkiPanel />
      </div>}

      {/* Hammadde Tipleri */}
      {can('data_pass') && <div className="mt-6 bg-bg-2 border border-border rounded-lg p-4">
        <div className="text-sm font-semibold text-zinc-300 mb-2">🏷️ Hammadde Tipleri</div>
        <p className="text-xs text-zinc-500 mb-3">Malzeme kartlarında seçilebilecek hammadde tiplerini tanımlayın (BORU, PROFİL, LEVHA vb.)</p>
        <HmTipleriPanel />
      </div>}

      {/* #35: Sıfırlama İşlemleri — seçimli */}
      {can('data_reset') && <div className="mt-6 bg-red/5 border border-red/20 rounded-lg p-4">
        <div className="text-sm font-semibold text-red mb-3">⚠ Sıfırlama İşlemleri — Silinecek kalemleri seçin</div>
        <SifirlamaSecimli />
      </div>}
    </div>
  )
}

function SifirlamaSecimli() {
  const store = useStore()
  const { loadAll } = store
  const [siliniyor, setSiliniyor] = useState(false)
  const [acik, setAcik] = useState<string | null>(null)
  // Her tablo için seçili ID'ler
  const [seciliIds, setSeciliIds] = useState<Record<string, Set<string>>>({})

  function getItems(key: string): { id: string; label: string }[] {
    switch (key) {
      case 'orders': return store.orders.map(o => ({ id: o.id, label: `${o.siparisNo} — ${o.musteri || ''} (${o.adet} adet)` }))
      case 'workOrders': return store.workOrders.map(w => ({ id: w.id, label: `${w.ieNo} — ${w.malad?.slice(0, 40)}` }))
      case 'logs': return store.logs.map(l => ({ id: l.id, label: `${l.tarih} · +${l.qty} · ${(store.workOrders.find(w => w.id === l.woId)?.ieNo || l.woId).slice(0, 20)}` }))
      case 'fireLogs': return store.fireLogs.map(f => ({ id: f.id, label: `${f.tarih} · ${f.qty} fire` }))
      case 'stokHareketler': return store.stokHareketler.slice(0, 200).map(h => ({ id: h.id, label: `${h.tarih} · ${h.tip} · ${h.malkod?.slice(0, 20)} · ${h.miktar}` }))
      case 'tedarikler': return store.tedarikler.map(t => ({ id: t.id, label: `${t.malkod?.slice(0, 20)} — ${t.miktar} ${t.geldi ? '✓' : '⏳'}` }))
      case 'cuttingPlans': return store.cuttingPlans.map(p => ({ id: p.id, label: `${p.hamMalkod} · ${p.hamBoy}mm · ${p.durum}` }))
      case 'sevkler': return store.sevkler.map(s => ({ id: s.id, label: `${(s as any).tarih || ''} · ${(s as any).musteri || ''}` }))
      case 'operatorNotes': return store.operatorNotes.map(n => ({ id: n.id, label: `${n.opAd} · ${n.tarih} · ${n.mesaj?.slice(0, 30)}` }))
      case 'activeWork': return store.activeWork.map(a => ({ id: a.id, label: `${a.opAd} · ${a.woAd?.slice(0, 30)}` }))
      default: return []
    }
  }

  function toggleId(tablo: string, id: string) {
    setSeciliIds(prev => {
      const n = { ...prev }; if (!n[tablo]) n[tablo] = new Set()
      const s = new Set(n[tablo]); s.has(id) ? s.delete(id) : s.add(id); n[tablo] = s; return n
    })
  }
  function selectAll(tablo: string) {
    const items = getItems(tablo)
    setSeciliIds(prev => ({ ...prev, [tablo]: new Set(items.map(i => i.id)) }))
  }
  function selectNone(tablo: string) {
    setSeciliIds(prev => ({ ...prev, [tablo]: new Set() }))
  }

  const toplamSecili = Object.values(seciliIds).reduce((a, s) => a + s.size, 0)

  const kategoriler = [
    { key: 'orders', ad: '📋 Siparişler', tablo: 'uys_orders', sayi: store.orders.length, tehlikeli: false },
    { key: 'workOrders', ad: '🔧 İş Emirleri', tablo: 'uys_work_orders', sayi: store.workOrders.length, tehlikeli: false },
    { key: 'logs', ad: '📝 Üretim Logları', tablo: 'uys_logs', sayi: store.logs.length, tehlikeli: false },
    { key: 'fireLogs', ad: '🔥 Fire Logları', tablo: 'uys_fire_logs', sayi: store.fireLogs.length, tehlikeli: false },
    { key: 'stokHareketler', ad: '📦 Stok Hareketleri', tablo: 'uys_stok_hareketler', sayi: store.stokHareketler.length, tehlikeli: false },
    { key: 'tedarikler', ad: '🚚 Tedarikler', tablo: 'uys_tedarikler', sayi: store.tedarikler.length, tehlikeli: false },
    { key: 'mrpRezerve', ad: '📌 MRP Rezerve', tablo: 'uys_mrp_rezerve', sayi: store.mrpRezerve.length, tehlikeli: false },
    { key: 'cuttingPlans', ad: '✂ Kesim Planları', tablo: 'uys_kesim_planlari', sayi: store.cuttingPlans.length, tehlikeli: false },
    { key: 'sevkler', ad: '🚛 Sevkiyatlar', tablo: 'uys_sevkler', sayi: store.sevkler.length, tehlikeli: false },
    { key: 'operatorNotes', ad: '💬 Mesajlar', tablo: 'uys_operator_notes', sayi: store.operatorNotes.length, tehlikeli: false },
    { key: 'activeWork', ad: '▶ Aktif Çalışmalar', tablo: 'uys_active_work', sayi: store.activeWork.length, tehlikeli: false },
  ]

  async function sil() {
    if (toplamSecili === 0) { toast.error('Silinecek kayıt seçin'); return }
    if (!await showConfirm(`${toplamSecili} kayıt silinecek. Bağlı kayıtlar da otomatik silinecek. Devam?`)) return
    setSiliniyor(true)
    let deleted = 0
    // Bağımlı tablolar önce, ana tablolar sonra silinecek şekilde sırala
    const silmeSirasi = ['activeWork', 'operatorNotes', 'fireLogs', 'stokHareketler', 'logs', 'sevkler', 'tedarikler', 'cuttingPlans', 'workOrders', 'orders']
    const sortedEntries = Object.entries(seciliIds).sort(
      (a, b) => silmeSirasi.indexOf(a[0]) - silmeSirasi.indexOf(b[0])
    )
    for (const [key, ids] of sortedEntries) {
      if (!ids.size) continue
      const kat = kategoriler.find(k => k.key === key)
      if (!kat) continue
      for (const id of ids) {
        // Cascade — bağlı tabloları önce sil
        if (key === 'logs') {
          await supabase.from('uys_stok_hareketler').delete().eq('log_id', id)
          await supabase.from('uys_fire_logs').delete().eq('log_id', id)
        } else if (key === 'workOrders') {
          await supabase.from('uys_logs').delete().eq('wo_id', id)
          await supabase.from('uys_stok_hareketler').delete().eq('wo_id', id)
          await supabase.from('uys_fire_logs').delete().eq('wo_id', id)
          await supabase.from('uys_active_work').delete().eq('wo_id', id)
        } else if (key === 'orders') {
          // Önce bu siparişin iş emirlerini bul ve onların cascade'ini çalıştır
          const woRows = store.workOrders.filter(w => w.orderId === id)
          for (const w of woRows) {
            await supabase.from('uys_logs').delete().eq('wo_id', w.id)
            await supabase.from('uys_stok_hareketler').delete().eq('wo_id', w.id)
            await supabase.from('uys_fire_logs').delete().eq('wo_id', w.id)
            await supabase.from('uys_active_work').delete().eq('wo_id', w.id)
          }
          await supabase.from('uys_work_orders').delete().eq('order_id', id)
        } else if (key === 'fireLogs') {
          // Fire silinince telafi İE'si varsa onu da işaretle/sil
          const fire = store.fireLogs.find(f => f.id === id)
          if (fire?.telafiWoId) {
            // Sadece telafi henüz üretilmediyse sil (logs yoksa)
            const telafiLogs = store.logs.filter(l => l.woId === fire.telafiWoId)
            if (telafiLogs.length === 0) {
              await supabase.from('uys_work_orders').delete().eq('id', fire.telafiWoId)
            }
          }
        }
        // Ana kaydı sil
        await supabase.from(kat.tablo).delete().eq('id', id)
      }
      deleted += ids.size
    }
    setSeciliIds({}); setSiliniyor(false); loadAll()
    toast.success(deleted + ' kayıt silindi (bağlılar dahil)')
  }

  return (
    <div>
      <div className="space-y-1.5 mb-4">
        {kategoriler.map(k => {
          const isOpen = acik === k.key
          const items = isOpen ? getItems(k.key) : []
          const seciliCount = seciliIds[k.key]?.size || 0
          return (
            <div key={k.key} className="border border-border/50 rounded-lg overflow-hidden">
              <div className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-3/30 ${seciliCount > 0 ? 'bg-red/5' : ''}`}
                onClick={() => setAcik(isOpen ? null : k.key)}>
                <span className="text-[10px] text-zinc-600">{isOpen ? '▼' : '▶'}</span>
                <span className="text-xs flex-1">{k.ad}</span>
                <span className="text-[10px] font-mono text-zinc-500">{k.sayi} kayıt</span>
                {seciliCount > 0 && <span className="text-[10px] font-bold text-red bg-red/10 px-1.5 py-0.5 rounded">{seciliCount} seçili</span>}
              </div>
              {isOpen && (
                <div className="border-t border-border/30 bg-bg-2/50 p-2">
                  <div className="flex gap-2 mb-2">
                    <button onClick={() => selectAll(k.key)} className="text-[10px] text-accent hover:text-white px-2 py-0.5 bg-bg-3 rounded">Tümünü Seç</button>
                    <button onClick={() => selectNone(k.key)} className="text-[10px] text-zinc-500 hover:text-white px-2 py-0.5 bg-bg-3 rounded">Temizle</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {items.length ? items.map(item => (
                      <label key={item.id} className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-[11px] ${seciliIds[k.key]?.has(item.id) ? 'bg-red/10 text-zinc-200' : 'text-zinc-400 hover:bg-bg-3/50'}`}>
                        <input type="checkbox" checked={seciliIds[k.key]?.has(item.id) || false} onChange={() => toggleId(k.key, item.id)} className="accent-red" />
                        <span className="truncate">{item.label}</span>
                      </label>
                    )) : <div className="text-[10px] text-zinc-600 text-center py-2">Kayıt yok</div>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button onClick={sil} disabled={toplamSecili === 0 || siliniyor} className="w-full px-4 py-2.5 bg-red/20 border border-red/30 text-red rounded-lg text-xs hover:bg-red/30 font-semibold disabled:opacity-30">
        {siliniyor ? 'Siliniyor...' : `🗑 Seçili ${toplamSecili} Kaydı Sil`}
      </button>
    </div>
  )
}

// ═══ TEST MODU — SNAPSHOT BAZLI TEMİZLİK ═══
const TEST_TABLES = [
  { key: 'orders', table: 'uys_orders', label: '📋 Siparişler' },
  { key: 'workOrders', table: 'uys_work_orders', label: '🔧 İş Emirleri' },
  { key: 'logs', table: 'uys_logs', label: '📝 Üretim Logları' },
  { key: 'fireLogs', table: 'uys_fire_logs', label: '🔥 Fire Logları' },
  { key: 'stokHareketler', table: 'uys_stok_hareketler', label: '📦 Stok Hareketleri' },
  { key: 'cuttingPlans', table: 'uys_kesim_planlari', label: '✂ Kesim Planları' },
  { key: 'tedarikler', table: 'uys_tedarikler', label: '🚚 Tedarikler' },
  { key: 'mrpRezerve', table: 'uys_mrp_rezerve', label: '📌 MRP Rezerve' },
  { key: 'sevkler', table: 'uys_sevkler', label: '🚛 Sevkiyatlar' },
  { key: 'operatorNotes', table: 'uys_operator_notes', label: '💬 Mesajlar' },
  { key: 'activeWork', table: 'uys_active_work', label: '▶ Aktif Çalışmalar' },
  { key: 'izinler', table: 'uys_izinler', label: '📅 İzinler' },
  { key: 'checklist', table: 'uys_checklist', label: '☑ Checklist' },
]

function TestModuPanel() {
  const store = useStore()
  const [siliniyor, setSiliniyor] = useState(false)
  const isTestMode = localStorage.getItem('uys_test_mode') === 'true'
  const snapshotRaw = localStorage.getItem('uys_test_snapshot')
  const snapshot: Record<string, string[]> | null = snapshotRaw ? JSON.parse(snapshotRaw) : null
  const snapshotTime = localStorage.getItem('uys_test_snapshot_time') || ''

  // Snapshot'taki ID'lerle karşılaştır → test sırasında eklenen kayıtları bul
  function getTestRecords(): { total: number; byTable: Record<string, string[]> } {
    if (!snapshot) return { total: 0, byTable: {} }
    const byTable: Record<string, string[]> = {}
    let total = 0
    for (const t of TEST_TABLES) {
      const arr = (store as unknown as Record<string, { id: string }[]>)[t.key] || []
      const snapIds = new Set(snapshot[t.key] || [])
      const newIds = arr.filter(r => !snapIds.has(r.id)).map(r => r.id)
      if (newIds.length) { byTable[t.key] = newIds; total += newIds.length }
    }
    return { total, byTable }
  }

  function startTestMode() {
    // Mevcut tüm ID'lerin snapshot'ını al
    const snap: Record<string, string[]> = {}
    for (const t of TEST_TABLES) {
      const arr = (store as unknown as Record<string, { id: string }[]>)[t.key] || []
      snap[t.key] = arr.map(r => r.id)
    }
    localStorage.setItem('uys_test_snapshot', JSON.stringify(snap))
    localStorage.setItem('uys_test_snapshot_time', new Date().toLocaleString('tr-TR'))
    localStorage.setItem('uys_test_mode', 'true')
    toast.success('Test modu açıldı — snapshot kaydedildi')
    window.location.reload()
  }

  function stopTestMode() {
    localStorage.setItem('uys_test_mode', 'false')
    toast.info('Test modu kapatıldı')
    window.location.reload()
  }

  async function deleteTestData() {
    // Store'u tazele (güncel ID'leri görmek için)
    await store.loadAll()
    // Kısa gecikme — store güncellensin
    await new Promise(r => setTimeout(r, 500))

    const { total, byTable } = getTestRecords()
    if (total === 0) { toast.info('Silinecek test verisi yok'); return }

    const detay = Object.entries(byTable).map(([key, ids]) => {
      const t = TEST_TABLES.find(x => x.key === key)
      return `${t?.label || key}: ${ids.length} kayıt`
    }).join('\n')

    if (!await showConfirm(`🧪 TEST VERİLERİNİ SİL\n\nSnapshot: ${snapshotTime}\nToplam: ${total} kayıt silinecek\n\n${detay}\n\nBu işlem geri alınamaz. Devam?`)) return

    setSiliniyor(true)
    let deleted = 0

    // Önce bağımlı tablolar, sonra ana tablolar
    const deleteOrder = ['activeWork', 'operatorNotes', 'izinler', 'checklist', 'fireLogs', 'stokHareketler', 'logs', 'sevkler', 'tedarikler', 'cuttingPlans', 'workOrders', 'orders']
    for (const key of deleteOrder) {
      const ids = byTable[key]
      if (!ids?.length) continue
      const t = TEST_TABLES.find(x => x.key === key)
      if (!t) continue

      // İlişkili cascade silme
      if (key === 'logs') {
        for (const id of ids) {
          await supabase.from('uys_stok_hareketler').delete().eq('log_id', id)
          await supabase.from('uys_fire_logs').delete().eq('log_id', id)
        }
      }
      if (key === 'workOrders') {
        for (const id of ids) {
          await supabase.from('uys_logs').delete().eq('wo_id', id)
          await supabase.from('uys_stok_hareketler').delete().eq('wo_id', id)
          await supabase.from('uys_fire_logs').delete().eq('wo_id', id)
          await supabase.from('uys_active_work').delete().eq('wo_id', id)
        }
      }
      if (key === 'orders') {
        for (const id of ids) {
          await supabase.from('uys_work_orders').delete().eq('order_id', id)
        }
      }

      // ID bazlı silme (50'şer batch)
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50)
        const { error } = await supabase.from(t.table).delete().in('id', batch)
        if (error) console.error(`Silme hatası [${t.table}]:`, error)
      }
      deleted += ids.length
    }

    // Temizlik
    localStorage.removeItem('uys_test_snapshot')
    localStorage.removeItem('uys_test_snapshot_time')
    localStorage.setItem('uys_test_mode', 'false')
    setSiliniyor(false)
    store.loadAll()
    toast.success(`✓ ${deleted} test kaydı silindi`)
    window.location.reload()
  }

  function clearSnapshot() {
    localStorage.removeItem('uys_test_snapshot')
    localStorage.removeItem('uys_test_snapshot_time')
    localStorage.setItem('uys_test_mode', 'false')
    toast.success('Snapshot temizlendi')
    window.location.reload()
  }

  const testRecords = snapshot ? getTestRecords() : { total: 0, byTable: {} }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {!isTestMode ? (
          <button onClick={startTestMode}
            className="px-4 py-2 bg-amber/15 border border-amber/30 text-amber rounded-lg text-xs hover:bg-amber/25 font-semibold">
            🧪 Test Modunu Aç
          </button>
        ) : (
          <button onClick={stopTestMode}
            className="px-4 py-2 bg-bg-3 border border-border text-zinc-400 rounded-lg text-xs hover:text-white">
            ⏸ Test Modunu Kapat
          </button>
        )}
        {snapshot && (
          <button onClick={deleteTestData} disabled={siliniyor || testRecords.total === 0}
            className="px-4 py-2 bg-red/15 border border-red/30 text-red rounded-lg text-xs hover:bg-red/25 font-semibold disabled:opacity-30">
            {siliniyor ? '⏳ Siliniyor...' : `🗑 Test Verilerini Sil (${testRecords.total})`}
          </button>
        )}
        {snapshot && !isTestMode && (
          <button onClick={clearSnapshot} className="text-[10px] text-zinc-600 hover:text-zinc-400 underline">Snapshot temizle</button>
        )}
      </div>

      {isTestMode && (
        <div className="p-2 bg-amber/5 border border-amber/20 rounded-lg mb-3">
          <div className="text-[11px] text-amber font-semibold">🧪 Test modundasınız</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Test sırasında eklediğiniz tüm veriler "Test Verilerini Sil" ile tek tuşla silinir.</div>
        </div>
      )}

      {snapshot && (
        <div className="p-2 bg-bg-1/50 border border-border/50 rounded-lg">
          <div className="text-[10px] text-zinc-500 mb-1">📷 Snapshot: {snapshotTime}</div>
          {testRecords.total > 0 ? (
            <div className="space-y-0.5">
              {Object.entries(testRecords.byTable).map(([key, ids]) => {
                const t = TEST_TABLES.find(x => x.key === key)
                return <div key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-400">{t?.label}</span>
                  <span className="font-mono text-red font-semibold">+{ids.length}</span>
                </div>
              })}
            </div>
          ) : (
            <div className="text-[10px] text-green">Test verisi yok — temiz ✓</div>
          )}
        </div>
      )}

      {!snapshot && !isTestMode && (
        <div className="text-[10px] text-zinc-600">Test modunu açtığınızda mevcut verilerin anlık görüntüsü kaydedilir. Test sırasında eklenen her şey sonra tek tuşla silinir.</div>
      )}
    </div>
  )
}

// ═══ KULLANICI YÖNETİMİ — RBAC ═══
const ROL_LABELS: Record<string, string> = { admin: 'Admin', uretim_sor: 'Üretim Sorumlusu', planlama: 'Planlama', depocu: 'Depocu' }
const ROL_COLORS: Record<string, string> = { admin: 'text-red', uretim_sor: 'text-amber', planlama: 'text-accent', depocu: 'text-green' }

function KullaniciPanel() {
  const { kullanicilar, loadAll } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [ad, setAd] = useState('')
  const [kullaniciAd, setKullaniciAd] = useState('')
  const [sifre, setSifre] = useState('')
  const [rol, setRol] = useState<string>('planlama')

  function openNew() { setEditItem(null); setAd(''); setKullaniciAd(''); setSifre(''); setRol('planlama'); setShowForm(true) }
  function openEdit(k: any) { setEditItem(k); setAd(k.ad); setKullaniciAd(k.kullaniciAd); setSifre(k.sifre); setRol(k.rol); setShowForm(true) }

  async function save() {
    if (!ad.trim() || !kullaniciAd.trim() || !sifre.trim()) { toast.error('Tüm alanlar zorunlu'); return }
    if (editItem) {
      await supabase.from('uys_kullanicilar').update({
        ad: ad.trim(), kullanici_ad: kullaniciAd.trim(), sifre: sifre.trim(), rol,
      }).eq('id', editItem.id)
      toast.success('Kullanıcı güncellendi')
    } else {
      // Aynı kullanıcı adı var mı kontrol
      const existing = kullanicilar.find(k => k.kullaniciAd === kullaniciAd.trim())
      if (existing) { toast.error('Bu kullanıcı adı zaten kullanılıyor'); return }
      await supabase.from('uys_kullanicilar').insert({
        id: uid(), ad: ad.trim(), kullanici_ad: kullaniciAd.trim(), sifre: sifre.trim(), rol, aktif: true,
      })
      toast.success('Kullanıcı eklendi')
    }
    setShowForm(false); loadAll()
  }

  async function toggleAktif(k: any) {
    await supabase.from('uys_kullanicilar').update({ aktif: !k.aktif }).eq('id', k.id)
    loadAll(); toast.success(k.ad + (k.aktif ? ' devre dışı bırakıldı' : ' aktifleştirildi'))
  }

  async function deleteUser(k: any) {
    if (!await showConfirm(`"${k.ad}" kullanıcısını silmek istediğinize emin misiniz?`)) return
    await supabase.from('uys_kullanicilar').delete().eq('id', k.id)
    loadAll(); toast.success('Kullanıcı silindi')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500">{kullanicilar.length} kullanıcı</span>
        <button onClick={openNew} className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">+ Yeni Kullanıcı</button>
      </div>

      {kullanicilar.length > 0 ? (
        <div className="space-y-1.5">
          {kullanicilar.map(k => (
            <div key={k.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${k.aktif ? 'bg-bg-1 border-border/50' : 'bg-bg-1/50 border-border/20 opacity-60'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-200">{k.ad}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ROL_COLORS[k.rol] || 'text-zinc-400'} bg-bg-3`}>{ROL_LABELS[k.rol] || k.rol}</span>
                  {!k.aktif && <span className="text-[9px] px-1 py-0.5 bg-red/10 text-red rounded">Pasif</span>}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">{k.kullaniciAd}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(k)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white">Düzenle</button>
                <button onClick={() => toggleAktif(k)} className={`px-2 py-0.5 bg-bg-3 rounded text-[10px] ${k.aktif ? 'text-amber hover:text-amber' : 'text-green hover:text-green'}`}>
                  {k.aktif ? 'Devre Dışı' : 'Aktifleştir'}
                </button>
                <button onClick={() => deleteUser(k)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-600 bg-bg-1 rounded-lg p-4 text-center">
          Henüz kullanıcı eklenmedi. Eski admin şifresi ile giriş çalışmaya devam eder.
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">{editItem ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Ad Soyad</label>
                <input value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: Ahmet Yılmaz"
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Kullanıcı Adı (giriş için)</label>
                <input value={kullaniciAd} onChange={e => setKullaniciAd(e.target.value)} placeholder="Örn: ahmet"
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Şifre</label>
                <input value={sifre} onChange={e => setSifre(e.target.value)} placeholder="Şifre"
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 block mb-0.5">Rol</label>
                <select value={rol} onChange={e => setRol(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-accent">
                  <option value="admin">Admin — Tam yetki</option>
                  <option value="uretim_sor">Üretim Sorumlusu — İE + üretim girişi</option>
                  <option value="planlama">Planlama — Sipariş, MRP, kesim, reçete</option>
                  <option value="depocu">Depocu — Stok, tedarik, sevkiyat</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
              <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
                {editItem ? 'Güncelle' : 'Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══ YETKİ MATRİSİ EDİTÖRÜ ═══
function YetkiPanel() {
  const { yetkiMap, loadAll } = useStore()
  const [localMap, setLocalMap] = useState<Record<string, AdminRole[]>>({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Başlangıçta DB veya varsayılanı yükle
  useEffect(() => {
    setLocalMap(yetkiMap && Object.keys(yetkiMap).length > 0 ? { ...yetkiMap } as Record<string, AdminRole[]> : { ...DEFAULTS })
  }, [yetkiMap])

  function isChecked(action: string, role: AdminRole): boolean {
    const arr = localMap[action]
    return arr ? arr.includes(role) : false
  }

  function toggle(action: string, role: AdminRole) {
    setLocalMap(prev => {
      const arr = prev[action] ? [...prev[action]] : []
      const idx = arr.indexOf(role)
      if (idx >= 0) arr.splice(idx, 1)
      else arr.push(role)
      return { ...prev, [action]: arr }
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await supabase.from('uys_yetki_ayarlari').upsert({
      id: 'rbac', data: localMap, updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    await loadAll()
    setSaving(false)
    setDirty(false)
    toast.success('Yetki matrisi kaydedildi')
  }

  async function resetToDefaults() {
    if (!await showConfirm('Tüm yetkileri varsayılana döndürmek istediğinize emin misiniz?')) return
    await supabase.from('uys_yetki_ayarlari').delete().eq('id', 'rbac')
    setLocalMap({ ...DEFAULTS })
    await loadAll()
    setDirty(false)
    toast.success('Varsayılan yetkiler yüklendi')
  }

  // Fark kontrolü — varsayılandan farklı mı?
  function isDiff(action: string, role: AdminRole): boolean {
    const def = (DEFAULTS[action] || []).includes(role)
    const cur = isChecked(action, role)
    return def !== cur
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-2 py-2 text-zinc-500 font-normal w-[180px]">Aksiyon</th>
              {ROLE_LIST.map(r => (
                <th key={r.key} className="text-center px-3 py-2 text-zinc-400 font-semibold min-w-[80px]">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTION_GROUPS.map(g => (
              <Fragment key={g.group}>
                <tr><td colSpan={4} className="px-2 pt-3 pb-1 text-[10px] font-bold text-accent uppercase tracking-wider">{g.group}</td></tr>
                {g.actions.map(a => (
                  <tr key={a.key} className="border-b border-border/15 hover:bg-bg-3/20">
                    <td className="px-2 py-1.5 text-zinc-300">{a.label}</td>
                    {ROLE_LIST.map(r => (
                      <td key={r.key} className="text-center px-3 py-1.5">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input type="checkbox" checked={isChecked(a.key, r.key)} onChange={() => toggle(a.key, r.key)}
                            className={`accent-accent w-3.5 h-3.5 ${isDiff(a.key, r.key) ? 'ring-2 ring-amber/50 ring-offset-1 ring-offset-bg-1' : ''}`} />
                        </label>
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <button onClick={resetToDefaults} className="px-3 py-1.5 bg-bg-3 text-zinc-500 rounded-lg text-xs hover:text-white">↺ Varsayılana Dön</button>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-[10px] text-amber">● Kaydedilmemiş değişiklik</span>}
          <button onClick={save} disabled={saving || !dirty} className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-xs font-semibold">
            {saving ? 'Kaydediliyor...' : '💾 Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══ HAMMADDE TİPLERİ PANELİ ═══
function HmTipleriPanel() {
  const { hmTipler, loadAll } = useStore()
  const [yeniKod, setYeniKod] = useState('')
  const [yeniAd, setYeniAd] = useState('')
  const [saving, setSaving] = useState(false)

  const sorted = [...hmTipler].sort((a, b) => a.sira - b.sira || a.kod.localeCompare(b.kod))

  async function ekle() {
    const kod = yeniKod.trim().toLocaleUpperCase('tr-TR')
    const ad = yeniAd.trim() || kod
    if (!kod) { toast.error('Kod zorunlu'); return }
    if (hmTipler.some(t => t.kod === kod)) { toast.error('Bu kod zaten var'); return }
    setSaving(true)
    const maxSira = Math.max(0, ...hmTipler.map(t => t.sira))
    await supabase.from('uys_hm_tipleri').insert({
      id: uid(), kod, ad, aciklama: '', sira: maxSira + 1, olusturma: today()
    })
    setYeniKod(''); setYeniAd(''); setSaving(false)
    loadAll(); toast.success(`${kod} eklendi`)
  }

  async function duzenle(t: { id: string; kod: string; ad: string }) {
    const yeniAd = await showPrompt('HM Tipi Adı', 'Görünen ad', t.ad)
    if (yeniAd == null) return
    await supabase.from('uys_hm_tipleri').update({ ad: yeniAd.trim() || t.kod }).eq('id', t.id)
    loadAll(); toast.success('Güncellendi')
  }

  async function sil(t: { id: string; kod: string }) {
    if (!await showConfirm(`"${t.kod}" HM tipini silmek istediğinize emin misiniz? Bu tipte malzemeler varsa bağlantı kalır ama seçim listesinden kaybolur.`)) return
    await supabase.from('uys_hm_tipleri').delete().eq('id', t.id)
    loadAll(); toast.success('Silindi')
  }

  async function yukari(t: { id: string; sira: number; kod: string }) {
    const prev = sorted.find(x => x.sira < t.sira)
    if (!prev) return
    await supabase.from('uys_hm_tipleri').update({ sira: prev.sira }).eq('id', t.id)
    await supabase.from('uys_hm_tipleri').update({ sira: t.sira }).eq('id', prev.id)
    loadAll()
  }

  async function asagi(t: { id: string; sira: number; kod: string }) {
    const next = [...sorted].reverse().find(x => x.sira > t.sira)
    if (!next) return
    await supabase.from('uys_hm_tipleri').update({ sira: next.sira }).eq('id', t.id)
    await supabase.from('uys_hm_tipleri').update({ sira: t.sira }).eq('id', next.id)
    loadAll()
  }

  return (
    <div>
      {/* Ekleme formu */}
      <div className="flex gap-2 mb-3">
        <input
          value={yeniKod}
          onChange={e => setYeniKod(e.target.value.toLocaleUpperCase('tr-TR'))}
          placeholder="KOD (örn: BORU)"
          className="flex-1 px-3 py-2 bg-bg-3 border border-border rounded text-xs text-zinc-200 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-accent"
        />
        <input
          value={yeniAd}
          onChange={e => setYeniAd(e.target.value)}
          placeholder="Görünen ad (örn: Boru)"
          className="flex-1 px-3 py-2 bg-bg-3 border border-border rounded text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
        />
        <button
          onClick={ekle}
          disabled={saving || !yeniKod.trim()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded text-xs font-semibold"
        >+ Ekle</button>
      </div>

      {/* Liste */}
      {sorted.length === 0 ? (
        <div className="text-center py-4 text-xs text-zinc-600">Henüz tanımlı HM tipi yok</div>
      ) : (
        <div className="bg-bg-3/30 border border-border/50 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] text-zinc-500 uppercase tracking-wider">
                <th className="text-left px-3 py-2 w-16">Sıra</th>
                <th className="text-left px-3 py-2 w-32">Kod</th>
                <th className="text-left px-3 py-2">Ad</th>
                <th className="text-right px-3 py-2 w-32">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.id} className="border-b border-border/30 hover:bg-bg-3/50">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-zinc-500 w-6">{t.sira}</span>
                      <button onClick={() => yukari(t)} disabled={i === 0} className="text-zinc-500 hover:text-accent disabled:opacity-20 text-[10px]">▲</button>
                      <button onClick={() => asagi(t)} disabled={i === sorted.length - 1} className="text-zinc-500 hover:text-accent disabled:opacity-20 text-[10px]">▼</button>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-accent font-semibold">{t.kod}</td>
                  <td className="px-3 py-2 text-zinc-300">{t.ad}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => duzenle(t)} className="px-2 py-0.5 bg-bg-3 text-zinc-400 rounded text-[10px] hover:text-white mr-1">✎ Düzenle</button>
                    <button onClick={() => sil(t)} className="px-2 py-0.5 bg-red/10 text-red rounded text-[10px] hover:bg-red/20">Sil</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-[10px] text-zinc-600">
        💡 Tipler sıralı görünür (yukarı/aşağı ile değiştir). Kod büyük harfe çevrilir. Aynı kod tekrar eklenemez.
      </div>
    </div>
  )
}
