/**
 * v15.54 Adım 1 — Sevkiyat Yardımcıları
 * ─────────────────────────────────────────────────────────────────────────
 * Faz 1 kapsamı: Sadece nextSevkNo() helper.
 * Faz 2 (sonraki oturum) kapsamı:
 *   - createSevk(): atomic insert (uys_sevkler + uys_sevk_satirlari + uys_stok_hareketler)
 *   - calcOrderKalan(): sipariş bazlı kalan miktar hesabı (orders.urunler jsonb'den)
 *   - cancelSevk(): iptal + stok geri alma
 */

import { supabase } from './supabase'

/**
 * Sıradaki sevk numarasını döner. Format: SEV-YYYY-NNNN (örn. SEV-2026-0042)
 *
 * Mantık: Bu yıla ait son sevk numarasını bul, +1 yap, 4 haneli pad'le.
 * Yıl başında sayaç sıfırlanır (yeni yıl prefix'i farklı).
 *
 * NOT: Bu fonksiyon yarış durumuna (race condition) karşı KORUMASIZ —
 * iki kullanıcı aynı anda çağırırsa aynı no'yu alabilir.
 * Faz 2'de RPC fonksiyonu içinde tek transaction olarak çağrılacak,
 * UNIQUE constraint (idx_uys_sevkler_sevk_no_unique) çakışmayı engelleyecek.
 */
export async function nextSevkNo(): Promise<string> {
  const yil = new Date().getFullYear()
  const prefix = `SEV-${yil}-`

  const { data, error } = await supabase
    .from('uys_sevkler')
    .select('sevk_no')
    .like('sevk_no', `${prefix}%`)
    .order('sevk_no', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return `${prefix}0001`
  }

  const lastNo = data[0].sevk_no as string
  // SEV-2026-0042 → 0042 → 42
  const lastNum = parseInt(lastNo.slice(prefix.length), 10) || 0
  const nextNum = lastNum + 1
  return `${prefix}${String(nextNum).padStart(4, '0')}`
}

/**
 * Bir sevk numarasının formatı doğru mu kontrol et.
 * Faz 2'de düzenleme akışında kullanılır.
 */
export function isValidSevkNo(s: string): boolean {
  return /^SEV-\d{4}-\d{4}$/.test(s)
}
