import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.test' })

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey) {
  throw new Error(
    '❌ .env.test eksik veya boş. VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY gerekli.'
  )
}

// Emniyet: Canlı Supabase'e bağlanma
if (url.includes('lmhcobrgrnvtprvmcito')) {
  throw new Error(
    '🚨 CANLI SUPABASE TESPIT EDİLDİ! .env.test ayrı test projesine ayarlanmalı.'
  )
}

/**
 * supabaseTest — anon key ile, frontend kullanımını simüle eder.
 * RLS politikaları geçerli; uys_kullanicilar/uys_operators üzerinde INSERT/UPDATE
 * çalışmaz (anon role yetkisiz). Frontend simülasyonu için tut.
 */
export const supabaseTest: SupabaseClient = createClient(url, anonKey)

/**
 * supabaseAdmin — service_role ile, RLS bypass eder.
 * v16.40 — Test fixtures (factory, cleanup) ve DB doğrulamaları admin kullanır.
 * Mevcut PROD davranışı: uys_kullanicilar (authenticated_only) ve uys_operators
 * (anon_select + authenticated_full) policy'leri anon UPDATE'e izin vermiyor;
 * test setup'ı service_role ile RLS'i geçici bypass eder.
 *
 * SUPABASE_SERVICE_ROLE_KEY .env.test'te yoksa anon'a fallback yap (uyarı bas).
 * Bu durumda RLS reddi olabilecek testler skip edilmeli.
 */
export const supabaseAdmin: SupabaseClient = (() => {
  if (!serviceKey) {
    console.warn(
      '⚠ SUPABASE_SERVICE_ROLE_KEY yok. RLS bypass çalışmayacak — anon fallback. ' +
      'TEST projesinden service_role key alıp .env.test\'e ekleyin.'
    )
    return supabaseTest
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
})()

export const TEST_URL = url
