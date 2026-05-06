// scripts/backfill-autochain.cjs
// Tek seferlik: mevcut tüm BOM kayıtlarına autoChainSubBoms uygular
// Kullanım: node scripts/backfill-autochain.cjs

require('dotenv').config({ path: '.env' })
const { createClient } = require('@supabase/supabase-js')
const { randomUUID } = require('crypto')

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const uid = () => randomUUID().replace(/-/g, '').slice(0, 14)

function altDal(rows, parentKirno) {
  return rows
    .filter(r => r.kirno === parentKirno || r.kirno.startsWith(parentKirno + '.'))
    .map(r => ({
      ...r, id: uid(),
      kirno: r.kirno === parentKirno ? '1' : '1' + r.kirno.slice(parentKirno.length),
    }))
}

async function run() {
  const { data: bomTrees } = await sb.from('uys_bom_trees').select('id, mamul_kod, mamul_ad, rows')
  const { data: materials } = await sb.from('uys_malzemeler').select('kod, ad, op_id')
  const mats = (materials || []).map(m => ({ kod: m.kod, ad: m.ad, opId: m.op_id }))

  let toplamBom = 0, toplamRec = 0

  for (const bt of (bomTrees || [])) {
    const parentRows = bt.rows || []
    const yariMamuller = parentRows.filter(
      r => r.kirno !== '1' && (r.tip === 'YarıMamul' || r.tip === 'Mamul')
    )
    if (!yariMamuller.length) continue

    const uniqMalkodlar = [...new Set(yariMamuller.map(r => r.malkod))]

    const { data: mevcutBomData } = await sb.from('uys_bom_trees').select('id, mamul_kod').in('mamul_kod', uniqMalkodlar)
    const { data: mevcutRecData } = await sb.from('uys_recipes').select('mamul_kod').in('mamul_kod', uniqMalkodlar)
    const bomMap = new Map((mevcutBomData || []).map(b => [b.mamul_kod, b.id]))
    const recVar = new Set((mevcutRecData || []).map(r => r.mamul_kod))

    const eklenecekBom = [], eklenecekRec = []

    for (const malkod of uniqMalkodlar) {
      const matKart = mats.find(m => m.kod === malkod)
      if (!matKart) { console.log('  ATLA (kart yok):', malkod); continue }

      const ilkSatir = yariMamuller.find(r => r.malkod === malkod)
      const altRows = altDal(parentRows, ilkSatir.kirno)
      if (!altRows.length) continue

      let bomId = bomMap.get(malkod) || ''
      if (!bomId) {
        bomId = uid()
        eklenecekBom.push({ id: bomId, mamul_kod: malkod, mamul_ad: ilkSatir.malad, ad: ilkSatir.malad, rows: altRows })
      }

      if (!recVar.has(malkod)) {
        const satirlar = altRows.map(r => {
          const mat = mats.find(m => m.kod === r.malkod)
          return {
            id: uid(), kirno: r.kirno, malkod: r.malkod, malad: r.malad,
            tip: r.tip, miktar: r.miktar, birim: r.birim || 'Adet',
            opId: (r.tip === 'YarıMamul' || r.tip === 'Mamul') ? (mat?.opId || '') : '',
            istId: '', hazirlikSure: 0, islemSure: 0, sureBirim: 'dk',
          }
        })
        eklenecekRec.push({
          id: uid(), rc_kod: 'RC-' + malkod, ad: ilkSatir.malad,
          mamul_kod: malkod, mamul_ad: ilkSatir.malad, bom_id: bomId, satirlar,
        })
      }
    }

    if (eklenecekBom.length) {
      const { error } = await sb.from('uys_bom_trees').insert(eklenecekBom)
      if (error) console.error('BOM insert hata:', bt.mamul_kod, error.message)
      else { console.log(`  +${eklenecekBom.length} BOM [${bt.mamul_kod}]`); toplamBom += eklenecekBom.length }
    }
    if (eklenecekRec.length) {
      const { error } = await sb.from('uys_recipes').insert(eklenecekRec)
      if (error) console.error('Reçete insert hata:', bt.mamul_kod, error.message)
      else { console.log(`  +${eklenecekRec.length} Reçete [${bt.mamul_kod}]`); toplamRec += eklenecekRec.length }
    }
  }

  console.log(`\nTamamlandı: ${toplamBom} BOM + ${toplamRec} reçete oluşturuldu`)
}

run().catch(console.error)