import { supabaseTest } from './supabase'

/**
 * TEST-E2E-* prefix ile oluşturulan tüm kayıtları temizler.
 * FK sırası önemli: önce child, sonra parent.
 */
export const E2E_PREFIX = 'TEST-E2E-'

// Silme sırası: FK'ye saygı göster (leaf → root)
const CLEANUP_ORDER: Array<{ table: string; col: string }> = [
  // Child tables (İE/siparişe bağlı)
  { table: 'uys_fire_logs', col: 'wo_kod' },
  { table: 'uys_logs', col: 'wo_kod' },
  { table: 'uys_active_work', col: 'wo_kod' },
  { table: 'uys_operator_notes', col: 'wo_kod' },
  { table: 'uys_stok_hareketler', col: 'aciklama' },
  { table: 'uys_tedarikler', col: 'kod' },
  { table: 'uys_sevkler', col: 'sipariskod' },
  { table: 'uys_kesim_planlari', col: 'kod' },
  { table: 'uys_work_orders', col: 'kod' },
  // Parent tables
  { table: 'uys_orders', col: 'kod' },
  { table: 'uys_recipes', col: 'kod' },
  { table: 'uys_bom_trees', col: 'kod' },
  { table: 'uys_malzemeler', col: 'kod' },
  { table: 'uys_customers', col: 'ad' },
  { table: 'uys_operators', col: 'ad' },
  { table: 'uys_tedarikciler', col: 'ad' },
  { table: 'pt_problemler', col: 'tanim' },
]

/**
 * Tek tablo için prefix'e uyan kayıtları sil.
 */
async function cleanupTable(table: string, col: string): Promise<number> {
  try {
    const { data: before, error: selErr } = await supabaseTest
      .from(table)
      .select('id', { count: 'exact' })
      .ilike(col, `${E2E_PREFIX}%`)
    if (selErr) return 0
    if (!before || before.length === 0) return 0

    const { error: delErr } = await supabaseTest
      .from(table)
      .delete()
      .ilike(col, `${E2E_PREFIX}%`)
    if (delErr) {
      console.warn(`  ⚠ ${table}.${col} silme hatası: ${delErr.message}`)
      return 0
    }
    return before.length
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`  ⚠ ${table} atlandı: ${msg}`)
    return 0
  }
}

/**
 * Tüm TEST-E2E-* kayıtlarını temizle. Test başında ve sonunda çağrılır.
 */
export async function cleanupAllTestData(verbose = false): Promise<number> {
  let total = 0
  if (verbose) console.log('🧹 TEST-E2E-* temizlik başladı...')
  for (const { table, col } of CLEANUP_ORDER) {
    const n = await cleanupTable(table, col)
    if (n > 0) {
      total += n
      if (verbose) console.log(`  • ${table}: ${n} kayıt silindi`)
    }
  }
  if (verbose) console.log(`✅ Toplam ${total} test kaydı temizlendi`)
  return total
}
