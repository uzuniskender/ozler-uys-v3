/**
 * v15.54 — Sevkiyat Servisi
 * Faz 1: nextSevkNo, isValidSevkNo
 * Faz 2: calcSevkDurum, deleteSevk, createSevk, updateSevk
 */

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { uid, today } from '@/lib/utils'
import { getStok } from '@/lib/hammaddeHesap'
import { addStokHareketi } from '@/lib/stokHelper'
import { auditLog } from '@/services/auditService'
import type { StokHareket } from '@/types'

type SevkDurum = 'sevk_yok' | 'kismi_sevk' | 'tamamen_sevk'
type SevkKalem = { malkod: string; malad: string; miktar: number }

/**
 * Sıradaki sevk numarasını döner. Format: SEV-YYYY-NNNN (örn. SEV-2026-0042)
 *
 * Mantık: Bu yıla ait son sevk numarasını bul, +1 yap, 4 haneli pad'le.
 * Yıl başında sayaç sıfırlanır (yeni yıl prefix'i farklı).
 *
 * NOT: Bu fonksiyon yarış durumuna (race condition) karşı KORUMASIZ —
 * iki kullanıcı aynı anda çağırırsa aynı no'yu alabilir.
 * Faz 2'de RPC fonksiyonu içinde tek transaction olarak çağrılacak,
 * UNIQUE constraint (idx_uys_sevkler_sevk_no_unique) çakışmayı engelleyecek.
 */
export async function nextSevkNo(): Promise<string> {
  const yil = new Date().getFullYear()
  const prefix = `SEV-${yil}-`

  const { data, error } = await supabase
    .from('uys_sevkler')
    .select('sevk_no')
    .like('sevk_no', `${prefix}%`)
    .order('sevk_no', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return `${prefix}0001`
  }

  const lastNo = data[0].sevk_no as string
  // SEV-2026-0042 → 0042 → 42
  const lastNum = parseInt(lastNo.slice(prefix.length), 10) || 0
  const nextNum = lastNum + 1
  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

/**
 * Bir sevk numarasının formatı doğru mu kontrol et.
 * Faz 2'de düzenleme akışında kullanılır.
 */
export function isValidSevkNo(s: string): boolean {
  return /^SEV-\d{4}-\d{4}$/.test(s)
}

export async function calcSevkDurum(
  orderId: string,
  ordAdet: number,
  mamulKod: string,
  yeniKalemler: { malkod: string; miktar: number }[] = []
): Promise<SevkDurum> {
  const { data, error } = await supabase
    .from('uys_sevkler')
    .select('kalemler')
    .eq('order_id', orderId)
  if (error) throw wrap(error, { table: 'uys_sevkler', op: 'select' })
  let toplam = 0
  for (const s of (data || [])) {
    const kk = (s.kalemler || []) as { malkod: string; miktar: number }[]
    toplam += kk.filter(k => k.malkod === mamulKod).reduce((a, k) => a + (k.miktar || 0), 0)
  }
  toplam += yeniKalemler.filter(k => k.malkod === mamulKod).reduce((a, k) => a + (k.miktar || 0), 0)
  if (toplam <= 0) return 'sevk_yok'
  if (toplam >= ordAdet) return 'tamamen_sevk'
  return 'kismi_sevk'
}

export async function deleteSevk(
  sevkId: string,
  orderId: string | null,
  ordAdet: number,
  mamulKod: string
): Promise<void> {
  const { error: e1 } = await supabase.from('uys_sevkler').delete().eq('id', sevkId)
  if (e1) throw wrap(e1, { table: 'uys_sevkler', op: 'delete' })
  const { error: e2 } = await supabase.from('uys_stok_hareketler').delete().like('aciklama', 'Sevkiyat — ' + sevkId + '%')
  if (e2) throw wrap(e2, { table: 'uys_stok_hareketler', op: 'delete' })
  if (orderId) {
    const durum = await calcSevkDurum(orderId, ordAdet, mamulKod)
    const { error: e3 } = await supabase.from('uys_orders').update({ sevk_durum: durum }).eq('id', orderId)
    if (e3) throw wrap(e3, { table: 'uys_orders', op: 'update' })
  }
  await auditLog({ olay: 'sevk_delete', detay: { sevkId, orderId } })
}

export async function createSevk(params: {
  orderId: string | null
  siparisNo: string
  musteri: string
  kalemler: SevkKalem[]
  tarih: string
  not_: string
  doStokCikis: boolean
  stokHareketler: StokHareket[]
  ordAdet?: number
  mamulKod?: string
}): Promise<{ id: string; sevkDurum: SevkDurum | null }> {
  const { orderId, siparisNo, musteri, kalemler, tarih, not_, doStokCikis, stokHareketler, ordAdet, mamulKod } = params
  if (doStokCikis) {
    const stokYetersiz = kalemler.filter(k => getStok(k.malkod, stokHareketler) < k.miktar)
    if (stokYetersiz.length > 0) {
      throw new Error('Stok yetersiz: ' + stokYetersiz.map(k =>
        `${k.malad || k.malkod} (stok: ${getStok(k.malkod, stokHareketler)}, talep: ${k.miktar})`
      ).join(' · '))
    }
  }
  const sevkId = uid()
  const { error: e1 } = await supabase.from('uys_sevkler').insert({
    id: sevkId, order_id: orderId || null, siparis_no: siparisNo,
    musteri, tarih, kalemler, not_,
  })
  if (e1) throw wrap(e1, { table: 'uys_sevkler', op: 'insert' })
  if (doStokCikis) {
    for (const k of kalemler) {
      await addStokHareketi({ malkod: k.malkod, malad: k.malad, miktar: k.miktar, tip: 'cikis', aciklama: 'Sevkiyat — ' + sevkId, tarih })
    }
  }
  let sevkDurum: SevkDurum | null = null
  if (orderId && ordAdet != null && mamulKod) {
    sevkDurum = await calcSevkDurum(orderId, ordAdet, mamulKod)
    const { error: e2 } = await supabase.from('uys_orders').update({ sevk_durum: sevkDurum }).eq('id', orderId)
    if (e2) throw wrap(e2, { table: 'uys_orders', op: 'update' })
  }
  await auditLog({ olay: 'sevk_create', detay: { sevkId, orderId, kalemler } })
  return { id: sevkId, sevkDurum }
}

export async function updateSevk(params: {
  sevkId: string
  orderId: string | null
  kalemler: SevkKalem[]
  not_: string
  doStokCikis: boolean
  stokHareketler: StokHareket[]
  tarih?: string
  ordAdet?: number
  mamulKod?: string
}): Promise<void> {
  const { sevkId, orderId, kalemler, not_, doStokCikis, stokHareketler, tarih, ordAdet, mamulKod } = params
  const { error: e1 } = await supabase.from('uys_sevkler').update({ kalemler, not_ }).eq('id', sevkId)
  if (e1) throw wrap(e1, { table: 'uys_sevkler', op: 'update' })
  if (doStokCikis) {
    // Konservatif doğrulama: eski hareketler hâlâ store'da, yeni miktar onlarla birlikte sığıyor mu
    const stokYetersiz = kalemler.filter(k => getStok(k.malkod, stokHareketler) < k.miktar)
    if (stokYetersiz.length > 0) {
      throw new Error('Stok yetersiz: ' + stokYetersiz.map(k =>
        `${k.malad || k.malkod} (mevcut: ${getStok(k.malkod, stokHareketler)}, talep: ${k.miktar})`
      ).join(' · '))
    }
    const { error: e2 } = await supabase.from('uys_stok_hareketler').delete().like('aciklama', 'Sevkiyat — ' + sevkId + '%')
    if (e2) throw wrap(e2, { table: 'uys_stok_hareketler', op: 'delete' })
    for (const k of kalemler) {
      await addStokHareketi({ malkod: k.malkod, malad: k.malad, miktar: k.miktar, tip: 'cikis', aciklama: 'Sevkiyat — ' + sevkId, tarih: tarih || today() })
    }
  }
  if (orderId && ordAdet != null && mamulKod) {
    const durum = await calcSevkDurum(orderId, ordAdet, mamulKod)
    const { error: e3 } = await supabase.from('uys_orders').update({ sevk_durum: durum }).eq('id', orderId)
    if (e3) throw wrap(e3, { table: 'uys_orders', op: 'update' })
  }
  await auditLog({ olay: 'sevk_update', detay: { sevkId, orderId, kalemler } })
}
