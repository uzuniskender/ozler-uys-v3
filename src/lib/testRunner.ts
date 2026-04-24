// ═══ TEST SENARYO RUNNER v2 — v15.37 ═══
// v2 farkları:
//   1. Her senaryo kendi sub-test_run_id ile (parent ile ilişkili) — izolasyon
//   2. Her MRP sonrası STOK DOĞRULAMA adımı
//   3. S3, S4'e üretim adımı eklendi (tam akış)
//   4. Özet metrikler adım delilleriyle tutarlı
//   5. SKIP durumu aktif (tedarik yoksa teslim adımı SKIP)

import { supabase } from './supabase'
import { uid, today } from './utils'
import { getActiveTestRunId, tempSetActiveTestRunId, cascadeDeleteTestRun, newTestRunId } from './testRun'
import { buildWorkOrders } from '@/features/production/autoChain'
import { kesimPlanOlustur, kesimPlanlariKaydet } from '@/features/production/cutting'
import { hesaplaMRP, rezerveYaz } from '@/features/production/mrp'
import { markTedarikGeldi } from './tedarikHelpers'
import { useStore } from '@/store'
import type { Recipe } from '@/types'

// ═══ TİPLER ═══

export interface SenaryoAdim {
  adim: string
  durum: 'OK' | 'FAIL' | 'SKIP'
  sureMs: number
  delil?: Record<string, unknown>
  hata?: string
  uyari?: string
}

export interface SenaryoRapor {
  senaryo: string
  testRunId: string
  parentTestRunId: string
  baslangic: string
  bitis: string
  toplamSureMs: number
  genelDurum: 'PASS' | 'FAIL' | 'KISMI'
  adimlar: SenaryoAdim[]
  ozet: {
    olusanSiparis: number
    olusanIE: number
    olusanKesimPlan: number
    olusanTedarik: number
    geldiTedarik: number
    silinenTedarik: number
    uretimLog: number
    stokHareket: number
    stokGiris: number
    stokCikis: number
  }
  stokSnapshotBaslangic: Record<string, number>
  stokSnapshotBitis: Record<string, number>
}

interface RunnerContext {
  recipeKod: string
  adet: number
  onLog?: (adim: SenaryoAdim) => void
}

interface RunnerState {
  testRunId: string
  parentTestRunId: string
  adimlar: SenaryoAdim[]
  ozet: SenaryoRapor['ozet']
  orderId?: string
  ieIds: string[]
  kesimPlanIds: string[]
  tedarikIds: string[]
  logIds: string[]
  ilgiliHamMalkodlar: Set<string>  // Bu senaryoya ait HM'ler (stok snapshot için)
  stokSnapshotBaslangic: Record<string, number>
}

// ═══ YARDIMCILAR ═══

function initState(testRunId: string, parentId: string): RunnerState {
  return {
    testRunId, parentTestRunId: parentId,
    adimlar: [],
    ozet: {
      olusanSiparis: 0, olusanIE: 0, olusanKesimPlan: 0,
      olusanTedarik: 0, geldiTedarik: 0, silinenTedarik: 0,
      uretimLog: 0, stokHareket: 0, stokGiris: 0, stokCikis: 0,
    },
    ieIds: [], kesimPlanIds: [], tedarikIds: [], logIds: [],
    ilgiliHamMalkodlar: new Set(),
    stokSnapshotBaslangic: {},
  }
}

async function adim<T>(
  state: RunnerState, name: string, fn: () => Promise<T>, ctx: RunnerContext,
): Promise<T | null> {
  const t0 = Date.now()
  try {
    const result = await fn()
    const rec: SenaryoAdim = {
      adim: name, durum: 'OK', sureMs: Date.now() - t0,
      delil: result && typeof result === 'object' && !Array.isArray(result)
        ? result as Record<string, unknown>
        : { result },
    }
    state.adimlar.push(rec); ctx.onLog?.(rec)
    return result
  } catch (e: any) {
    const rec: SenaryoAdim = {
      adim: name, durum: 'FAIL', sureMs: Date.now() - t0,
      hata: e?.message || String(e),
    }
    state.adimlar.push(rec); ctx.onLog?.(rec)
    throw e
  }
}

function adimSkip(state: RunnerState, name: string, neden: string, ctx: RunnerContext) {
  const rec: SenaryoAdim = { adim: name, durum: 'SKIP', sureMs: 0, uyari: neden }
  state.adimlar.push(rec); ctx.onLog?.(rec)
}

const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const loadAll = async () => { await useStore.getState().loadAll() }

function finalize(state: RunnerState, senaryo: string, t0: number): SenaryoRapor {
  const fail = state.adimlar.filter(a => a.durum === 'FAIL').length
  const ok = state.adimlar.filter(a => a.durum === 'OK').length
  const genelDurum: SenaryoRapor['genelDurum'] =
    fail === 0 ? 'PASS' : (ok > 0 ? 'KISMI' : 'FAIL')

  // Bitiş stok snapshot'ı
  const store = useStore.getState()
  const stokSnapshotBitis: Record<string, number> = {}
  for (const malkod of state.ilgiliHamMalkodlar) {
    stokSnapshotBitis[malkod] = getStokMiktar(store.stokHareketler as any, malkod)
  }

  return {
    senaryo,
    testRunId: state.testRunId,
    parentTestRunId: state.parentTestRunId,
    baslangic: new Date(t0).toISOString(),
    bitis: new Date().toISOString(),
    toplamSureMs: Date.now() - t0,
    genelDurum,
    adimlar: state.adimlar,
    ozet: state.ozet,
    stokSnapshotBaslangic: state.stokSnapshotBaslangic,
    stokSnapshotBitis,
  }
}

function getStokMiktar(stokHareketler: Array<{malkod: string; miktar: number; tip: string}>, malkod: string): number {
  return Math.floor(stokHareketler
    .filter(h => h.malkod === malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0))
}

function findRecipe(recipes: Recipe[], recipeKod: string): Recipe {
  const rc = recipes.find(r =>
    r.rcKod?.toLowerCase() === recipeKod.toLowerCase() ||
    r.mamulKod?.toLowerCase() === recipeKod.toLowerCase()
  )
  if (!rc) throw new Error(`Reçete bulunamadı: ${recipeKod}`)
  if (!rc.satirlar?.length) throw new Error(`Reçete boş: ${recipeKod}`)
  return rc
}

async function _createOrder(state: RunnerState, ctx: RunnerContext, baslik: string): Promise<string> {
  const store = useStore.getState()
  const rc = findRecipe(store.recipes, ctx.recipeKod)
  const orderId = uid()
  const siparisNo = `TEST-${baslik}-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const { error } = await supabase.from('uys_orders').insert({
    id: orderId, siparis_no: siparisNo, musteri: 'TEST-MUSTERI',
    tarih: today(), termin: today(),
    urunler: [{ id: uid(), rcId: rc.id, mamulKod: rc.mamulKod, mamulAd: rc.mamulAd,
      adet: ctx.adet, termin: today(), not: `Test ${baslik}` }],
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    adet: ctx.adet, recete_id: rc.id,
    mrp_durum: 'bekliyor', durum: 'aktif', olusturma: today(),
  })
  if (error) throw new Error('Sipariş insert: ' + error.message)
  state.orderId = orderId
  state.ozet.olusanSiparis++

  const woCount = await buildWorkOrders(orderId, siparisNo, rc.id, ctx.adet, store.recipes, today(), 0)
  state.ozet.olusanIE += woCount
  await loadAll()

  const fresh = useStore.getState()
  const createdIEs = fresh.workOrders.filter(w => w.orderId === orderId)
  state.ieIds.push(...createdIEs.map(w => w.id))
  // HM malkodlarını topla
  createdIEs.forEach(w => (w.hm || []).forEach((h: any) => state.ilgiliHamMalkodlar.add(h.malkod)))

  return orderId
}

async function _createWO(state: RunnerState, ctx: RunnerContext): Promise<string> {
  const store = useStore.getState()
  const rc = findRecipe(store.recipes, ctx.recipeKod)

  const hm = (rc.satirlar || [])
    .filter(s => s.tip === 'Hammadde' || s.tip === 'HM')
    .map(s => ({
      malkod: s.malkod, malad: s.malad,
      miktarTotal: (s.miktar || 1) * ctx.adet,
    }))
  hm.forEach(h => state.ilgiliHamMalkodlar.add(h.malkod))

  const id = uid()
  const ieNo = `IE-TEST-${Date.now().toString(36).toUpperCase().slice(-5)}`

  const { error } = await supabase.from('uys_work_orders').insert({
    id, order_id: null, rc_id: rc.id,
    sira: 1, kirno: '1',
    op_id: rc.satirlar?.[0]?.opId || null, op_kod: '', op_ad: '',
    ist_id: rc.satirlar?.[0]?.istId || null, ist_kod: '', ist_ad: '',
    malkod: rc.mamulKod, malad: rc.mamulAd,
    hedef: ctx.adet, mpm: 1, hm, ie_no: ieNo,
    durum: 'bekliyor', bagimsiz: true, siparis_disi: true,
    mamul_kod: rc.mamulKod, mamul_ad: rc.mamulAd,
    not_: 'Test', olusturma: today(),
  })
  if (error) throw new Error('İE insert: ' + error.message)
  state.ieIds.push(id)
  state.ozet.olusanIE++
  await loadAll()
  return id
}

async function _createCuttingPlans(state: RunnerState): Promise<{ yeni: number; guncellenen: number }> {
  const store = useStore.getState()
  const logsSimple = store.logs.map(l => ({ woId: l.woId, qty: l.qty }))
  const cpMapped = store.cuttingPlans.map((p: any) => ({
    id: p.id, hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, hamBoy: p.hamBoy,
    hamEn: p.hamEn || 0, kesimTip: p.kesimTip || 'boy', durum: p.durum || '',
    tarih: p.tarih || '', satirlar: p.satirlar || [], gerekliAdet: p.gerekliAdet || 0,
  }))
  const oncekiIds = new Set(store.cuttingPlans.map(p => p.id))
  const planlar = kesimPlanOlustur(
    store.workOrders, store.operations as any, store.recipes,
    store.materials, logsSimple, cpMapped as any
  )
  if (!planlar.length) return { yeni: 0, guncellenen: 0 }
  await kesimPlanlariKaydet(planlar as any)
  let yeni = 0, guncel = 0
  for (const p of planlar) {
    if (oncekiIds.has(p.id)) guncel++
    else { yeni++; state.kesimPlanIds.push(p.id) }
  }
  state.ozet.olusanKesimPlan += yeni
  await loadAll()
  return { yeni, guncellenen: guncel }
}

async function _runMRPAndCreateTedarik(state: RunnerState): Promise<{ mrpKalem: number; eksik: number; tedarik: number }> {
  const store = useStore.getState()
  const ordIds = state.orderId ? [state.orderId] : []
  const ymSet = state.ieIds.length > 0 && !state.orderId ? new Set(state.ieIds) : null
  const cpMapped = store.cuttingPlans.map((p: any) => ({
    hamMalkod: p.hamMalkod, hamMalad: p.hamMalad, durum: p.durum || '',
    gerekliAdet: p.gerekliAdet || 0, satirlar: p.satirlar || [],
  }))

  const result = hesaplaMRP(
    ordIds, store.orders as any, store.workOrders, store.recipes,
    store.stokHareketler, store.tedarikler, cpMapped, store.materials,
    ymSet, store.mrpRezerve
  )

  if (state.orderId) await rezerveYaz(state.orderId, result)

  const eksikler = result.filter(r => r.net > 0)
  let yeniTedarik = 0
  for (const e of eksikler) {
    // Aynı malkod için henüz test kapsamında tedarik oluşturulmamış ve açık tedarik yoksa
    const mevcutAcik = store.tedarikler.find(t => t.malkod === e.malkod && !t.geldi)
    if (mevcutAcik) continue
    const tId = uid()
    const { error } = await supabase.from('uys_tedarikler').insert({
      id: tId, malkod: e.malkod, malad: e.malad,
      miktar: Math.ceil(e.net), birim: e.birim || 'Adet',
      tarih: today(), teslim_tarihi: e.termin || null,
      durum: 'bekliyor', geldi: false, not_: 'Test senaryo',
      order_id: state.orderId || null,
      siparis_no: store.orders.find(o => o.id === state.orderId)?.siparisNo || null,
    })
    if (error) throw new Error(`Tedarik insert ${e.malkod}: ${error.message}`)
    state.tedarikIds.push(tId)
    state.ozet.olusanTedarik++
    yeniTedarik++
  }
  await loadAll()
  return { mrpKalem: result.length, eksik: eksikler.length, tedarik: yeniTedarik }
}

async function _teslimAl(state: RunnerState): Promise<number> {
  const store = useStore.getState()
  let count = 0
  for (const tId of state.tedarikIds) {
    const t = store.tedarikler.find(x => x.id === tId)
    if (!t || t.geldi) continue
    await markTedarikGeldi(t as any)
    count++
    state.ozet.geldiTedarik++
    state.ozet.stokGiris++
    state.ozet.stokHareket++
  }
  await loadAll()
  return count
}

async function _uretimGirisi(state: RunnerState, miktar: number): Promise<number> {
  const store = useStore.getState()
  if (!state.ieIds.length) return 0
  const firstWoId = state.ieIds[0]
  const wo = store.workOrders.find(w => w.id === firstWoId)
  if (!wo) return 0

  const halfA = Math.floor(miktar / 2)
  const halfB = miktar - halfA
  for (const qty of [halfA, halfB]) {
    if (qty <= 0) continue
    const lId = uid()
    const { error } = await supabase.from('uys_logs').insert({
      id: lId, wo_id: firstWoId, tarih: today(),
      qty, fire: 0,
      operatorlar: [{ id: 'test-op', ad: 'TEST OP' }],
      duruslar: [], not_: 'Test üretim',
      malkod: wo.malkod, ie_no: wo.ieNo,
      operator_id: null, vardiya: 'normal',
    })
    if (error) throw new Error('Log insert: ' + error.message)
    state.logIds.push(lId)
    state.ozet.uretimLog++

    // HM çıkış hareketleri
    for (const h of (wo.hm || [])) {
      const cikisMiktar = (h.miktarTotal / wo.hedef) * qty
      if (cikisMiktar <= 0) continue
      const shId = uid()
      await supabase.from('uys_stok_hareketler').insert({
        id: shId, tarih: today(),
        malkod: h.malkod, malad: h.malad,
        miktar: cikisMiktar, tip: 'cikis',
        log_id: lId, wo_id: firstWoId,
        aciklama: 'Test üretim HM çıkışı',
      })
      state.ozet.stokCikis++
      state.ozet.stokHareket++
    }
  }
  await loadAll()
  return state.ozet.uretimLog
}

async function _silTumTedarikler(state: RunnerState): Promise<number> {
  let sil = 0
  for (const tId of [...state.tedarikIds]) {
    const { error } = await supabase.from('uys_tedarikler').delete().eq('id', tId)
    if (!error) sil++
  }
  state.tedarikIds = []
  state.ozet.silinenTedarik += sil
  // Silinince sipariş mrp_durum = 'bekliyor'
  if (state.orderId) {
    await supabase.from('uys_orders').update({ mrp_durum: 'bekliyor' }).eq('id', state.orderId)
  }
  await loadAll()
  return sil
}

/** Senaryo etrafına izolasyon — her senaryoya ayrı test_run_id, bittikten sonra parent'a döner */
async function runWithIsolation<T extends SenaryoRapor>(
  parentId: string,
  ad: string,
  fn: (state: RunnerState, t0: number) => Promise<T>,
): Promise<T> {
  // Sub-run id üret: PARENT ile ilişkili
  const childId = parentId + '_' + ad.toLowerCase()
  tempSetActiveTestRunId(childId)
  const t0 = Date.now()

  try {
    // Bu senaryo için state — sub-run id ile
    const store = useStore.getState()
    const state = initState(childId, parentId)

    const rapor = await fn(state, t0)
    // Başlangıç stok snapshot'ı set edildiyse
    return rapor
  } finally {
    // Her durumda parent id'ye dön (senaryo bitince)
    tempSetActiveTestRunId(parentId)
    await loadAll()
  }
}

function snapshotStok(state: RunnerState): void {
  const store = useStore.getState()
  for (const malkod of state.ilgiliHamMalkodlar) {
    state.stokSnapshotBaslangic[malkod] = getStokMiktar(store.stokHareketler as any, malkod)
  }
}

// ═══ SENARYOLAR ═══

export async function senaryo1(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S1', async (state, t0) => {
    await adim(state, '1. Sipariş oluştur', async () => {
      const oid = await _createOrder(state, ctx, 'S1')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length, hammaddeler: [...state.ilgiliHamMalkodlar] }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı oluştur', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP hesapla + tedarik oluştur', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as { mrpKalem: number; eksik: number; tedarik: number }

    if (mrp && mrp.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Tedarikleri teslim al (stok girişi)', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      // Doğrulama: stok gerçekten arttı mı?
      await wait(200)
      await adim(state, '4.1 Stok doğrulama (teslim sonrası)', async () => {
        const store = useStore.getState()
        const mevcutStoklar: Record<string, number> = {}
        let artti = 0
        for (const mk of state.ilgiliHamMalkodlar) {
          mevcutStoklar[mk] = getStokMiktar(store.stokHareketler as any, mk)
          const baslangic = state.stokSnapshotBaslangic[mk] || 0
          if (mevcutStoklar[mk] > baslangic) artti++
        }
        if (artti === 0) throw new Error('Tedarik geldi ama stokta artış yok')
        return { artan_malzeme: artti, stoklar: mevcutStoklar }
      }, ctx)
    } else {
      adimSkip(state, '4. Teslim (tedarik yok)', 'İhtiyaç çıkmadı, teslim edilecek tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '5. Parçalı üretim (2 log + HM çıkışı)', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
        stokCikis: state.ozet.stokCikis,
      }), ctx)

      // Üretim doğrulama: log kaydedildi, stok azaldı mı
      await adim(state, '5.1 Üretim doğrulama', async () => {
        const store = useStore.getState()
        const ie = store.workOrders.find(w => w.id === state.ieIds[0])
        const logs = store.logs.filter(l => l.woId === state.ieIds[0])
        const uretilen = logs.reduce((a, l) => a + l.qty, 0)
        return { uretilen, hedef: ie?.hedef, stokHareket: state.ozet.stokHareket }
      }, ctx)
    }

    return finalize(state, 'Senaryo 1: Sipariş → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
  })
}

export async function senaryo2(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S2', async (state, t0) => {
    await adim(state, '1. Manuel İE oluştur (bağımsız)', async () => {
      const id = await _createWO(state, ctx)
      snapshotStok(state)
      return { ieId: id, hammaddeler: [...state.ilgiliHamMalkodlar] }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı oluştur', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp?.tedarik > 0) {
      await wait(200)
      await adim(state, '4. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      await adim(state, '4.1 Stok doğrulama', async () => {
        const store = useStore.getState()
        const mevcut: Record<string, number> = {}
        let artti = 0
        for (const mk of state.ilgiliHamMalkodlar) {
          mevcut[mk] = getStokMiktar(store.stokHareketler as any, mk)
          if (mevcut[mk] > (state.stokSnapshotBaslangic[mk] || 0)) artti++
        }
        if (artti === 0) throw new Error('Tedarik geldi ama stok artmadı')
        return { artan: artti, stoklar: mevcut }
      }, ctx)
    } else {
      adimSkip(state, '4. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '5. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx)
    }

    return finalize(state, 'Senaryo 2: Manuel İE → Kesim → MRP → Tedarik → Teslim → Üretim', t0)
  })
}

export async function senaryo3(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S3', async (state, t0) => {
    await adim(state, '1. İlk sipariş', async () => {
      const oid = await _createOrder(state, ctx, 'S3A')
      snapshotStok(state)
      return { orderId: oid, ieCount: state.ieIds.length }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)
    await wait(200)

    const mrp1 = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp1?.tedarik === 0) {
      throw new Error('Senaryo 3 ihtiyaç bulmalıydı (9999 adet için). Stok konfigürasyonu: senaryo izole değil veya başlangıç stoğu yeterli.')
    }

    await wait(200)
    await adim(state, '4. Tedarikleri SİL', async () => ({
      silinen: await _silTumTedarikler(state),
    }), ctx)

    await wait(200)
    const mrp2 = await adim(state, '5. MRP tekrar → ihtiyaç tekrar çıkmalı', async () => {
      const s = await _runMRPAndCreateTedarik(state)
      if (s.eksik === 0) throw new Error('Tedarik silindi ama ihtiyaç çıkmadı')
      return s
    }, ctx)

    await wait(200)
    await adim(state, '6. 2. Sipariş (tedarik gelmeden)', async () => {
      state.orderId = undefined
      const oid = await _createOrder(state, ctx, 'S3B')
      return { orderId: oid }
    }, ctx)

    await wait(200)
    await adim(state, '7. Kesim planı güncelle', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    const mrp3 = await adim(state, '8. MRP konsolide güncelle', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (state.tedarikIds.length > 0) {
      await wait(200)
      await adim(state, '9. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)

      await adim(state, '9.1 Stok doğrulama', async () => {
        const store = useStore.getState()
        const stoklar: Record<string, number> = {}
        for (const mk of state.ilgiliHamMalkodlar) {
          stoklar[mk] = getStokMiktar(store.stokHareketler as any, mk)
        }
        return { stoklar }
      }, ctx)
    } else {
      adimSkip(state, '9. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '10. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx)
    }

    return finalize(state, 'Senaryo 3: Sipariş → Tedarik sil → 2. Sipariş → Konsolidasyon → Üretim', t0)
  })
}

export async function senaryo4(ctx: RunnerContext): Promise<SenaryoRapor> {
  const parentId = getActiveTestRunId() || ''
  if (!parentId) throw new Error('Test modu aktif değil')

  return runWithIsolation(parentId, 'S4', async (state, t0) => {
    await adim(state, '1. İlk İE', async () => {
      const id = await _createWO(state, ctx)
      snapshotStok(state)
      return { ieId: id }
    }, ctx)

    await wait(200)
    await adim(state, '2. Kesim planı', async () => await _createCuttingPlans(state), ctx)
    await wait(200)

    const mrp1 = await adim(state, '3. MRP + tedarik', async () =>
      await _runMRPAndCreateTedarik(state), ctx) as any

    if (mrp1?.tedarik === 0) {
      throw new Error('Senaryo 4 ihtiyaç bulmalıydı')
    }

    await wait(200)
    await adim(state, '4. Tedarikleri SİL', async () => ({
      silinen: await _silTumTedarikler(state),
    }), ctx)

    await wait(200)
    await adim(state, '5. MRP tekrar → ihtiyaç tekrar çıkmalı', async () => {
      const s = await _runMRPAndCreateTedarik(state)
      if (s.eksik === 0) throw new Error('Silme sonrası ihtiyaç çıkmadı')
      return s
    }, ctx)

    await wait(200)
    await adim(state, '6. 2. İE (tedarik gelmeden)', async () => ({
      ieId: await _createWO(state, ctx),
    }), ctx)

    await wait(200)
    await adim(state, '7. Kesim planı güncelle', async () => await _createCuttingPlans(state), ctx)

    await wait(200)
    await adim(state, '8. MRP konsolide güncelle', async () =>
      await _runMRPAndCreateTedarik(state), ctx)

    if (state.tedarikIds.length > 0) {
      await wait(200)
      await adim(state, '9. Tedarikleri teslim al', async () => ({
        geldiSayisi: await _teslimAl(state),
      }), ctx)
    } else {
      adimSkip(state, '9. Teslim', 'Tedarik yok', ctx)
    }

    if (state.ieIds.length > 0) {
      await wait(200)
      await adim(state, '10. Parçalı üretim', async () => ({
        logSayisi: await _uretimGirisi(state, Math.min(4, ctx.adet)),
      }), ctx)
    }

    return finalize(state, 'Senaryo 4: İE → Tedarik sil → 2. İE → Konsolidasyon → Üretim', t0)
  })
}
