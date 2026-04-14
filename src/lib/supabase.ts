import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const _prodClient = createClient(supabaseUrl, supabaseKey)

// ═══ TEST MODU — Ayrı Supabase projesi ═══
function getTestClient(): SupabaseClient | null {
  try {
    if (localStorage.getItem('uys_test_mode') !== 'true') return null
    const testUrl = localStorage.getItem('uys_test_sb_url')
    const testKey = localStorage.getItem('uys_test_sb_key')
    if (!testUrl || !testKey) return null
    return createClient(testUrl, testKey)
  } catch { return null }
}

let _testClient: SupabaseClient | null = null
try {
  _testClient = getTestClient()
} catch { /* ignore */ }

function getActiveClient(): SupabaseClient {
  if (_testClient) return _testClient
  return _prodClient
}

// Test modunu yeniden yükle (sayfa yenilemeden)
export function reloadTestClient() {
  _testClient = getTestClient()
}

export function isTestMode(): boolean {
  return _testClient !== null
}

// Misafir modu — tüm yazma işlemlerini engelle
let _guestMode = false
export function setGuestMode(v: boolean) { _guestMode = v }
export function isGuestMode() { return _guestMode }

const BLOCKED = { data: null, error: { message: 'Misafir modunda değişiklik yapılamaz', code: 'GUEST_BLOCKED' } } as any

function guestBlock() {
  toast.error('🔒 Misafir modunda değişiklik yapılamaz')
  return Promise.resolve(BLOCKED)
}

// Proxy: from() çağrısını yakala, insert/update/delete/upsert'i engelle
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getActiveClient()
    if (prop === 'from') {
      return (table: string) => {
        const original = client.from(table)
        if (!_guestMode) return original
        return new Proxy(original, {
          get(t: any, p: string) {
            if (['insert', 'update', 'delete', 'upsert'].includes(p)) return () => guestBlock()
            return t[p]?.bind ? t[p].bind(t) : t[p]
          }
        })
      }
    }
    const val = (client as any)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  }
})
