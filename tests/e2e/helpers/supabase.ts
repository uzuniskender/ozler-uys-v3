import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.test' })

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
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

export const supabaseTest: SupabaseClient = createClient(url, key)
export const TEST_URL = url
