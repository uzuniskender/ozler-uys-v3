/**
 * Standalone temizlik — test dışında elle çalıştırmak için
 * Kullanım: npm run test:e2e:cleanup
 */
import { config } from 'dotenv'
import { resolve } from 'path'

// .env.test yükle
config({ path: resolve(process.cwd(), '.env.test') })

import { cleanupTestData, supabaseTest, TEST_PREFIX } from './helpers'

async function main() {
  console.log('🧹 Test verisi temizliği başlıyor...')
  console.log('   Hedef DB:', process.env.VITE_SUPABASE_URL)
  console.log('   Prefix:', TEST_PREFIX, '\n')

  // Önce sayım
  const { count: before } = await supabaseTest
    .from('uys_work_orders')
    .select('*', { count: 'exact', head: true })
    .ilike('ie_no', `${TEST_PREFIX}%`)

  console.log(`   ${before || 0} test IE bulundu\n`)

  await cleanupTestData()

  // Sonra sayım
  const { count: after } = await supabaseTest
    .from('uys_work_orders')
    .select('*', { count: 'exact', head: true })
    .ilike('ie_no', `${TEST_PREFIX}%`)

  console.log(`✓ Temizlik tamamlandı. Kalan: ${after || 0}`)
}

main().catch(e => {
  console.error('❌ Hata:', e)
  process.exit(1)
})
