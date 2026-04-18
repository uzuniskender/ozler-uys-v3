import { cleanupAllTestData } from './helpers/cleanup'
import { TEST_URL } from './helpers/supabase'

/**
 * Playwright globalTeardown — tüm suite bittikten sonra çalışır.
 * Yarım kalan test kayıtlarını temizler.
 * Aynı zamanda `npm run test:e2e:cleanup` ile manuel çağrılabilir.
 */
async function main() {
  console.log('')
  console.log('═══════════════════════════════════════════════')
  console.log('🧹 E2E Global Teardown — Test verisi temizleniyor')
  console.log(`   Supabase: ${TEST_URL}`)
  console.log('═══════════════════════════════════════════════')
  const n = await cleanupAllTestData(true)
  console.log('═══════════════════════════════════════════════')
  console.log(`✅ Bitti. ${n} kayıt silindi.`)
  console.log('')
}

// Playwright çağırırken default export bekler, tsx ile çağırınca direkt çalıştır
const scriptPath = process.argv[1] ?? ''
if (
  scriptPath.includes('run-cleanup') &&
  !scriptPath.includes('playwright')
) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}

export default main
