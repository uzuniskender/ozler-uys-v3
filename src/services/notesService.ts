// src/services/notesService.ts
// uys_notes (Ekip Notları) için CRUD servisi.
//
// Bu tablonun created_by/updated_by audit kolonları yoktur; yazar bilgisi
// `yazan` alanında tutulur ve çağıran tarafından sağlanır.
// `_base/query.ts → auditAlanlari` bu nedenle KULLANILMAZ.

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { applyIlikeArama, norm } from '@/services/_base/query'
import { uid, today } from '@/lib/utils'
import type { EkipNot, EkipNotInsert, EkipNotUpdate } from '@/types/ekipNot'

const TABLO = 'uys_notes'

export interface ListeOpts {
  /** Sayfa path'ine göre filtrele (örn. '/orders'). */
  sayfa?: string
  /** baslik / icerik / yazan içinde ILIKE araması. */
  arama?: string
  /** Yeniden eskiye sırala (varsayılan true). */
  yeniyiOnce?: boolean
}

function currentHHMM(): string {
  const d = new Date()
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

/** Notları listele. */
export async function listNotes(opts: ListeOpts = {}): Promise<EkipNot[]> {
  const yeniyiOnce = opts.yeniyiOnce ?? true
  let q = supabase
    .from(TABLO)
    .select('*')
    .order('tarih', { ascending: !yeniyiOnce })
    .order('saat', { ascending: !yeniyiOnce })

  if (opts.sayfa) q = q.eq('sayfa', opts.sayfa)
  q = applyIlikeArama(q, opts.arama, ['baslik', 'icerik', 'yazan'])

  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return (data ?? []) as EkipNot[]
}

/** Tek not id ile. */
export async function getNote(id: string): Promise<EkipNot | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return (data as EkipNot | null) ?? null
}

/**
 * Yeni not oluştur.
 * - id verilmezse uid() ile üretilir.
 * - tarih verilmezse today() ile doldurulur.
 * - saat verilmezse o anki HH:MM ile doldurulur.
 * - etiketler verilmezse [] olur.
 */
export async function createNote(payload: EkipNotInsert): Promise<EkipNot> {
  const icerik = payload.icerik?.trim()
  if (!icerik) throw new Error('Not içeriği boş olamaz')
  if (!payload.sayfa) throw new Error('Not sayfası gerekli')

  const insertData = {
    id: payload.id ?? uid(),
    sayfa: payload.sayfa,
    baslik: norm.optStr(payload.baslik),
    icerik,
    yazan: norm.optStr(payload.yazan),
    etiketler: payload.etiketler ?? [],
    tarih: payload.tarih ?? today(),
    saat: payload.saat ?? currentHHMM(),
  }

  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'insert' })
  return data as EkipNot
}

/** Mevcut notu güncelle. Sadece geçirilen alanlar değişir. */
export async function updateNote(
  id: string,
  payload: EkipNotUpdate,
): Promise<EkipNot> {
  const updateData: Record<string, unknown> = {}
  if (payload.sayfa !== undefined) updateData.sayfa = payload.sayfa
  if (payload.baslik !== undefined) updateData.baslik = norm.optStr(payload.baslik)
  if (payload.icerik !== undefined) {
    const t = payload.icerik.trim()
    if (!t) throw new Error('Not içeriği boş olamaz')
    updateData.icerik = t
  }
  if (payload.yazan !== undefined) updateData.yazan = norm.optStr(payload.yazan)
  if (payload.etiketler !== undefined) updateData.etiketler = payload.etiketler

  const { data, error } = await supabase
    .from(TABLO)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'update' })
  return data as EkipNot
}

/** Notu sil. */
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .delete()
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'delete' })
}
