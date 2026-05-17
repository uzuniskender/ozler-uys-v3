// src/services/tedarikciService.ts
// uys_tedarikciler için CRUD servisi.
//
// Özel durum: bu tablo store TABLE_MAP'te yer alır (global cache).
// Servis okumalar için de kullanılabilir; ancak sayfa genellikle store'dan okur,
// servis ağırlıklı olarak write path'i ve store dışı sorguları kapsar.
//
// not_ ↔ not: DB kolonu `not_`'tır (reserved word kaçışı); JS tipi `not` kullanır.
// Servis bu köprüyü dahili olarak kurar — çağıran her zaman `not` alanıyla çalışır.
//
// v17.00 — Servis katmanı Zod şemaları eklendi (tedarikci + tedarik CRUD giriş doğrulama)

import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { applyIlikeArama, norm } from '@/services/_base/query'
import { uid, today } from '@/lib/utils'
import { auditLog } from '@/services/auditService'
import type { Tedarikci } from '@/types'
import type { TedarikciInsert, TedarikciUpdate } from '@/types/tedarikci'

const TABLO = 'uys_tedarikciler'

// ─── Servis katmanı giriş şemaları ───────────────────────────────────────────

const _tedarikciInsertSchema = z.object({
  ad:    z.string().trim().min(1, 'Firma adı boş olamaz').max(100, 'Firma adı 100 karakter geçemez'),
  kod:   z.string().trim().max(20, 'Kod 20 karakter geçemez').optional(),
  adres: z.string().max(200, 'Adres 200 karakter geçemez').optional(),
  tel:   z.string().max(20, 'Tel 20 karakter geçemez').optional(),
  email: z.string().max(100, 'E-posta 100 karakter geçemez').optional(),
  not:   z.string().max(500, 'Not 500 karakter geçemez').optional(),
})

const _tedarikciUpdateSchema = _tedarikciInsertSchema.partial()

// uys_tedarikler (procurement order) giriş şeması
const _tedarikDbRowSchema = z.object({
  malkod:       z.string().trim().min(1, 'Malzeme kodu boş olamaz').max(50),
  malad:        z.string().max(200).optional(),
  miktar:       z.number().positive('Miktar sıfırdan büyük olmalı'),
  birim:        z.string().max(20).optional(),
  order_id:     z.string().nullable().optional(),
  siparis_no:   z.string().max(50).nullable().optional(),
  durum:        z.string().optional(),
  geldi:        z.boolean().optional(),
  teslim_tarihi: z.string().nullable().optional(),
  tedarikci_id: z.string().nullable().optional(),
  tedarikci_ad: z.string().max(100).nullable().optional(),
  not_:         z.string().max(500).nullable().optional(),
  tarih:        z.string().optional(),
})

// ─── Dahili yardımcılar ───────────────────────────────────────────────────────

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
  const parsed = _tedarikciInsertSchema.safeParse(payload)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const insertData = {
    id: payload.id ?? uid(),
    kod: norm.optStr(payload.kod),
    ad: norm.ad(parsed.data.ad),
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
  const parsed = _tedarikciUpdateSchema.safeParse(payload)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

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

// ─────────────────────────────────────────────────────────────────────────────
// Tedarik geldi/gelmedi iş akışları (lib/tedarikHelpers.ts'ten taşındı)
// ─────────────────────────────────────────────────────────────────────────────

/** Tedarik stok hareketi için deterministik ID — idempotency sağlar */
export function tedarikStokId(tedarikId: string) { return 'ted-' + tedarikId }

/**
 * Tedariki "geldi" işaretler ve stok girişi yazar.
 * Idempotent: aynı tedarik için 2 kez çağrılsa duplicate stok hareketi oluşmaz.
 */
export async function markTedarikGeldi(ted: {
  id: string; malkod: string; malad: string; miktar: number;
  siparisNo?: string; tedarikcAd?: string
}) {
  await supabase.from('uys_tedarikler').update({ geldi: true, durum: 'geldi' }).eq('id', ted.id)
  await supabase.from('uys_stok_hareketler').upsert({
    id: tedarikStokId(ted.id),
    tedarik_id: ted.id,
    tarih: today(), malkod: ted.malkod, malad: ted.malad,
    miktar: ted.miktar, tip: 'giris',
    aciklama: 'Tedarik girişi' + (ted.siparisNo ? ' — ' + ted.siparisNo : '') + (ted.tedarikcAd ? ' — ' + ted.tedarikcAd : ''),
  })
  auditLog({
    olay: 'tedarik_geldi',
    tablo: 'uys_tedarikler',
    kayitId: ted.id,
    alan: 'geldi',
    eskiDeger: 'false',
    yeniDeger: 'true',
    aciklama: `${ted.malkod} — ${ted.miktar} adet${ted.siparisNo ? ' (' + ted.siparisNo + ')' : ''}`,
    ekVeri: { malkod: ted.malkod, malad: ted.malad, miktar: ted.miktar, siparis_no: ted.siparisNo, tedarikci: ted.tedarikcAd },
  })
}

/** Tedariki "gelmedi" işaretler ve ilgili stok hareketini siler. */
export async function markTedarikGelmedi(tedarikId: string) {
  await supabase.from('uys_tedarikler').update({ geldi: false, durum: 'bekliyor' }).eq('id', tedarikId)
  await supabase.from('uys_stok_hareketler').delete().eq('id', tedarikStokId(tedarikId))
  auditLog({
    olay: 'tedarik_geldi',
    tablo: 'uys_tedarikler',
    kayitId: tedarikId,
    alan: 'geldi',
    eskiDeger: 'true',
    yeniDeger: 'false',
    aciklama: 'Tedarik "geldi" geri alındı',
  })
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

// ─────────────────────────────────────────────────────────────────────────────
// uys_tedarikler (procurement order) CRUD — Procurement.tsx için
// ─────────────────────────────────────────────────────────────────────────────
// Tipler snake_case (DB row) — Procurement.tsx zaten DB formatında veri üretiyor.

const TED_TABLO = 'uys_tedarikler'

/** Procurement INSERT/UPDATE payload — DB kolonları (snake_case). */
export interface TedarikDbRow {
  id?: string
  malkod: string
  malad?: string
  miktar: number
  birim?: string
  order_id?: string | null
  siparis_no?: string | null
  durum?: string
  geldi?: boolean
  teslim_tarihi?: string | null
  tedarikci_id?: string | null
  tedarikci_ad?: string | null
  not_?: string | null
  tarih?: string
}

/** Tedariki DB'den oku — id + order_id (cascade işlemler için). */
export async function getTedarik(id: string): Promise<{ id: string; order_id: string | null } | null> {
  const { data, error } = await supabase
    .from(TED_TABLO)
    .select('id, order_id')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TED_TABLO, op: 'select' })
  return data ? { id: data.id as string, order_id: (data.order_id as string) ?? null } : null
}

/** Yeni tedarik oluştur. */
export async function createTedarik(payload: TedarikDbRow): Promise<{ id: string }> {
  const parsed = _tedarikDbRowSchema.safeParse(payload)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)

  const id = payload.id ?? uid()
  const row = { ...payload, id, tarih: payload.tarih ?? today() }
  const { error } = await supabase.from(TED_TABLO).insert(row)
  wrap(error, { table: TED_TABLO, op: 'insert' })
  return { id }
}

/** Toplu tedarik insert (Excel import için). */
export async function createTedariklerBulk(list: TedarikDbRow[]): Promise<number> {
  if (!list.length) return 0
  // Her satırı doğrula — hata varsa satır bilgisiyle birlikte fırlat
  for (let i = 0; i < list.length; i++) {
    const p = _tedarikDbRowSchema.safeParse(list[i])
    if (!p.success) {
      const kod = list[i].malkod || `satır ${i + 1}`
      throw new Error(`Veri hatası (${kod}): ${p.error.issues[0]?.message}`)
    }
  }
  const today_ = today()
  const rows = list.map(p => ({ ...p, id: p.id ?? uid(), tarih: p.tarih ?? today_ }))
  const { error } = await supabase.from(TED_TABLO).insert(rows)
  wrap(error, { table: TED_TABLO, op: 'insert' })
  return rows.length
}

/** Mevcut tedariki güncelle. */
export async function updateTedarik(id: string, patch: Partial<TedarikDbRow>): Promise<void> {
  if (patch.miktar !== undefined && patch.miktar <= 0) throw new Error('Miktar sıfırdan büyük olmalı')
  const { error } = await supabase.from(TED_TABLO).update(patch).eq('id', id)
  wrap(error, { table: TED_TABLO, op: 'update' })
}

/**
 * Tedariki sil — cascade: stok hareketi (geldi ise) + bağlı sipariş mrp_durum invalidate.
 *
 * @param opts.stokSil — true ise tedarikStokId(id) hareketi de silinir (wasGeldi durumunda)
 */
export async function deleteTedarik(id: string, opts: { stokSil: boolean }): Promise<void> {
  // 1. order_id'yi DB'den al (state stale olabilir)
  const ted = await getTedarik(id)
  const orderId = ted?.order_id ?? null

  // 2. Stoktan ters kayıt sil (geldi durumda)
  if (opts.stokSil) {
    await supabase.from('uys_stok_hareketler').delete().eq('id', tedarikStokId(id))
  }

  // 3. Tedariki sil
  const { error } = await supabase.from(TED_TABLO).delete().eq('id', id)
  wrap(error, { table: TED_TABLO, op: 'delete' })

  // 4. Bağlı siparişin MRP durumunu invalidate et
  if (orderId) {
    const { updateOrderMrpDurum } = await import('@/services/orderService/orderCrud')
    await updateOrderMrpDurum(orderId, 'bekliyor')
  }
}
