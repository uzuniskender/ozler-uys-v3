/**
 * MRP Cache (v16.31 — IE #14 Faz A Slice 2)
 *
 * uys_mrp_state_global ve uys_mrp_state_order tablolarını okuyup yazar.
 * DB-seviye trigger'lar (Slice 1) DB değiştikçe invalidated=true setler;
 * bu modül cache'i okuyup hesap atlatır veya yazar.
 *
 * Mimari karar (Bilgi Bankası §29.x — sonraki güncellemede):
 * - Test modu (uys_active_test_run_id dolu) -> cache TAM by-pass.
 *   Sebep: test koşusu cache'i kirletebilir, üretim sahası yanlış cache okur.
 * - TTL koruyucu (5 dk): trigger fail durumunda emniyet supabı.
 *   invalidated=false AND hesaplandi > now-5dk -> cache HIT.
 *
 * Mevcut export'lar (Slice 2):
 *   getMrpCacheGlobal()           — global cache satırını oku
 *   setMrpCacheGlobal(rows)       — global cache satırını yaz, invalidated=false
 *   getMrpCacheOrder(orderId)     — order bazlı cache oku
 *   setMrpCacheOrder(orderId, r)  — order bazlı cache yaz
 *   clearMrpCacheAll()            — debug/admin aracı (forced refresh)
 *
 * Slice 3'te tüketici sayfaları hesaplaMRPCached wrapper'ını kullanmaya başlar.
 */

import { supabase, getActiveTestRunId } from '@/lib/supabase'
import type { MRPRow } from './mrp'

// 5 dk koruyucu TTL — trigger fail durumunda emniyet supabı.
// invalidated=false ve hesaplandi yeni değilse cache kabul etme (defansif).
const CACHE_MAX_AGE_MS = 5 * 60 * 1000

export interface MrpCacheEntry {
  rows: MRPRow[]
  hesaplandi: Date
  invalidated: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// İç yardımcılar
// ─────────────────────────────────────────────────────────────────────────────

function inTestMode(): boolean {
  return getActiveTestRunId() != null
}

function isFresh(invalidated: boolean, hesaplandi: Date | null): boolean {
  if (invalidated) return false
  if (!hesaplandi) return false
  const age = Date.now() - hesaplandi.getTime()
  return age >= 0 && age < CACHE_MAX_AGE_MS
}

function parseHesaplandi(raw: string | null | undefined): Date | null {
  if (!raw) return null
  try {
    const d = new Date(raw)
    return isNaN(d.getTime()) ? null : d
  } catch { return null }
}

function extractRows(detay: any): MRPRow[] {
  if (!detay || typeof detay !== 'object') return []
  const r = (detay as any).rows
  return Array.isArray(r) ? (r as MRPRow[]) : []
}

// ─────────────────────────────────────────────────────────────────────────────
// Global cache
// ─────────────────────────────────────────────────────────────────────────────

export async function getMrpCacheGlobal(): Promise<MrpCacheEntry | null> {
  if (inTestMode()) return null

  const { data, error } = await supabase
    .from('uys_mrp_state_global')
    .select('detay, hesaplandi, invalidated')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) return null

  const hesaplandi = parseHesaplandi(data.hesaplandi as any)
  const invalidated = Boolean(data.invalidated)
  if (!isFresh(invalidated, hesaplandi)) return null

  return {
    rows: extractRows(data.detay),
    hesaplandi: hesaplandi as Date,
    invalidated,
  }
}

export async function setMrpCacheGlobal(rows: MRPRow[]): Promise<void> {
  if (inTestMode()) return  // test modunda yazma yok (cache kirlenmesin)

  const { error } = await supabase
    .from('uys_mrp_state_global')
    .update({
      detay: { rows },
      invalidated: false,
      hesaplandi: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) {
    // Cache yazımı asla asıl akışı bozmamalı — sadece log.
    console.warn('[mrpCache] global yazim basarisiz:', error.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order bazlı cache
// ─────────────────────────────────────────────────────────────────────────────

export async function getMrpCacheOrder(orderId: string): Promise<MrpCacheEntry | null> {
  if (inTestMode()) return null
  if (!orderId) return null

  const { data, error } = await supabase
    .from('uys_mrp_state_order')
    .select('detay, hesaplandi, invalidated')
    .eq('order_id', orderId)
    .maybeSingle()

  if (error || !data) return null

  const hesaplandi = parseHesaplandi(data.hesaplandi as any)
  const invalidated = Boolean(data.invalidated)
  if (!isFresh(invalidated, hesaplandi)) return null

  return {
    rows: extractRows(data.detay),
    hesaplandi: hesaplandi as Date,
    invalidated,
  }
}

export async function setMrpCacheOrder(orderId: string, rows: MRPRow[]): Promise<void> {
  if (inTestMode()) return
  if (!orderId) return

  const nowIso = new Date().toISOString()
  // UPSERT: cache satırı yoksa oluştur, varsa güncelle
  const { error } = await supabase
    .from('uys_mrp_state_order')
    .upsert({
      order_id: orderId,
      detay: { rows },
      invalidated: false,
      hesaplandi: nowIso,
      updated_at: nowIso,
    }, { onConflict: 'order_id' })

  if (error) {
    // FK ihlali (order_id uys_orders'da yok) durumunda burada error gelir.
    // Bu hata yumuşak — UI etkilenmez.
    console.warn('[mrpCache] order yazim basarisiz:', orderId, error.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / debug
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm cache'i bayatla (forced refresh). Genelde sahada kullanılmaz; debug için.
 * Trigger'lar normal akışta zaten invalidate ediyor.
 */
export async function clearMrpCacheAll(): Promise<void> {
  if (inTestMode()) return

  const nowIso = new Date().toISOString()
  await supabase
    .from('uys_mrp_state_global')
    .update({ invalidated: true, updated_at: nowIso })
    .eq('id', 1)

  await supabase
    .from('uys_mrp_state_order')
    .update({ invalidated: true, updated_at: nowIso })
    .gte('order_id', '')  // tüm satırlar (Supabase WHERE zorunlu)
}

/**
 * Sadece order bazlı cache'leri bayatla — global dokunulmaz.
 * v16.89 DB trigger (fn_stok_invalidate_mrp_state) ile aynı mantık: blanket invalidation.
 * Stok dışı TS akışlarından (örn. toplu tüketim) manuel tetiklemek için.
 */
export async function invalidateMrpOrderCacheAll(): Promise<void> {
  if (inTestMode()) return

  const { error } = await supabase
    .from('uys_mrp_state_order')
    .update({ invalidated: true, updated_at: new Date().toISOString() })
    .gte('order_id', '')  // tüm satırlar (Supabase WHERE zorunlu)

  if (error) {
    console.warn('[mrpCache] order cache invalidation basarisiz:', error.message)
  }
}
