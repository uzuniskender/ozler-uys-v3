// src/services/bildirimlerService.ts
// uys_bildirimler için CRUD + okundu işaretleme servisi.
//
// Özel durum: bu tablo store TABLE_MAP'te yer alır (global cache, auth slice
// → bildirimler). Servis ağırlıklı yazma path'i ve store dışı duplicate
// kontrolü içindir; sayfaların listelemeleri genellikle store'dan okur.
// (Aynı yaklaşım tedarikciService'te de uygulanmıştır.)

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { norm } from '@/services/_base/query'
import { uid } from '@/lib/utils'
import type { Bildirim } from '@/types'

const TABLO = 'uys_bildirimler'

// DB satırı → Bildirim (store mapper M.bildirim ile aynı mantık)
function toBildirim(r: Record<string, unknown>): Bildirim {
  return {
    id: r.id as string,
    tip: (r.tip || 'sari') as Bildirim['tip'],
    kategori: (r.kategori || '') as string,
    baslik: (r.baslik || '') as string,
    mesaj: (r.mesaj || '') as string,
    hedefKullaniciId: (r.hedef_kullanici_id || '') as string,
    refId: (r.ref_id || '') as string,
    refTip: (r.ref_tip || '') as string,
    okundu: !!r.okundu,
    okunduTarih: (r.okundu_tarih || '') as string,
    olusturma: (r.olusturma || '') as string,
    olusturan: (r.olusturan || '') as string,
  }
}

export interface BildirimInsert {
  /** Verilmezse `uid()` ile üretilir. */
  id?: string
  tip: Bildirim['tip']
  kategori?: string | null
  baslik: string
  mesaj: string
  hedefKullaniciId?: string | null
  refId?: string | null
  refTip?: string | null
  /** Kullanıcı adı veya 'sistem' etiketi. */
  olusturan?: string | null
}

export interface ListeOpts {
  /** Sadece okunmamış bildirimler (`okundu = false`). */
  sadeceAcik?: boolean
  kategori?: string
  refId?: string
  refTip?: string
  hedefKullaniciId?: string
  /** Üst sınır; verilmezse Supabase varsayılan (1000) geçerli. */
  limit?: number
}

/** Bildirimleri listele (oluşturma tarihine göre azalan). */
export async function listBildirimler(opts: ListeOpts = {}): Promise<Bildirim[]> {
  let q = supabase.from(TABLO).select('*').order('olusturma', { ascending: false })

  if (opts.sadeceAcik) q = q.eq('okundu', false)
  if (opts.kategori) q = q.eq('kategori', opts.kategori)
  if (opts.refId) q = q.eq('ref_id', opts.refId)
  if (opts.refTip) q = q.eq('ref_tip', opts.refTip)
  if (opts.hedefKullaniciId) q = q.eq('hedef_kullanici_id', opts.hedefKullaniciId)
  q = q.limit(opts?.limit ?? 200)

  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return ((data ?? []) as Record<string, unknown>[]).map(toBildirim)
}

/** Tek bildirim id ile. */
export async function getBildirim(id: string): Promise<Bildirim | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return data ? toBildirim(data as Record<string, unknown>) : null
}

/** Yeni bildirim oluştur. baslik ve mesaj boş olamaz. */
export async function createBildirim(payload: BildirimInsert): Promise<Bildirim> {
  if (!payload.baslik?.trim()) throw new Error('Bildirim başlığı boş olamaz')
  if (!payload.mesaj?.trim()) throw new Error('Bildirim mesajı boş olamaz')

  const insertData: Record<string, unknown> = {
    id: payload.id ?? uid(),
    tip: payload.tip,
    kategori: norm.optStr(payload.kategori),
    baslik: payload.baslik.trim(),
    mesaj: payload.mesaj.trim(),
    hedef_kullanici_id: norm.optStr(payload.hedefKullaniciId),
    ref_id: norm.optStr(payload.refId),
    ref_tip: norm.optStr(payload.refTip),
    olusturan: norm.optStr(payload.olusturan),
  }

  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'insert' })
  return toBildirim(data as Record<string, unknown>)
}

/** Tek bildirimi okundu işaretle (okundu_tarih = now). */
export async function okunduIsaretle(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .update({ okundu: true, okundu_tarih: new Date().toISOString() })
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'update' })
}

/** Birden fazla bildirimi tek seferde okundu işaretle. ids boşsa no-op. */
export async function topluOkunduIsaretle(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from(TABLO)
    .update({ okundu: true, okundu_tarih: new Date().toISOString() })
    .in('id', ids)
  wrap(error, { table: TABLO, op: 'update' })
}

/**
 * Belirli (kategori, refId) çifti için açık (okunmamış) bildirim var mı?
 * Duplicate bildirim oluşturmamak için kullanılır.
 * Örn: MRP.tsx, aynı sipariş için tekrar "mrp_eksik" bildirimi açmaz.
 */
export async function acikBildirimVarMi(
  kategori: string,
  refId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('id')
    .eq('kategori', kategori)
    .eq('ref_id', refId)
    .eq('okundu', false)
    .limit(1)
  wrap(error, { table: TABLO, op: 'select' })
  return (data ?? []).length > 0
}

/** Tek bildirim sil. */
export async function deleteBildirim(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .delete()
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'delete' })
}
