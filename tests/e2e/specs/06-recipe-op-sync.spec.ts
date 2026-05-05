/**
 * v16.45 — TUR1-3F: Reçete satır UPDATE → İE op/ist/süre senkron trigger.
 *
 * DB-only davranış testi (frontend kod yok). Trigger PROD ve TEST'te aktif:
 * trg_recipe_op_sync (uys_recipes AFTER UPDATE OF satirlar).
 *
 * Saha vakası: 5 May 2026, YMH100346 reçete op_id 023→027 değişti,
 * IE-S26A_03150-15 (durum=bekliyor) eski 023'te kaldı. Bu test eksik halkanın
 * kapalı olduğunu doğrular.
 */
import { test, expect } from '../fixtures'
import { supabaseAdmin } from '../helpers/supabase'

const PREFIX = 'TEST-E2E-TRG-'

async function cleanup() {
  await supabaseAdmin.from('uys_work_orders').delete().ilike('id', `${PREFIX}%`)
  await supabaseAdmin.from('uys_recipes').delete().ilike('id', `${PREFIX}%`)
  await supabaseAdmin.from('uys_operations').delete().ilike('id', `${PREFIX}%`)
  await supabaseAdmin.from('uys_stations').delete().ilike('id', `${PREFIX}%`)
}

test.describe('06 — Reçete op_sync Trigger (v16.45 TUR1-3F)', () => {
  test.beforeEach(async () => { await cleanup() })
  test.afterAll(async () => { await cleanup() })

  test('trg-recipe-sync-1: açık WO reçete UPDATE ile senkron olur', async () => {
    const opOld = `${PREFIX}OP-OLD`
    const opNew = `${PREFIX}OP-NEW`
    const istA = `${PREFIX}IST-A`
    const istB = `${PREFIX}IST-B`
    const rcId = `${PREFIX}RC-1`
    const woId = `${PREFIX}WO-1`

    // Setup: 2 op + 2 ist + reçete + 1 WO
    await supabaseAdmin.from('uys_operations').insert([
      { id: opOld, kod: '023', ad: 'KESİM' },
      { id: opNew, kod: '027', ad: 'CNC TORNA' },
    ])
    await supabaseAdmin.from('uys_stations').insert([
      { id: istA, kod: 'IST-A', ad: 'Hat A' },
      { id: istB, kod: 'IST-B', ad: 'Hat B' },
    ])
    await supabaseAdmin.from('uys_recipes').insert({
      id: rcId,
      mamul_kod: `${PREFIX}MAMUL`,
      mamul_ad: 'TRG MAMUL',
      ad: 'TRG Reçete',
      satirlar: [{
        kirno: '1', tip: 'Mamul',
        malkod: `${PREFIX}MAMUL`, malad: 'TRG MAMUL',
        opId: opOld, istId: istA,
        islemSure: 10, hazirlikSure: 5, miktar: 1,
      }],
    })
    await supabaseAdmin.from('uys_work_orders').insert({
      id: woId, rc_id: rcId, sira: 1, kirno: '1',
      mamul_kod: `${PREFIX}MAMUL`, mamul_ad: 'TRG MAMUL',
      malkod: `${PREFIX}MAMUL`, malad: 'TRG MAMUL',
      op_id: opOld, op_kod: '023', op_ad: 'KESİM',
      ist_id: istA, ist_kod: 'IST-A', ist_ad: 'Hat A',
      islem_sure: 10, hazirlik_sure: 5,
      hedef: 100, mpm: 1, durum: 'bekliyor',
      ie_no: `${PREFIX}IE-1`,
    })

    // Trigger: reçete satır[0]'da op/ist/süre değiştir
    await supabaseAdmin.from('uys_recipes').update({
      satirlar: [{
        kirno: '1', tip: 'Mamul',
        malkod: `${PREFIX}MAMUL`, malad: 'TRG MAMUL',
        opId: opNew, istId: istB,
        islemSure: 15, hazirlikSure: 7, miktar: 1,
      }],
    }).eq('id', rcId)

    // WO senkron olmalı
    const { data: wo } = await supabaseAdmin
      .from('uys_work_orders')
      .select('op_id, op_kod, op_ad, ist_id, ist_kod, ist_ad, islem_sure, hazirlik_sure')
      .eq('id', woId)
      .single()
    expect(wo).not.toBeNull()
    expect(wo!.op_id).toBe(opNew)
    expect(wo!.op_kod).toBe('027')
    expect(wo!.op_ad).toBe('CNC TORNA')
    expect(wo!.ist_id).toBe(istB)
    expect(wo!.ist_kod).toBe('IST-B')
    expect(wo!.ist_ad).toBe('Hat B')
    expect(Number(wo!.islem_sure)).toBe(15)
    expect(Number(wo!.hazirlik_sure)).toBe(7)
  })

  test('trg-recipe-sync-2: tamamlanmış WO korunur (geçmiş kayıt iz)', async () => {
    const opOld = `${PREFIX}OP-OLD-2`
    const opNew = `${PREFIX}OP-NEW-2`
    const rcId = `${PREFIX}RC-2`
    const woOpen = `${PREFIX}WO-2-OPEN`
    const woDone = `${PREFIX}WO-2-DONE`

    await supabaseAdmin.from('uys_operations').insert([
      { id: opOld, kod: 'OPOLD2', ad: 'eski' },
      { id: opNew, kod: 'OPNEW2', ad: 'yeni' },
    ])
    await supabaseAdmin.from('uys_recipes').insert({
      id: rcId, mamul_kod: `${PREFIX}M2`, mamul_ad: 'M2', ad: 'rc2',
      satirlar: [{
        kirno: '1', tip: 'Mamul', malkod: `${PREFIX}M2`, malad: 'M2',
        opId: opOld, istId: '', islemSure: 10, hazirlikSure: 0, miktar: 1,
      }],
    })
    // İki WO: biri bekliyor, biri tamamlandi
    await supabaseAdmin.from('uys_work_orders').insert([
      {
        id: woOpen, rc_id: rcId, sira: 1, kirno: '1',
        mamul_kod: `${PREFIX}M2`, mamul_ad: 'M2', malkod: `${PREFIX}M2`, malad: 'M2',
        op_id: opOld, op_kod: 'OPOLD2', op_ad: 'eski',
        islem_sure: 10, hazirlik_sure: 0, hedef: 50, mpm: 1, durum: 'bekliyor',
        ie_no: `${PREFIX}IE-2A`,
      },
      {
        id: woDone, rc_id: rcId, sira: 2, kirno: '1',
        mamul_kod: `${PREFIX}M2`, mamul_ad: 'M2', malkod: `${PREFIX}M2`, malad: 'M2',
        op_id: opOld, op_kod: 'OPOLD2', op_ad: 'eski',
        islem_sure: 10, hazirlik_sure: 0, hedef: 50, mpm: 1, durum: 'tamamlandi',
        ie_no: `${PREFIX}IE-2B`,
      },
    ])

    // Trigger: opId değiştir
    await supabaseAdmin.from('uys_recipes').update({
      satirlar: [{
        kirno: '1', tip: 'Mamul', malkod: `${PREFIX}M2`, malad: 'M2',
        opId: opNew, istId: '', islemSure: 20, hazirlikSure: 0, miktar: 1,
      }],
    }).eq('id', rcId)

    const { data: open } = await supabaseAdmin.from('uys_work_orders').select('op_id, op_kod').eq('id', woOpen).single()
    const { data: done } = await supabaseAdmin.from('uys_work_orders').select('op_id, op_kod').eq('id', woDone).single()

    // Açık WO senkron oldu
    expect(open!.op_id).toBe(opNew)
    expect(open!.op_kod).toBe('OPNEW2')
    // Tamamlanmış WO KORUNDU
    expect(done!.op_id).toBe(opOld)
    expect(done!.op_kod).toBe('OPOLD2')
  })

  test('trg-recipe-sync-3: kirno=1 ve 1.1 multi-WO eş zamanlı senkron', async () => {
    const opNew = `${PREFIX}OP-NEW-3`
    const rcId = `${PREFIX}RC-3`
    const woMain = `${PREFIX}WO-3-MAIN`
    const woSub = `${PREFIX}WO-3-SUB`

    await supabaseAdmin.from('uys_operations').insert({ id: opNew, kod: 'OPNEW3', ad: 'yeni3' })
    await supabaseAdmin.from('uys_recipes').insert({
      id: rcId, mamul_kod: `${PREFIX}M3`, mamul_ad: 'M3', ad: 'rc3',
      satirlar: [
        { kirno: '1', tip: 'Mamul', malkod: `${PREFIX}M3`, malad: 'M3', opId: 'PLACEHOLDER-ID', istId: '', islemSure: 5, hazirlikSure: 0, miktar: 1 },
        { kirno: '1.1', tip: 'YarıMamul', malkod: `${PREFIX}YM3`, malad: 'YM3', opId: 'PLACEHOLDER-ID', istId: '', islemSure: 3, hazirlikSure: 0, miktar: 2 },
      ],
    })
    await supabaseAdmin.from('uys_work_orders').insert([
      {
        id: woMain, rc_id: rcId, sira: 1, kirno: '1',
        mamul_kod: `${PREFIX}M3`, mamul_ad: 'M3', malkod: `${PREFIX}M3`, malad: 'M3',
        op_id: 'OLD', op_kod: 'X', op_ad: 'eski',
        islem_sure: 5, hazirlik_sure: 0, hedef: 100, mpm: 1, durum: 'bekliyor',
        ie_no: `${PREFIX}IE-3A`,
      },
      {
        id: woSub, rc_id: rcId, sira: 2, kirno: '1.1',
        mamul_kod: `${PREFIX}M3`, mamul_ad: 'M3', malkod: `${PREFIX}YM3`, malad: 'YM3',
        op_id: 'OLD', op_kod: 'X', op_ad: 'eski',
        islem_sure: 3, hazirlik_sure: 0, hedef: 200, mpm: 1, durum: 'uretimde',
        ie_no: `${PREFIX}IE-3B`,
      },
    ])

    // Trigger: ikisinin opId'sini opNew yap
    await supabaseAdmin.from('uys_recipes').update({
      satirlar: [
        { kirno: '1', tip: 'Mamul', malkod: `${PREFIX}M3`, malad: 'M3', opId: opNew, istId: '', islemSure: 50, hazirlikSure: 0, miktar: 1 },
        { kirno: '1.1', tip: 'YarıMamul', malkod: `${PREFIX}YM3`, malad: 'YM3', opId: opNew, istId: '', islemSure: 30, hazirlikSure: 0, miktar: 2 },
      ],
    }).eq('id', rcId)

    const { data: main } = await supabaseAdmin.from('uys_work_orders').select('op_id, op_kod, islem_sure').eq('id', woMain).single()
    const { data: sub } = await supabaseAdmin.from('uys_work_orders').select('op_id, op_kod, islem_sure').eq('id', woSub).single()

    expect(main!.op_id).toBe(opNew)
    expect(main!.op_kod).toBe('OPNEW3')
    expect(Number(main!.islem_sure)).toBe(50)
    expect(sub!.op_id).toBe(opNew)
    expect(sub!.op_kod).toBe('OPNEW3')
    expect(Number(sub!.islem_sure)).toBe(30)
  })
})
