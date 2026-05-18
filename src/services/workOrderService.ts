// src/services/workOrderService.ts
// v17.00 — Servis katmanı Zod giriş doğrulama eklendi

import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { addStokHareketi } from '@/lib/stokHelper'
import { auditWoDurum } from '@/services/auditService'
import { isBarMaterialByKod } from '@/services/productionService/barModel'
import type { WorkOrder } from '@/types'

// ─── Servis katmanı giriş şemaları ───────────────────────────────────────────

const _iptalNedenSchema = z
  .string()
  .trim()
  .min(3, 'İptal nedeni en az 3 karakter olmalı')
  .max(500, 'İptal nedeni 500 karakter geçemez')

const _hedefSchema = z
  .number()
  .int('Hedef tam sayı olmalı')
  .min(1, 'Hedef en az 1 olmalı')
  .max(999999, 'Hedef 999.999 geçemez')

// ─── setWoDurum ───────────────────────────────────────────────────────────────
// İptal yolunda stok ters kayıtları yazar + WO günceller.
// Normal yolda sadece durum + audit.
export async function setWoDurum(
  id: string,
  durum: string,
  opts: {
    wo: WorkOrder
    siparisNo?: string
    neden?: string
    prod?: number
    stokHareketler?: any[]
  }
): Promise<void> {
  const { wo, siparisNo, neden = '', prod = 0, stokHareketler = [] } = opts

  if (durum === 'iptal') {
    // İptal nedeni doğrulama — boş geçilebilir (eski çağrı uyumu için), 3+ karakter gerekirse UI zorunlu kılar
    if (neden) {
      const p = _iptalNedenSchema.safeParse(neden)
      if (!p.success) throw new Error(p.error.issues[0]?.message)
    }

    if (prod > 0) {
      await addStokHareketi({
        malkod: wo.malkod, malad: wo.malad, miktar: prod, tip: 'cikis',
        aciklama: 'İPTAL ters — ' + wo.ieNo + ' (' + neden + ')', woId: id,
      })
      const hmCikislar = stokHareketler.filter(h => h.woId === id && h.tip === 'cikis' && h.logId)
      for (const h of hmCikislar) {
        await addStokHareketi({
          malkod: h.malkod, malad: h.malad, miktar: h.miktar, tip: 'giris',
          aciklama: 'İPTAL HM iadesi — ' + wo.ieNo, woId: id,
        })
      }
    }
    await supabase.from('uys_work_orders')
      .update({ durum: 'iptal', not_: (wo.not || '') + '\n[İPTAL] ' + neden })
      .eq('id', id)

    // İE iptali — siparişe bağlı rezervleri serbest bırak
    if (opts.wo.orderId) {
      await supabase
        .from('uys_stok_hareketler')
        .delete()
        .eq('tip', 'rezerv')
        .eq('rezerv_order_id', opts.wo.orderId)
    }
    return
  }

  const eskiDurum = wo.durum || 'bekliyor'
  await supabase.from('uys_work_orders').update({ durum }).eq('id', id)
  auditWoDurum({ woId: id, ieNo: wo.ieNo, eskiDurum, yeniDurum: durum, siparisNo, malkod: wo.malkod })
}

// ─── topluDurumGuncelle ───────────────────────────────────────────────────────
export async function topluDurumGuncelle(
  ids: string[],
  durum: string,
  workOrders: WorkOrder[],
  orders: { id: string; siparisNo?: string }[]
): Promise<void> {
  for (const id of ids) {
    const wo = workOrders.find(w => w.id === id)
    const eskiDurum = wo?.durum || 'bekliyor'
    await supabase.from('uys_work_orders').update({ durum }).eq('id', id)
    if (wo) {
      auditWoDurum({
        woId: id, ieNo: wo.ieNo, eskiDurum, yeniDurum: durum,
        siparisNo: orders.find(o => o.id === wo.orderId)?.siparisNo,
        malkod: wo.malkod,
      })
    }
  }
}

// ─── topluTerminGuncelle ──────────────────────────────────────────────────────
export async function topluTerminGuncelle(ids: string[], termin: string): Promise<void> {
  for (const id of ids) {
    await supabase.from('uys_work_orders').update({ termin }).eq('id', id)
  }
}

// ─── deleteWO ─────────────────────────────────────────────────────────────────
export async function deleteWO(id: string): Promise<void> {
  await supabase.from('uys_work_orders').delete().eq('id', id)
}

// ─── topluSil ─────────────────────────────────────────────────────────────────
export async function topluSil(ids: string[]): Promise<void> {
  for (const id of ids) {
    await supabase.from('uys_work_orders').delete().eq('id', id)
  }
}

// ─── topluKopyala ─────────────────────────────────────────────────────────────
export async function topluKopyala(ids: string[], workOrders: WorkOrder[]): Promise<number> {
  let cnt = 0
  for (const id of ids) {
    const w = workOrders.find(x => x.id === id); if (!w) continue
    await supabase.from('uys_work_orders').insert({
      id: uid(), order_id: w.orderId || null, rc_id: w.rcId || null,
      sira: workOrders.length + cnt + 1, kirno: w.kirno,
      op_id: w.opId, op_kod: w.opKod, op_ad: w.opAd,
      ist_id: w.istId, ist_kod: w.istKod, ist_ad: w.istAd,
      malkod: w.malkod, malad: w.malad, hedef: w.hedef,
      mpm: w.mpm, hm: w.hm || [], ie_no: w.ieNo + '-K',
      wh_alloc: 0, hazirlik_sure: w.hazirlikSure, islem_sure: w.islemSure,
      durum: 'bekliyor', bagimsiz: w.bagimsiz, siparis_disi: w.siparisDisi,
      mamul_kod: w.mamulKod, mamul_ad: w.mamulAd, mamul_auto: w.mamulAuto,
      not_: w.not, olusturma: today(),
    })
    cnt++
  }
  return cnt
}

// ─── updateHedef ──────────────────────────────────────────────────────────────
export async function updateHedef(id: string, hedef: number): Promise<void> {
  const p = _hedefSchema.safeParse(hedef)
  if (!p.success) throw new Error(p.error.issues[0]?.message)
  await supabase.from('uys_work_orders').update({ hedef }).eq('id', id)
}

// ─── atamaOperator ────────────────────────────────────────────────────────────
export async function atamaOperator(id: string, opId: string | null): Promise<void> {
  await supabase.from('uys_work_orders').update({ operator_id: opId }).eq('id', id)
}

// ─── recalcDurumlar ───────────────────────────────────────────────────────────
// Tüm WO'ların durumunu üretim %'sine göre yeniden hesaplar; değişenleri günceller.
export async function recalcDurumlar(workOrders: WorkOrder[], logs: any[]): Promise<number> {
  let count = 0
  for (const w of workOrders) {
    if (w.durum === 'iptal' || w.durum === 'beklemede') continue
    const kap = logs.filter(l => l.woId === w.id).reduce((a: number, l: any) => a + (l.qty || 0) + (l.fire || 0), 0)
    const pct = w.hedef > 0 ? Math.min(100, Math.round(kap / w.hedef * 100)) : 0
    const pr = logs.filter(l => l.woId === w.id).reduce((a: number, l: any) => a + l.qty, 0)
    const yeniDurum = pct >= 100 ? 'tamamlandi' : pr > 0 ? 'uretimde' : 'bekliyor'
    if (w.durum !== yeniDurum) {
      await supabase.from('uys_work_orders').update({ durum: yeniDurum }).eq('id', w.id)
      count++
    }
  }
  return count
}

// ─── editLog ──────────────────────────────────────────────────────────────────
// Log qty/fire günceller, ürün stok hareketini günceller, HM delta hareketleri yazar.
// Stok yeterliliği kontrolü çağıran tarafta yapılmalıdır.
export async function editLog(
  l: any,
  yeniQty: number,
  yeniFire: number,
  wo: any,
  recipes: any[],
  stokHareketler: any[],
  materials: any[]
): Promise<{ hmUpdated: boolean; delta: number }> {
  if (!Number.isFinite(yeniQty) || yeniQty < 0) throw new Error('Yeni miktar geçersiz')
  if (!Number.isFinite(yeniFire) || yeniFire < 0) throw new Error('Yeni fire geçersiz')

  const delta = yeniQty - (l.qty || 0)
  const rc = wo.rcId
    ? recipes.find((r: any) => r.id === wo.rcId)
    : recipes.find((r: any) => r.mamulKod === wo.mamulKod)
  const hmSatirlar = (rc?.satirlar || []).filter((s: any) => s.tip === 'Hammadde' || s.tip === 'hammadde')

  await supabase.from('uys_logs').update({ qty: yeniQty, fire: yeniFire }).eq('id', l.id)

  const { data: sh } = await supabase.from('uys_stok_hareketler')
    .select('id').eq('log_id', l.id).eq('tip', 'giris').limit(1)
  if (sh?.[0]) await supabase.from('uys_stok_hareketler').update({ miktar: yeniQty }).eq('id', sh[0].id)

  let hmUpdated = false
  if (delta !== 0 && hmSatirlar.length > 0) {
    for (const hm of hmSatirlar) {
      const hmKod = hm.malkod || hm.kod
      if (isBarMaterialByKod(hmKod, materials)) continue
      const birAdet = (hm.miktar || 0) * (wo.mpm || 1)
      if (birAdet <= 0) continue
      const hmDelta = birAdet * Math.abs(delta)
      if (delta > 0) {
        await addStokHareketi({ malkod: hmKod, malad: hm.malad || hm.ad, miktar: hmDelta, tip: 'cikis', aciklama: wo.ieNo + ' düzeltme +' + delta, woId: wo.id, logId: l.id })
      } else {
        await addStokHareketi({ malkod: hmKod, malad: hm.malad || hm.ad, miktar: hmDelta, tip: 'giris', aciklama: wo.ieNo + ' düzeltme ' + delta, woId: wo.id, logId: l.id })
      }
    }
    hmUpdated = true
  }
  return { hmUpdated, delta }
}

// ─── deleteLog ────────────────────────────────────────────────────────────────
// Logu + ilişkili stok hareketleri + fire logları cascade siler.
export async function deleteLog(logId: string): Promise<void> {
  await supabase.from('uys_logs').delete().eq('id', logId)
  await supabase.from('uys_stok_hareketler').delete().eq('log_id', logId)
  await supabase.from('uys_fire_logs').delete().eq('log_id', logId)
}

// ─── createFireTelafisiIE ─────────────────────────────────────────────────────
// İstek #18 — Fire logunu "Sipariş Dışı / Bağımsız" telafi İE'sine dönüştürür.
// Yeni İE: orijinal ieNo-FT{sira}, bagimsiz=true, siparisDisi=true, hedef=fireQty
export async function createFireTelafisiIE(params: {
  wo: WorkOrder
  fireQty: number
  logId: string
}): Promise<{ ok: boolean; ieNo?: string; error?: string }> {
  const { wo, fireQty, logId } = params

  const _schema = z.number().int().min(1, 'Fire miktarı en az 1 olmalı').max(99999)
  const pv = _schema.safeParse(fireQty)
  if (!pv.success) return { ok: false, error: pv.error.issues[0]?.message }

  // Mevcut FT İE sayısını bul → sıra belirle (idempotency için)
  const { data: mevcut } = await supabase
    .from('uys_work_orders')
    .select('ie_no')
    .like('ie_no', `${wo.ieNo}-FT%`)
  const sira = (mevcut?.length || 0) + 1
  const yeniIeNo = `${wo.ieNo}-FT${sira}`

  // En yüksek sira'yı bul
  const { data: maxSiraData } = await supabase
    .from('uys_work_orders')
    .select('sira')
    .order('sira', { ascending: false })
    .limit(1)
  const yeniSira = ((maxSiraData?.[0]?.sira as number) || 0) + 1

  const { error } = await supabase.from('uys_work_orders').insert({
    id: uid(),
    order_id: null,
    rc_id: wo.rcId || null,
    sira: yeniSira,
    kirno: '1',
    op_id: wo.opId, op_kod: wo.opKod, op_ad: wo.opAd,
    ist_id: wo.istId, ist_kod: wo.istKod, ist_ad: wo.istAd,
    malkod: wo.malkod, malad: wo.malad,
    hedef: fireQty,
    mpm: wo.mpm || 1,
    hm: wo.hm || [],
    ie_no: yeniIeNo,
    wh_alloc: 0,
    hazirlik_sure: wo.hazirlikSure || 0,
    islem_sure: wo.islemSure || 0,
    durum: 'bekliyor',
    bagimsiz: true,
    siparis_disi: true,
    mamul_kod: wo.mamulKod || wo.malkod,
    mamul_ad: wo.mamulAd || wo.malad,
    mamul_auto: false,
    not_: `Fire Telafisi — ${wo.ieNo} (log: ${logId.slice(0, 8)}, ${fireQty} adet)`,
    olusturma: today(),
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, ieNo: yeniIeNo }
}
