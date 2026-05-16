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
