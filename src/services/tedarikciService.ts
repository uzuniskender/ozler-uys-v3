// src/services/tedarikciService.ts
// uys_tedarikciler için CRUD servisi.
//
// Özel durum: bu tablo store TABLE_MAP'te yer alır (global cache).
// Servis okumalar için de kullanılabilir; ancak sayfa genellikle store'dan okur,
// servis ağırlıklı olarak write path'i ve store dışı sorguları kapsar.
//
// not_ ↔ not: DB kolonu `not_`'tır (reserved word kaçışı); JS tipi `not` kullanır.
// Servis bu köprüyü dahili olarak kurar — çağıran her zaman `not` alanıyla çalışır.

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { applyIlikeArama, norm } from '@/services/_base/query'
import { uid } from '@/lib/utils'
import type { Tedarikci } from '@/types'
import type { TedarikciInsert, TedarikciUpdate } from '@/types/tedarikci'

const TABLO = 'uys_tedarikciler'

// DB satırı → Tedarikci (store tipiyle uyumlu)
function toTedarikci(r: Record<string, unknown>): Tedarikci {
  return {
    id: r.id as string,
    kod: (r.kod as string) || '',
    ad: (r.ad as string) || '',
    adres: (r.adres as string) || '',
    tel: (r.tel as string) || '',
    email: (r.email as string) || '',
    not: (r.not_ as string) || '',
  }
}

export interface ListeOpts {
  /** kod / ad / email içinde ILIKE araması. */
  arama?: string
}

/** Tüm tedarikçileri listele (ada göre sıralı). */
export async function listTedarikciler(opts: ListeOpts = {}): Promise<Tedarikci[]> {
  let q = supabase.from(TABLO).select('*').order('ad', { ascending: true })
  q = applyIlikeArama(q, opts.arama, ['kod', 'ad', 'email'])

  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return ((data ?? []) as Record<string, unknown>[]).map(toTedarikci)
}

/** Tek tedarikçi id ile. */
export async function getTedarikci(id: string): Promise<Tedarikci | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return data ? toTedarikci(data as Record<string, unknown>) : null
}

/** Tek tedarikçi kod ile. */
export async function getTedarikciByKod(kod: string): Promise<Tedarikci | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('kod', norm.kod(kod))
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return data ? toTedarikci(data as Record<string, unknown>) : null
}

/** Yeni tedarikçi oluştur. */
export async function createTedarikci(payload: TedarikciInsert): Promise<Tedarikci> {
  if (!payload.ad?.trim()) throw new Error('Firma adı boş olamaz')

  const insertData = {
    id: payload.id ?? uid(),
    kod: norm.optStr(payload.kod),
    ad: norm.ad(payload.ad),
    adres: norm.optStr(payload.adres),
    tel: norm.optStr(payload.tel),
    email: norm.optStr(payload.email),
    not_: norm.optStr(payload.not),
  }

  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'insert' })
  return toTedarikci(data as Record<string, unknown>)
}

/** Mevcut tedarikçiyi güncelle. */
export async function updateTedarikci(
  id: string,
  payload: TedarikciUpdate,
): Promise<Tedarikci> {
  const updateData: Record<string, unknown> = {}
  if (payload.kod !== undefined) updateData.kod = norm.optStr(payload.kod)
  if (payload.ad !== undefined) {
    const t = payload.ad.trim()
    if (!t) throw new Error('Firma adı boş olamaz')
    updateData.ad = t
  }
  if (payload.adres !== undefined) updateData.adres = norm.optStr(payload.adres)
  if (payload.tel !== undefined) updateData.tel = norm.optStr(payload.tel)
  if (payload.email !== undefined) updateData.email = norm.optStr(payload.email)
  if (payload.not !== undefined) updateData.not_ = norm.optStr(payload.not)

  const { data, error } = await supabase
    .from(TABLO)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'update' })
  return toTedarikci(data as Record<string, unknown>)
}

/** Tedarikçiyi sil. */
export async function deleteTedarikci(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .delete()
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'delete' })
}

/** Kod çakışma kontrolü (form validasyonu için). */
export async function kodVarMi(
  kod: string,
  haricId?: string,
): Promise<boolean> {
  let q = supabase
    .from(TABLO)
    .select('id', { count: 'exact', head: true })
    .eq('kod', norm.kod(kod))
  if (haricId) q = q.neq('id', haricId)
  const { count, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return (count ?? 0) > 0
}
