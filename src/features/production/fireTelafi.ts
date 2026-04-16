import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { FireLog, WorkOrder } from '@/types'

export interface TelafiSonuc {
  basarili: number
  hata: number
  olusturulanIeNolar: string[]
  hatalar: string[]
}

// Bir fire log için telafi (sipariş dışı) İE oluştur
// Dönen: yeni İE'nin id'si, null = hata
export async function fireTelafiIeOlustur(
  fire: FireLog,
  orijinalWo: WorkOrder,
): Promise<{ woId: string; ieNo: string } | null> {
  if (!fire.qty || fire.qty < 1) return null
  if (fire.telafiWoId) return null  // Zaten var
  if (!orijinalWo) return null

  const newId = uid()
  const yeniIeNo = (orijinalWo.ieNo || 'IE') + '-F' + String(fire.id || '').slice(-4).toUpperCase()

  const row = {
    id: newId,
    order_id: '',
    rc_id: orijinalWo.rcId || '',
    sira: 0,
    kirno: orijinalWo.kirno || '',
    op_id: orijinalWo.opId || '',
    op_kod: orijinalWo.opKod || '',
    op_ad: orijinalWo.opAd || '',
    ist_id: orijinalWo.istId || '',
    ist_kod: orijinalWo.istKod || '',
    ist_ad: orijinalWo.istAd || '',
    malkod: orijinalWo.malkod || '',
    malad: orijinalWo.malad || '',
    mamul_kod: orijinalWo.mamulKod || '',
    mamul_ad: orijinalWo.mamulAd || '',
    hedef: fire.qty,
    mpm: orijinalWo.mpm || 1,
    hm: orijinalWo.hm || [],
    ie_no: yeniIeNo,
    wh_alloc: 0,
    hazirlik_sure: orijinalWo.hazirlikSure || 0,
    islem_sure: orijinalWo.islemSure || 0,
    durum: 'bekliyor',
    bagimsiz: true,
    siparis_disi: true,
    not_: `Fire telafisi · ${fire.ieNo || ''} · ${fire.qty} adet · ${fire.tarih || today()}`,
    olusturma: today(),
  }

  const { error: woErr } = await supabase.from('uys_work_orders').insert(row)
  if (woErr) {
    console.error('Fire telafi İE hatası:', woErr.message)
    return null
  }

  // Fire log'a telafi referansı kaydet
  await supabase.from('uys_fire_logs').update({ telafi_wo_id: newId }).eq('id', fire.id)

  return { woId: newId, ieNo: yeniIeNo }
}

// Toplu telafi — tüm telafisi olmayan fire'lar için
export async function topluFireTelafi(
  fireLogs: FireLog[],
  workOrders: WorkOrder[],
): Promise<TelafiSonuc> {
  const sonuc: TelafiSonuc = { basarili: 0, hata: 0, olusturulanIeNolar: [], hatalar: [] }
  const telafisiz = fireLogs.filter(f => f.qty > 0 && !f.telafiWoId)

  for (const f of telafisiz) {
    const wo = workOrders.find(w => w.id === f.woId)
    if (!wo) { sonuc.hata++; sonuc.hatalar.push(`${f.ieNo || f.id}: orijinal İE bulunamadı`); continue }
    const r = await fireTelafiIeOlustur(f, wo)
    if (r) {
      sonuc.basarili++
      sonuc.olusturulanIeNolar.push(r.ieNo)
    } else {
      sonuc.hata++
      sonuc.hatalar.push(`${f.ieNo || f.id}: İE oluşturulamadı`)
    }
  }
  return sonuc
}
