import { supabaseTest } from './supabase'
import { E2E_PREFIX } from './cleanup'

/**
 * Benzersiz test kodu üret. Zaman damgası + rastgele ek.
 */
export function uniqueId(suffix = ''): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${E2E_PREFIX}${ts}-${rnd}${suffix ? '-' + suffix : ''}`
}

/**
 * Bağımsız hammadde İE oluştur (stok kontrol testi için).
 * Hedef stoktan yüksek → ⛔ YOK badge bekleniyor.
 */
export async function createIndependentHammaddeWO(params: {
  hmKod: string
  hmAd: string
  hedef: number
  kalan?: number
}) {
  const kod = uniqueId('WO')
  const { hmKod, hmAd, hedef, kalan = hedef } = params
  const row = {
    id: kod,
    kod,
    siparis_kod: null,
    mamul_kod: hmKod,
    mamul_ad: hmAd,
    hedef,
    kalan,
    tamamlanan: 0,
    durum: 'Başlamadı',
    tip: 'bagimsiz',
    hm: null,
    rc_id: null,
    olusturma: new Date().toISOString(),
  }
  const { error } = await supabaseTest.from('uys_work_orders').insert(row)
  if (error) throw new Error(`İE oluşturulamadı: ${error.message}`)
  return { kod, row }
}

/**
 * Test malzemesi (hammadde) oluştur — stok = 0 varsayılan.
 */
export async function createTestMaterial(params: {
  ad: string
  tip?: 'Hammadde' | 'YarıMamul' | 'Mamul'
  stok?: number
}) {
  const kod = uniqueId('MAT')
  const row = {
    id: kod,
    kod,
    ad: `${E2E_PREFIX}${params.ad}`,
    tip: params.tip ?? 'Hammadde',
    birim: 'Adet',
    min_stok: 0,
    aktif: true,
  }
  const { error } = await supabaseTest.from('uys_malzemeler').insert(row)
  if (error) throw new Error(`Malzeme oluşturulamadı: ${error.message}`)
  return { kod, ad: row.ad }
}

/**
 * Test operatörü oluştur (mesaj testleri için).
 */
export async function createTestOperator(params: { ad: string; bolum?: string }) {
  const kod = uniqueId('OPR')
  const row = {
    id: kod,
    kod,
    ad: `${E2E_PREFIX}${params.ad}`,
    bolum: params.bolum ?? 'Test',
    aktif: true,
    sifre: '1234',
  }
  const { error } = await supabaseTest.from('uys_operators').insert(row)
  if (error) throw new Error(`Operatör oluşturulamadı: ${error.message}`)
  return { id: kod, ad: row.ad }
}

/**
 * Operatör mesajı oluştur (ses + bildirim testi için).
 */
export async function createOperatorMessage(params: {
  oprId: string
  oprAd: string
  mesaj: string
  kategori?: 'Stok' | 'Arıza' | 'Malzeme' | 'Talep' | 'Diğer'
  oncelik?: 'Normal' | 'Acil'
}) {
  const row = {
    id: uniqueId('MSG'),
    opr_id: params.oprId,
    opr_ad: params.oprAd,
    wo_kod: uniqueId('WO-MSG'),
    mesaj: params.mesaj,
    kategori: params.kategori ?? 'Diğer',
    oncelik: params.oncelik ?? 'Normal',
    olusturma: new Date().toISOString(),
    okundu: false,
  }
  const { error } = await supabaseTest.from('uys_operator_notes').insert(row)
  if (error) throw new Error(`Mesaj oluşturulamadı: ${error.message}`)
  return row
}
