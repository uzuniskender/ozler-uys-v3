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

// Proxy: from() çağrısını yakala, insert/update/delete/upsert'i engelle
export const supabase = new Proxy(_supabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (table: string) => {
        const original = target.from(table)
        if (!_guestMode) return original
        return new Proxy(original, {
          get(t: any, p: string) {
            if (['insert', 'update', 'delete', 'upsert'].includes(p)) return () => guestBlock()
            return t[p]?.bind ? t[p].bind(t) : t[p]
          }
        })
      }
    }
    const val = (target as any)[prop]
    return typeof val === 'function' ? val.bind(target) : val
  }
})
