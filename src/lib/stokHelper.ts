/**
 * stokHelper.ts — Stok hareketi yazma tek noktası
 *
 * KURAL: uys_stok_hareketler'e insert sadece buradan yapılır.
 * Şema değişirse tek yer güncellenir.
 */
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'

export interface StokHareketiParams {
  malkod: string
  malad: string
  miktar: number
  tip: 'giris' | 'cikis' | 'bar_acilis'
  aciklama?: string
  tarih?: string
  woId?: string
  logId?: string
}

export async function addStokHareketi(p: StokHareketiParams): Promise<{ error: any }> {
  const { error } = await supabase.from('uys_stok_hareketler').insert({
    id: uid(),
    tarih: p.tarih || today(),
    malkod: p.malkod,
    malad: p.malad,
    miktar: p.miktar,
    tip: p.tip,
    aciklama: p.aciklama || '',
    wo_id: p.woId || null,
    log_id: p.logId || null,
  })
  return { error }
}

export async function addStokHareketiToplu(list: StokHareketiParams[]): Promise<{ error: any }> {
  if (!list.length) return { error: null }
  const rows = list.map(p => ({
    id: uid(),
    tarih: p.tarih || today(),
    malkod: p.malkod,
    malad: p.malad,
    miktar: p.miktar,
    tip: p.tip,
    aciklama: p.aciklama || '',
    wo_id: p.woId || null,
    log_id: p.logId || null,
  }))
  // 100'erli batch
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('uys_stok_hareketler').insert(rows.slice(i, i + 100))
    if (error) return { error }
  }
  return { error: null }
}
