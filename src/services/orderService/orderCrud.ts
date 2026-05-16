import { supabase } from '@/lib/supabase'
import { today, uid } from '@/lib/utils'
import type { Order } from '@/types'

export interface NewOrderRow {
  siparis_no: string
  musteri: string
  termin: string
  mamul_kod: string
  mamul_ad: string
  recete_id?: string | null
  adet: number
  not_?: string
  urunler?: unknown[]
}

export interface BulkOrderInsertRow {
  id: string
  siparis_no: string
  musteri: string
  tarih: string
  termin: string
  mamul_kod: string
  mamul_ad: string
  recete_id?: string | null
  adet: number
  not_?: string | null
  mrp_durum: string
  olusturma: string
  urunler?: unknown[]
}

export interface MrpSnapshotPayload {
  id: string
  orderId: string
  hesaplayan: string
  brutIhtiyac: Record<string, number>
  stokDurumu: Record<string, number>
  acikTedarik: Record<string, number>
  netIhtiyac: Record<string, number>
}

export interface CreateTedarikParams {
  malkod: string
  malad: string
  miktar: number
  birim: string
  termin?: string | null
  siparisNo: string
  orderId: string
  mrpCalculationId?: string | null
}

export async function createOrder(newId: string, row: NewOrderRow): Promise<void> {
  const { error } = await supabase.from('uys_orders').insert({
    id: newId, ...row, tarih: today(), mrp_durum: 'bekliyor', olusturma: today(),
  })
  if (error) throw new Error(error.message)
}

export async function copyOrder(source: Order): Promise<string> {
  const newId = uid()
  const { error } = await supabase.from('uys_orders').insert({
    id: newId,
    siparis_no: source.siparisNo + '-KOPYA',
    musteri: source.musteri,
    tarih: today(),
    termin: source.termin,
    mamul_kod: source.mamulKod,
    mamul_ad: source.mamulAd,
    adet: source.adet,
    recete_id: source.receteId,
    urunler: source.urunler || [],
    mrp_durum: 'bekliyor',
    olusturma: today(),
  })
  if (error) throw new Error(error.message)
  return newId
}

export async function updateOrderMrpDurum(orderId: string, durum: 'bekliyor' | 'eksik' | 'tamam'): Promise<void> {
  const { error } = await supabase.from('uys_orders').update({ mrp_durum: durum }).eq('id', orderId)
  if (error) throw new Error(error.message)
}

export async function updateOrderOncelik(orderId: string, oncelik: number): Promise<void> {
  const { error } = await supabase.from('uys_orders').update({ oncelik }).eq('id', orderId)
  if (error) throw new Error(error.message)
}

export async function updateOrderDurum(orderId: string, durum: string): Promise<void> {
  const { error } = await supabase.from('uys_orders').update({ durum }).eq('id', orderId)
  if (error) throw new Error(error.message)
}

export async function saveMrpCalculationSnapshot(payload: MrpSnapshotPayload): Promise<void> {
  const { error } = await supabase.from('uys_mrp_calculations').insert({
    id: payload.id,
    order_id: payload.orderId,
    hesaplayan: payload.hesaplayan,
    brut_ihtiyac: payload.brutIhtiyac,
    stok_durumu: payload.stokDurumu,
    acik_tedarik: payload.acikTedarik,
    net_ihtiyac: payload.netIhtiyac,
    durum: 'tamamlandi',
  })
  if (error) throw new Error(error.message)
}

export async function deleteWorkOrders(ids: string[]): Promise<void> {
  for (const id of ids) {
    const { error } = await supabase.from('uys_work_orders').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}

export async function createTedarikFromMrp(params: CreateTedarikParams): Promise<void> {
  const { error } = await supabase.from('uys_tedarikler').insert({
    id: uid(),
    malkod: params.malkod,
    malad: params.malad,
    miktar: params.miktar,
    birim: params.birim,
    tarih: today(),
    teslim_tarihi: params.termin ?? null,
    durum: 'bekliyor',
    geldi: false,
    siparis_no: params.siparisNo,
    order_id: params.orderId,
    not_: 'MRP',
    auto_olusturuldu: false,
    mrp_calculation_id: params.mrpCalculationId ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function getOrderWorkOrderIds(orderId: string): Promise<string[]> {
  const { data, error } = await supabase.from('uys_work_orders').select('id').eq('order_id', orderId)
  if (error) throw new Error(error.message)
  return (data || []).map((r: { id: string }) => r.id)
}

export async function insertOrderRow(row: BulkOrderInsertRow): Promise<void> {
  const { error } = await supabase.from('uys_orders').insert(row)
  if (error) throw new Error(error.message)
}
