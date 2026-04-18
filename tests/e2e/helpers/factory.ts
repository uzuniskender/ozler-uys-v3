import { supabaseTest } from './supabase'
import { E2E_PREFIX } from './cleanup'

export function uniqueId(suffix = ''): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${E2E_PREFIX}${ts}-${rnd}${suffix ? '-' + suffix : ''}`
}

export async function createIndependentHammaddeWO(params: {
  hmKod: string
  hmAd: string
  hedef: number
  kalan?: number // Backward-compat: ignore edilir, master_schema'da yok
}) {
  const kod = uniqueId('WO')
  const { hmKod, hmAd, hedef } = params
  // master_schema.sql uys_work_orders kolonları:
  // id, order_id, rc_id, sira, kirno, op_id, op_kod, op_ad, ist_id, ist_kod, ist_ad,
  // malkod, malad, hedef, mpm, hm (jsonb), ie_no, wh_alloc, hazirlik_sure, islem_sure,
  // durum, bagimsiz, siparis_disi, mamul_kod, mamul_ad, mamul_auto, operator_id, not_,
  // olusturma, updated_at
  const row = {
    id: kod,
    mamul_kod: hmKod,
    mamul_ad: hmAd,
    malkod: hmKod,
    malad: hmAd,
    hedef,
    durum: 'bekliyor',
    bagimsiz: true,
    siparis_disi: false,
    ie_no: kod, // İş Emirleri tablosunda görünür kolon — testler kod ile arayabilsin
    olusturma: new Date().toISOString(),
  }
  const { error } = await supabaseTest.from('uys_work_orders').insert(row)
  if (error) throw new Error(`İE oluşturulamadı: ${error.message}`)
  return { kod, row }
}

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
  }
  const { error } = await supabaseTest.from('uys_malzemeler').insert(row)
  if (error) throw new Error(`Malzeme oluşturulamadı: ${error.message}`)
  return { kod, ad: row.ad }
}

export async function createTestOperator(params: { ad: string; bolum?: string }) {
  const kod = uniqueId('OPR')
  const row = {
    id: kod,
    kod,
    ad: `${E2E_PREFIX}${params.ad}`,
    bolum: params.bolum ?? 'Test',
    sifre: '1234',
  }
  const { error } = await supabaseTest.from('uys_operators').insert(row)
  if (error) throw new Error(`Operatör oluşturulamadı: ${error.message}`)
  return { id: kod, ad: row.ad }
}

export async function createOperatorMessage(params: {
  oprId: string
  oprAd: string
  mesaj: string
  kategori?: 'Stok' | 'Arıza' | 'Malzeme' | 'Talep' | 'Diğer'
  oncelik?: 'Normal' | 'Acil'
}) {
  const id = uniqueId('MSG')
  const now = new Date()
  const row = {
    id,
    op_id: params.oprId,
    op_ad: params.oprAd,
    tarih: now.toISOString().slice(0, 10), // YYYY-MM-DD
    saat: now.toTimeString().slice(0, 5),  // HH:MM
    mesaj: params.mesaj,
    okundu: false,
    kategori: params.kategori ?? null,
    oncelik: params.oncelik ?? 'Normal',
  }
  const { error } = await supabaseTest.from('uys_operator_notes').insert(row)
  if (error) throw new Error(`Mesaj oluşturulamadı: ${error.message}`)
  return row
}