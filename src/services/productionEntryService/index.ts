/**
 * productionEntryService — Üretim girişi ortak pipeline
 *
 * ProductionEntry.tsx (EntryModal) ve OperatorPanel.tsx (OprEntryModal)
 * tarafından paylaşılan DB yazma akışı: log → mamul stok → HM tüketim →
 * fire log → WO durum → active_work kapama → audit.
 */

import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import { addStokHareketi } from '@/lib/stokHelper'
import { auditUretimLog } from '@/services/auditService'
import { isBarMaterialByKod } from '@/services/productionService/barModel'
import type { Material } from '@/types'

// ─── Arayüzler ───────────────────────────────────────────────────────────────

export interface HmSatir {
  malkod: string
  malad: string
  miktar: number
}

export interface OprGiris {
  id: string
  ad: string
  bas?: string
  bit?: string
}

interface WOGiris {
  malkod: string
  malad: string
  ieNo: string
  opAd?: string
  hedef: number
  durum: string
  mpm?: number
}

export interface UretimGirisiParams {
  woId: string
  wo: WOGiris
  tarih: string
  saat: string
  qty: number
  fire: number
  oprList: OprGiris[]
  duruslar: { kodId: string; kodAd: string; sure: number; bas?: string; bit?: string }[]
  not_: string
  hmSatirlar: HmSatir[]
  materials: Material[]
  freshProd: number
  freshFire: number
  siparisNo?: string
}

export interface UretimGirisiSonuc {
  ok: boolean
  logId: string
  autoKapatildi: boolean
  error?: string
}

export interface StartWorkParams {
  woId: string
  oprId: string
  oprAd: string
  woMalad: string
  tarih: string
  myActiveCount: number
}

// ─── Kapasite kontrolü ───────────────────────────────────────────────────────

/** Güncel üretim + fire sayısını DB'den çeker, kalan kapasiteyi döner.
 *  excludeLogId: düzenleme modunda mevcut logu hesaba katmamak için. */
export async function kapasiteKontrol(woId: string, hedef: number, excludeLogId?: string) {
  const { data } = await supabase.from('uys_logs').select('id, qty, fire').eq('wo_id', woId)
  const logs = (data || []).filter((l: any) => !excludeLogId || l.id !== excludeLogId)
  const uretilen = logs.reduce((a: number, l: any) => a + (l.qty || 0), 0)
  const fireSayisi = logs.reduce((a: number, l: any) => a + (l.fire || 0), 0)
  const kalan = Math.max(0, hedef - uretilen - fireSayisi)
  return { uretilen, fireSayisi, kalan }
}

// ─── Dahili yardımcılar ──────────────────────────────────────────────────────

async function hmTuket(p: {
  hmSatirlar: HmSatir[]
  materials: Material[]
  mpm: number
  toplamTuketilen: number
  tarih: string
  logId: string
  woId: string
  ieNo: string
  q: number
  f: number
  suffix?: string
}) {
  if (p.toplamTuketilen <= 0) return
  for (const hm of p.hmSatirlar) {
    if (isBarMaterialByKod(hm.malkod, p.materials)) continue
    const hmMiktar = Math.round((hm.miktar || 0) * (p.mpm || 1) * p.toplamTuketilen * 100) / 100
    if (hmMiktar <= 0) continue
    await supabase.from('uys_stok_hareketler').insert({
      id: uid(), tarih: p.tarih, malkod: hm.malkod, malad: hm.malad,
      miktar: hmMiktar, tip: 'cikis',
      log_id: p.logId, wo_id: p.woId,
      aciklama: `HM tüketim — ${p.ieNo} (${p.q} sağlam${p.f > 0 ? ' + ' + p.f + ' fire' : ''})${p.suffix || ''}`,
    })
  }
}

async function autoKapat(
  woId: string, freshProd: number, freshFire: number,
  newQ: number, newF: number, woDurum: string, woHedef: number,
): Promise<boolean> {
  const yeniKapasite = (freshProd + newQ) + (freshFire + newF)
  if (yeniKapasite >= woHedef && woHedef > 0 && woDurum !== 'tamamlandi') {
    await supabase.from('uys_work_orders').update({ durum: 'tamamlandi' }).eq('id', woId)
    await supabase.from('uys_active_work').delete().eq('wo_id', woId)
    return true
  }
  if (woDurum !== 'uretimde' && woDurum !== 'tamamlandi') {
    await supabase.from('uys_work_orders').update({ durum: 'uretimde' }).eq('id', woId)
  }
  return false
}

// ─── Ana servis fonksiyonları ─────────────────────────────────────────────────

/** Yeni üretim girişi — uys_logs INSERT + mamul stok + HM tüketim + fire + WO durum. */
export async function kaydetUretimGirisi(p: UretimGirisiParams): Promise<UretimGirisiSonuc> {
  const { woId, wo, tarih, saat, qty: q, fire: f, oprList, duruslar, not_, hmSatirlar, materials, freshProd, freshFire, siparisNo } = p
  const logId = uid()

  try {
    const { error: logErr } = await supabase.from('uys_logs').insert({
      id: logId, wo_id: woId, tarih, saat, qty: q, fire: f,
      operatorlar: oprList,
      duruslar: duruslar.filter(d => d.kodId && d.sure > 0),
      not_: not_, malkod: wo.malkod, ie_no: wo.ieNo,
      operator_id: oprList[0]?.id || null, vardiya: '',
    })
    if (logErr) throw logErr

    auditUretimLog({ logId, woId, ieNo: wo.ieNo, qty: q, fire: f, malkod: wo.malkod, siparisNo })

    if (q > 0) {
      await addStokHareketi({ malkod: wo.malkod, malad: wo.malad, miktar: q, tip: 'giris', aciklama: 'Üretim — ' + wo.ieNo, woId, logId })
    }

    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), log_id: logId, wo_id: woId, tarih,
        malkod: wo.malkod, malad: wo.malad, qty: f,
        ie_no: wo.ieNo, op_ad: wo.opAd || oprList.map(o => o.ad).join(', '),
        operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad })),
        not_: not_,
      })
    }

    await hmTuket({ hmSatirlar, materials, mpm: wo.mpm || 1, toplamTuketilen: q + f, tarih, logId, woId, ieNo: wo.ieNo, q, f })

    const autoKapatildi = await autoKapat(woId, freshProd, freshFire, q, f, wo.durum, wo.hedef)

    return { ok: true, logId, autoKapatildi }
  } catch (e: any) {
    return { ok: false, logId, autoKapatildi: false, error: e?.message || String(e) }
  }
}

/** Mevcut üretim girişini düzenle — UPDATE log + stok yeniden oluştur + fire güncelle. */
export async function duzenleUretimGirisi(editLogId: string, p: UretimGirisiParams): Promise<UretimGirisiSonuc> {
  const { woId, wo, tarih, qty: q, fire: f, oprList, duruslar, not_, hmSatirlar, materials, freshProd, freshFire, siparisNo } = p

  try {
    await supabase.from('uys_logs').update({
      qty: q, fire: f, not_: not_, tarih,
      operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad, bas: o.bas, bit: o.bit })),
      duruslar: duruslar.filter(d => d.kodId && d.sure > 0).map(d => ({ kodId: d.kodId, kodAd: d.kodAd, sure: d.sure, bas: d.bas, bit: d.bit })),
    }).eq('id', editLogId)

    await supabase.from('uys_stok_hareketler').delete().eq('log_id', editLogId)

    if (q > 0) {
      await addStokHareketi({ malkod: wo.malkod, malad: wo.malad, miktar: q, tip: 'giris', aciklama: wo.ieNo + ' - ' + oprList.map(o => o.ad).join(', '), woId, logId: editLogId })
    }

    await hmTuket({ hmSatirlar, materials, mpm: wo.mpm || 1, toplamTuketilen: q + f, tarih, logId: editLogId, woId, ieNo: wo.ieNo, q, f, suffix: ' - düzenlendi' })

    await supabase.from('uys_fire_logs').delete().eq('log_id', editLogId)
    if (f > 0) {
      await supabase.from('uys_fire_logs').insert({
        id: uid(), log_id: editLogId, wo_id: woId, tarih,
        malkod: wo.malkod, malad: wo.malad, qty: f,
        ie_no: wo.ieNo, op_ad: oprList.map(o => o.ad).join(', '),
        operatorlar: oprList.map(o => ({ id: o.id, ad: o.ad })),
        not_: not_ || '',
      })
    }

    auditUretimLog({ logId: editLogId, woId, ieNo: wo.ieNo, qty: q, fire: f, malkod: wo.malkod, siparisNo })

    const autoKapatildi = await autoKapat(woId, freshProd, freshFire, q, f, wo.durum, wo.hedef)

    return { ok: true, logId: editLogId, autoKapatildi }
  } catch (e: any) {
    return { ok: false, logId: editLogId, autoKapatildi: false, error: e?.message || String(e) }
  }
}

/** Operatör bir iş emrine başlar — uys_active_work INSERT + akıllı başlangıç saati. */
export async function startWork(p: StartWorkParams): Promise<{ ok: boolean; saat: string; usedLastStop: boolean; error?: string }> {
  const { woId, oprId, oprAd, woMalad, tarih, myActiveCount } = p
  const now = new Date()
  const currentSaat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  let saat = currentSaat
  let usedLastStop = false

  if (myActiveCount === 0) {
    try {
      const raw = localStorage.getItem('uys_lastStop_' + oprId)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.tarih === tarih && parsed.saat) {
          saat = parsed.saat
          usedLastStop = true
        }
      }
    } catch {}
  }

  const { error } = await supabase.from('uys_active_work').insert({
    id: uid(), op_id: oprId, op_ad: oprAd, wo_id: woId,
    wo_ad: woMalad, baslangic: saat, tarih,
  })

  if (error) return { ok: false, saat: currentSaat, usedLastStop: false, error: error.message }
  return { ok: true, saat, usedLastStop }
}

/** Operatör aktif işi durdurur — uys_active_work DELETE + lastStop localStorage. */
export async function stopWork(activeId: string, oprId: string, tarih: string): Promise<void> {
  const now = new Date()
  const stopSaat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  try { localStorage.setItem('uys_lastStop_' + oprId, JSON.stringify({ tarih, saat: stopSaat })) } catch {}
  await supabase.from('uys_active_work').delete().eq('id', activeId)
}
