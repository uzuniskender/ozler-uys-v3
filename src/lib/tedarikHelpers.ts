import { supabase } from '@/lib/supabase'
import { today } from '@/lib/utils'

/** Tedarik stok hareketi için deterministik ID — idempotency sağlar */
export function tedarikStokId(tedarikId: string) { return 'ted-' + tedarikId }

/**
 * Tedariki "geldi" işaretler ve stok girişi yazar.
 * Idempotent: aynı tedarik için 2 kez çağrılsa duplicate stok hareketi oluşmaz
 * (deterministik ID 'ted-{tedId}' ile upsert kullanır).
 */
export async function markTedarikGeldi(ted: {
  id: string; malkod: string; malad: string; miktar: number;
  siparisNo?: string; tedarikcAd?: string
}) {
  // 1. Tedariki güncelle
  await supabase.from('uys_tedarikler').update({ geldi: true, durum: 'geldi' }).eq('id', ted.id)
  // 2. Stok hareketi — deterministik ID ile upsert (duplicate önleme)
  await supabase.from('uys_stok_hareketler').upsert({
    id: tedarikStokId(ted.id),
    tarih: today(), malkod: ted.malkod, malad: ted.malad,
    miktar: ted.miktar, tip: 'giris',
    aciklama: 'Tedarik girişi' + (ted.siparisNo ? ' — ' + ted.siparisNo : '') + (ted.tedarikcAd ? ' — ' + ted.tedarikcAd : ''),
  })
}

/**
 * Tedariki "gelmedi" işaretler ve ilgili stok hareketini siler.
 * Kullanım: yanlışlıkla geldi işaretlendi, geri alınmak istendiğinde.
 */
export async function markTedarikGelmedi(tedarikId: string) {
  await supabase.from('uys_tedarikler').update({ geldi: false, durum: 'bekliyor' }).eq('id', tedarikId)
  await supabase.from('uys_stok_hareketler').delete().eq('id', tedarikStokId(tedarikId))
}
