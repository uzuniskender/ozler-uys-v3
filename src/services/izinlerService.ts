// src/services/izinlerService.ts
// uys_izinler için CRUD servisi.
//
// Onay/ret işlemleri onaylaIzin / reddetIzin olarak ayrı fonksiyonlarda —
// OperatorPanel.tsx'te inline update olan kalıpları sarar.
// not_ ↔ not, op_id ↔ opId vb. köprüsü toIzin() mapper'ında.

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { applyIlikeArama, norm } from '@/services/_base/query'
import { uid, today } from '@/lib/utils'
import type { Izin } from '@/types'
import type { IzinInsert, IzinUpdate, IzinDurum } from '@/types/izin'

const TABLO = 'uys_izinler'

// DB satırı → Izin (store mapper ile aynı mantık)
function toIzin(r: Record<string, unknown>): Izin {
  return {
    id: r.id as string,
    opId: (r.op_id || '') as string,
    opAd: (r.op_ad || '') as string,
    baslangic: (r.baslangic || '') as string,
    bitis: (r.bitis || '') as string,
    tip: (r.tip || '') as string,
    durum: (r.durum || '') as string,
    saatBaslangic: (r.saat_baslangic || '') as string,
    saatBitis: (r.saat_bitis || '') as string,
    onaylayan: (r.onaylayan || '') as string,
    onayTarihi: (r.onay_tarihi || '') as string,
    not: (r.not_ || '') as string,
    olusturan: (r.olusturan || '') as string,
  }
}

export interface ListeOpts {
  /** Belirli bir operatörün izinlerini getir. */
  opId?: string
  /** Durum filtresi (birden fazla olabilir). */
  durumlar?: IzinDurum[]
  /** opAd / tip içinde ILIKE araması. */
  arama?: string
  /** Yeniden eskiye sırala (varsayılan true). */
  yeniyiOnce?: boolean
}

/** İzinleri listele. */
export async function listIzinler(opts: ListeOpts = {}): Promise<Izin[]> {
  const yeniyiOnce = opts.yeniyiOnce ?? true
  let q = supabase
    .from(TABLO)
    .select('*')
    .order('baslangic', { ascending: !yeniyiOnce })

  if (opts.opId) q = q.eq('op_id', opts.opId)
  if (opts.durumlar && opts.durumlar.length > 0) q = q.in('durum', opts.durumlar)
  q = applyIlikeArama(q, opts.arama, ['op_ad', 'tip'])

  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return ((data ?? []) as Record<string, unknown>[]).map(toIzin)
}

/** Tek izin id ile. */
export async function getIzin(id: string): Promise<Izin | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return data ? toIzin(data as Record<string, unknown>) : null
}

/** Yeni izin talebi oluştur. */
export async function createIzin(payload: IzinInsert): Promise<Izin> {
  if (!payload.opId) throw new Error('Operatör ID gerekli')
  if (!payload.baslangic) throw new Error('Başlangıç tarihi gerekli')

  const insertData = {
    id: payload.id ?? uid(),
    op_id: payload.opId,
    op_ad: payload.opAd,
    baslangic: payload.baslangic,
    bitis: payload.bitis || payload.baslangic,
    tip: payload.tip ?? 'yıllık',
    durum: 'bekliyor',
    saat_baslangic: norm.optStr(payload.saatBaslangic),
    saat_bitis: norm.optStr(payload.saatBitis),
    onaylayan: '',
    onay_tarihi: '',
    not_: norm.optStr(payload.not),
    olusturan: payload.olusturan ?? 'operator',
  }

  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()

  wrap(error, { table: TABLO, op: 'insert' })
  return toIzin(data as Record<string, unknown>)
}

/**
 * Mevcut izni düzenle (tarih, tip, saat, not, durum).
 * Operators.tsx IzinFormModal onSave/_update dalını sarar.
 * Yalnızca verilen alanlar güncellenir.
 */
export async function updateIzin(id: string, payload: IzinUpdate): Promise<void> {
  const updateData: Record<string, unknown> = {}
  if (payload.baslangic !== undefined) updateData.baslangic = payload.baslangic
  if (payload.bitis !== undefined) updateData.bitis = payload.bitis
  if (payload.tip !== undefined) updateData.tip = payload.tip
  if (payload.saatBaslangic !== undefined) updateData.saat_baslangic = norm.optStr(payload.saatBaslangic)
  if (payload.saatBitis !== undefined) updateData.saat_bitis = norm.optStr(payload.saatBitis)
  if (payload.not !== undefined) updateData.not_ = norm.optStr(payload.not)
  if (payload.durum !== undefined) updateData.durum = payload.durum

  const { error } = await supabase
    .from(TABLO)
    .update(updateData)
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'update' })
}

/** İzni onayla. OperatorPanel'deki inline update'i sarar. */
export async function onaylaIzin(id: string, onaylayan: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .update({ durum: 'onaylandi', onaylayan, onay_tarihi: today() })
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'update' })
}

/** İzni reddet. OperatorPanel'deki inline update'i sarar. */
export async function reddetIzin(id: string, onaylayan: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .update({ durum: 'reddedildi', onaylayan, onay_tarihi: today() })
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'update' })
}

/** İzni sil. */
export async function deleteIzin(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .delete()
    .eq('id', id)
  wrap(error, { table: TABLO, op: 'delete' })
}
