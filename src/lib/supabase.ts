import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const _supabase = createClient(supabaseUrl, supabaseKey)

// Misafir modu — tüm yazma işlemlerini engelle
let _guestMode = false
export function setGuestMode(v: boolean) { _guestMode = v }
export function isGuestMode() { return _guestMode }

const BLOCKED = { data: null, error: { message: 'Misafir modunda değişiklik yapılamaz', code: 'GUEST_BLOCKED' } } as any

function guestBlock() {
  toast.error('🔒 Misafir modunda değişiklik yapılamaz')
  return Promise.resolve(BLOCKED)
}

// v15.37 — Test modu için insert/upsert'e test_run_id otomatik ekleme
// Hangi tablolara eklenecek (SQL migration'da test_run_id kolonu olanlar)
const TEST_RUN_TABLES = new Set([
  'uys_orders', 'uys_work_orders', 'uys_logs', 'uys_stok_hareketler',
  'uys_kesim_planlari', 'uys_tedarikler', 'uys_mrp_rezerve', 'uys_sevkler',
  'uys_fire_logs', 'uys_acik_barlar', 'uys_active_work',
])

function getActiveTestRunId(): string | null {
  try { return localStorage.getItem('uys_active_test_run_id') } catch { return null }
}

function attachTestRunId(table: string, payload: any): any {
  const trId = getActiveTestRunId()
  if (!trId || !TEST_RUN_TABLES.has(table)) return payload
  if (Array.isArray(payload)) {
    return payload.map(r => (r && typeof r === 'object' && !r.test_run_id) ? { ...r, test_run_id: trId } : r)
  }
  if (payload && typeof payload === 'object' && !payload.test_run_id) {
    return { ...payload, test_run_id: trId }
  }
  return payload
}

// Proxy: from() çağrısını yakala, insert/update/delete/upsert'i engelle
export const supabase = new Proxy(_supabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (table: string) => {
        const original = target.from(table)
        if (_guestMode) {
          return new Proxy(original, {
            get(t: any, p: string) {
              if (['insert', 'update', 'delete', 'upsert'].includes(p)) return () => guestBlock()
              return t[p]?.bind ? t[p].bind(t) : t[p]
            }
          })
        }
        // v15.37 — Aktif test run varsa insert/upsert'e test_run_id ekle
        return new Proxy(original, {
          get(t: any, p: string) {
            if (p === 'insert') {
              return (payload: any, opts?: any) => t.insert(attachTestRunId(table, payload), opts)
            }
            if (p === 'upsert') {
              return (payload: any, opts?: any) => t.upsert(attachTestRunId(table, payload), opts)
            }
            return t[p]?.bind ? t[p].bind(t) : t[p]
          }
        })
      }
    }
    const val = (target as any)[prop]
    return typeof val === 'function' ? val.bind(target) : val
  }
})

// v15.33: Supabase varsayılan olarak 1000 satır limit uygular.
// fetchAll sayfalar halinde 1000'lik bloklarda tüm satırları çeker.
// Kullanım: const { data, error } = await fetchAll('uys_stok_hareketler')
export async function fetchAll<T = any>(
  table: string,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  const all: T[] = []
  let from = 0
  // Güvenlik tavanı: 1M satıra kadar okur (pageSize 1000 ile 1000 tur)
  for (let i = 0; i < 1000; i++) {
    const to = from + pageSize - 1
    const { data, error } = await supabase.from(table).select('*').range(from, to)
    if (error) return { data: all, error }
    if (!data || !data.length) break
    all.push(...(data as T[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: all, error: null }
}
