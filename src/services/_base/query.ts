// src/services/_base/query.ts
// Service katmanı için ortak query builder yardımcıları.
//
// Kalıplar hmTipleriService.ts'den çıkarıldı. Yeni servisler bu helper'ları
// kullanarak tekrarlı kodu engellemeli.
//
// Bilinçli sadelik: helper'lar generic <T> ile döner; çağıran chaining'i
// kaybetmez. Supabase tipi ile sıkı eşleştirme yapmıyoruz — Supabase
// builder API'sinde minor sürüm farkları olabilir, gevşek bağ daha sağlam.

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ILIKE OR — birden fazla alanda büyük/küçük harfsiz arama uygular.
 *
 *   q = applyIlikeArama(q, opts.arama, ['kod', 'ad', 'aciklama'])
 *
 * Kurallar:
 * - `term` null/undefined/boş ise filtre uygulanmaz, query aynen döner.
 * - Trim ve `%term%` sarımı içeride yapılır.
 * - `fields` listesi boşsa filtre uygulanmaz.
 */
export function applyIlikeArama<T>(
  query: T,
  term: string | null | undefined,
  fields: readonly string[],
): T {
  const t = term?.trim()
  if (!t || fields.length === 0) return query
  const pattern = `%${t}%`
  const orExpr = fields.map((f) => `${f}.ilike.${pattern}`).join(',')
  return (query as any).or(orExpr) as T
}

/**
 * `aktif=true` filtresi — `sadeceAktif` true ise uygulanır.
 * Diğer durumlarda (false/undefined) query'e dokunmaz; pasif kayıtlar da gelir.
 */
export function applyAktifFiltre<T>(
  query: T,
  sadeceAktif: boolean | undefined,
): T {
  if (!sadeceAktif) return query
  return (query as any).eq('aktif', true) as T
}

/**
 * Audit alanları payload'ı — create ve update için ortak.
 *
 *   const insertData = { ...payload, ...auditAlanlari(kullaniciAd, 'create') }
 *   const updateData = { ...payload, ...auditAlanlari(kullaniciAd, 'update') }
 *
 * `kullaniciAd` null/undefined ise DB'ye `null` yazılır (eski davranışla uyumlu).
 */
export function auditAlanlari(
  kullaniciAd: string | null | undefined,
  mode: 'create',
): { created_by: string | null }
export function auditAlanlari(
  kullaniciAd: string | null | undefined,
  mode: 'update',
): { updated_by: string | null }
export function auditAlanlari(
  kullaniciAd: string | null | undefined,
  mode: 'create' | 'update',
): { created_by: string | null } | { updated_by: string | null } {
  const val = kullaniciAd ?? null
  return mode === 'create' ? { created_by: val } : { updated_by: val }
}

/**
 * String normalizasyon — kod alanı (upper + trim) ve ad alanı (trim).
 * Servis input normalizasyonunu tek yerde tutmak için.
 */
export const norm = {
  kod: (v: string): string => v.toUpperCase().trim(),
  ad: (v: string): string => v.trim(),
  /** Boş string'i null'a çevirir; trim sonrası boş kalırsa null döner. */
  optStr: (v: string | null | undefined): string | null => {
    if (v == null) return null
    const t = v.trim()
    return t.length ? t : null
  },
}
