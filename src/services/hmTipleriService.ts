// src/services/hmTipleriService.ts
// HM Tipleri için Supabase CRUD servisi.

import { supabase } from '@/lib/supabase'
import type {
  HmTipi,
  HmTipiInsert,
  HmTipiUpdate,
} from '@/types/hmTipi'

const TABLO = 'uys_hm_tipleri'

export interface ListeOpts {
  /** true verilirse sadece aktif tipler döner */
  sadeceAktif?: boolean
  /** Arama (kod, ad, açıklama içinde ILIKE) */
  arama?: string
}

/** Tüm tipleri listele (varsayılan: hepsini, sıra/ad'a göre) */
export async function listHmTipleri(opts: ListeOpts = {}): Promise<HmTipi[]> {
  let q = supabase
    .from(TABLO)
    .select('*')
    .order('sira', { ascending: true })
    .order('ad',   { ascending: true })

  if (opts.sadeceAktif) {
    q = q.eq('aktif', true)
  }

  if (opts.arama && opts.arama.trim().length >= 1) {
    const term = `%${opts.arama.trim()}%`
    q = q.or(`kod.ilike.${term},ad.ilike.${term},aciklama.ilike.${term}`)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as HmTipi[]
}

/** Tek kayıt id ile */
export async function getHmTipi(id: string): Promise<HmTipi | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as HmTipi | null) ?? null
}

/** Tek kayıt kod ile */
export async function getHmTipiByKod(kod: string): Promise<HmTipi | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('kod', kod.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return (data as HmTipi | null) ?? null
}

/** Yeni HM tipi oluştur */
export async function createHmTipi(
  payload: HmTipiInsert,
  kullaniciAd?: string | null,
): Promise<HmTipi> {
  const insertData: HmTipiInsert = {
    ...payload,
    kod: payload.kod.toUpperCase().trim(),
    ad: payload.ad.trim(),
    aciklama: payload.aciklama?.trim() || null,
    created_by: kullaniciAd ?? null,
  }

  const { data, error } = await supabase
    .from(TABLO)
    .insert(insertData)
    .select()
    .single()

  if (error) throw error
  return data as HmTipi
}

/** Mevcut HM tipini güncelle */
export async function updateHmTipi(
  id: string,
  payload: HmTipiUpdate,
  kullaniciAd?: string | null,
): Promise<HmTipi> {
  const updateData: HmTipiUpdate = {
    ...payload,
    updated_by: kullaniciAd ?? null,
  }
  if (payload.kod !== undefined) {
    updateData.kod = payload.kod.toUpperCase().trim()
  }
  if (payload.ad !== undefined) {
    updateData.ad = payload.ad.trim()
  }
  if (payload.aciklama !== undefined) {
    updateData.aciklama = payload.aciklama?.trim() || null
  }

  const { data, error } = await supabase
    .from(TABLO)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as HmTipi
}

/** Aktif/Pasif durumu tersine çevir */
export async function togglePasif(
  id: string,
  kullaniciAd?: string | null,
): Promise<HmTipi> {
  const mevcut = await getHmTipi(id)
  if (!mevcut) throw new Error('HM tipi bulunamadı')
  return updateHmTipi(id, { aktif: !mevcut.aktif }, kullaniciAd)
}

/** Kalıcı silme (sadece Admin) — bağlı kayıtlar varsa Supabase FK hatası döner */
export async function deleteHmTipi(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLO)
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Kod çakışma kontrolü (form validation için) */
export async function kodVarMi(
  kod: string,
  haricId?: string,
): Promise<boolean> {
  let q = supabase
    .from(TABLO)
    .select('id', { count: 'exact', head: true })
    .eq('kod', kod.toUpperCase().trim())
  if (haricId) q = q.neq('id', haricId)
  const { count, error } = await q
  if (error) throw error
  return (count ?? 0) > 0
}
