import { supabase } from '@/lib/supabase'
import { today } from '@/lib/utils'
import { auditLog } from '@/lib/audit'

/** Tedarik stok hareketi için deterministik ID — idempotency sağlar */
export function tedarikStokId(tedarikId: string) { return 'ted-' + tedarikId }

/**
 * Tedariki "geldi" işaretler ve stok girişi yazar.
 * Idempotent: aynı tedarik için 2 kez çağrılsa duplicate stok hareketi oluşmaz
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
    tedarik_id: ted.id,
    tarih: today(), malkod: ted.malkod, malad: ted.malad,
    miktar: ted.miktar, tip: 'giris',
    aciklama: 'Tedarik girişi' + (ted.siparisNo ? ' — ' + ted.siparisNo : '') + (ted.tedarikcAd ? ' — ' + ted.tedarikcAd : ''),
  })
  // 3. Audit log
  auditLog({
    olay: 'tedarik_geldi',
    tablo: 'uys_tedarikler',
    kayitId: ted.id,
    alan: 'geldi',
    eskiDeger: 'false',
    yeniDeger: 'true',
    aciklama: `${ted.malkod} — ${ted.miktar} adet${ted.siparisNo ? ' (' + ted.siparisNo + ')' : ''}`,
    ekVeri: {
      malkod: ted.malkod,
      malad: ted.malad,
      miktar: ted.miktar,
      siparis_no: ted.siparisNo,
      tedarikci: ted.tedarikcAd,
    },
  })
}

/**
 * Tedariki "gelmedi" işaretler ve ilgili stok hareketini siler.
 */
export async function markTedarikGelmedi(tedarikId: string) {
  await supabase.from('uys_tedarikler').update({ geldi: false, durum: 'bekliyor' }).eq('id', tedarikId)
  await supabase.from('uys_stok_hareketler').delete().eq('id', tedarikStokId(tedarikId))
  // Audit log
  auditLog({
    olay: 'tedarik_geldi',
    tablo: 'uys_tedarikler',
    kayitId: tedarikId,
    alan: 'geldi',
    eskiDeger: 'true',
    yeniDeger: 'false',
    aciklama: 'Tedarik "geldi" geri alındı',
  })
}
