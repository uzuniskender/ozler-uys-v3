/**
 * v15.75 — Activity Log (İş Emri #13 madde 14)
 *
 * Eski sürüm: localStorage (max 200 kayıt, cihaz-bazlı)
 * Yeni sürüm: uys_activity_log tablosu (server-wide, sınırsız)
 *
 * logAction() çağrılınca:
 *   1. DB'ye yazar (öncelik)
 *   2. localStorage'a da yazar (offline fallback + hızlı son-N erişim)
 *
 * Eski API geriye uyumlu — caller'lar değişmedi.
 */

import { supabase } from './supabase'
import { uid } from './utils'

const LOG_KEY = 'uys_activity_log'
const MAX_LOGS = 200

export interface ActivityEntry {
  ts: string
  user: string
  action: string
  detail: string
}

export interface ActivityLogRow {
  id: string
  ts: string
  kullanici: string
  aksiyon: string
  detay: string
  modul: string | null
  order_id: string | null
  wo_id: string | null
  malkod: string | null
}

export interface ActivityLogRefs {
  modul?: 'siparis' | 'ie' | 'kesim' | 'mrp' | 'tedarik' | 'stok' | 'sevk' | 'recete' | 'malzeme' | 'operator' | 'sistem' | 'yedek'
  orderId?: string
  woId?: string
  malkod?: string
}

function getCurrentUser(): string {
  try {
    const authStr = localStorage.getItem('uys_v3_auth')
    return authStr ? (JSON.parse(authStr).username || 'admin') : 'system'
  } catch { return 'system' }
}

function writeLocalCache(action: string, detail: string) {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    const logs: ActivityEntry[] = stored ? JSON.parse(stored) : []
    logs.unshift({
      ts: new Date().toISOString().slice(0, 19).replace('T', ' '),
      user: getCurrentUser(), action, detail,
    })
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
    localStorage.setItem(LOG_KEY, JSON.stringify(logs))
  } catch {}
}

/** Eski API (geriye uyumlu). Modül 'sistem' atanır. */
export function logAction(action: string, detail: string = '') {
  writeLocalCache(action, detail)
  void supabase.from('uys_activity_log').insert({
    id: uid(),
    kullanici: getCurrentUser(),
    aksiyon: action,
    detay: detail,
    modul: 'sistem',
  }).then(({ error }) => {
    if (error) console.warn('[v15.75 logAction] DB yazma fail:', error.message)
  })
}

/** Yeni API — modül + referanslarla log yazar. */
export function logActionExt(action: string, detail: string, refs?: ActivityLogRefs) {
  writeLocalCache(action, detail)
  void supabase.from('uys_activity_log').insert({
    id: uid(),
    kullanici: getCurrentUser(),
    aksiyon: action,
    detay: detail,
    modul: refs?.modul || 'sistem',
    order_id: refs?.orderId || null,
    wo_id: refs?.woId || null,
    malkod: refs?.malkod || null,
  }).then(({ error }) => {
    if (error) console.warn('[v15.75 logActionExt] DB yazma fail:', error.message)
  })
}

/** Eski localStorage cache'i (hızlı UI için, max 200). */
export function getActivityLog(): ActivityEntry[] {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export interface ActivityLogFilter {
  ts_min?: string
  ts_max?: string
  kullanici?: string
  modul?: string
  orderId?: string
  woId?: string
  malkod?: string
  searchText?: string
  limit?: number
  offset?: number
}

/** DB'den filtreli sorgu. Logs.tsx ana sayfası kullanır. */
export async function getDbActivityLog(filter: ActivityLogFilter = {}): Promise<ActivityLogRow[]> {
  let q = supabase.from('uys_activity_log').select('*').order('ts', { ascending: false })
  if (filter.ts_min) q = q.gte('ts', filter.ts_min)
  if (filter.ts_max) q = q.lte('ts', filter.ts_max)
  if (filter.kullanici) q = q.eq('kullanici', filter.kullanici)
  if (filter.modul) q = q.eq('modul', filter.modul)
  if (filter.orderId) q = q.eq('order_id', filter.orderId)
  if (filter.woId) q = q.eq('wo_id', filter.woId)
  if (filter.malkod) q = q.eq('malkod', filter.malkod)
  if (filter.searchText) {
    const pattern = `%${filter.searchText}%`
    q = q.or(`aksiyon.ilike.${pattern},detay.ilike.${pattern}`)
  }
  const limit = filter.limit ?? 200
  const offset = filter.offset ?? 0
  q = q.range(offset, offset + limit - 1)
  const { data, error } = await q
  if (error) {
    console.warn('[v15.75 getDbActivityLog] fetch fail:', error.message)
    return []
  }
  return (data || []) as ActivityLogRow[]
}

/** localStorage cache temizle (DB kayıtları silinmez). */
export function clearActivityLog() {
  localStorage.removeItem(LOG_KEY)
}
