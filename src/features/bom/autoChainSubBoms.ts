import { supabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'

interface BomRow {
  id: string; kirno: string; malkod: string; malad: string
  tip: string; miktar: number; birim?: string
}
interface MatEntry { kod: string; ad: string; opId?: string }

function altDal(rows: BomRow[], parentKirno: string): BomRow[] {
  return rows
    .filter(r => r.kirno === parentKirno || r.kirno.startsWith(parentKirno + '.'))
    .map(r => ({
      ...r, id: uid(),
      kirno: r.kirno === parentKirno ? '1' : '1' + r.kirno.slice(parentKirno.length),
      miktar: r.kirno === parentKirno ? 1 : r.miktar,  // self-satır her zaman 1
    }))
}

export async function autoChainSubBoms(
  parentMamulKod: string,
  parentRows: BomRow[],
  materials: MatEntry[],
): Promise<{ eklenenBom: number; eklenenRecete: number }> {
  const yariMamuller = parentRows.filter(
    r => r.kirno !== '1' && (r.tip === 'YarıMamul' || r.tip === 'Mamul')
  )
  if (!yariMamuller.length) return { eklenenBom: 0, eklenenRecete: 0 }

  const uniqMalkodlar = [...new Set(yariMamuller.map(r => r.malkod))]

  const { data: mevcutBomData } = await supabase
    .from('uys_bom_trees').select('id, mamul_kod').in('mamul_kod', uniqMalkodlar)
  const { data: mevcutRecData } = await supabase
    .from('uys_recipes').select('mamul_kod').in('mamul_kod', uniqMalkodlar)

  const bomMap = new Map((mevcutBomData || []).map(b => [b.mamul_kod, b.id]))
  const recVar = new Set((mevcutRecData || []).map(r => r.mamul_kod))

  const eklenecekBom: object[] = []
  const eklenecekRec: object[] = []

  for (const malkod of uniqMalkodlar) {
    const matKart = materials.find(m => m.kod === malkod)
    if (!matKart) { console.warn('[autoChain] Kart yok, atlanıyor:', malkod); continue }

    const ilkSatir = yariMamuller.find(r => r.malkod === malkod)!
    const altRows = altDal(parentRows, ilkSatir.kirno)
    if (!altRows.length) continue

    let bomId = bomMap.get(malkod) || ''
    if (!bomId) {
      bomId = uid()
      eklenecekBom.push({ id: bomId, mamul_kod: malkod, mamul_ad: ilkSatir.malad, ad: ilkSatir.malad, rows: altRows })
    }

    if (!recVar.has(malkod)) {
      const satirlar = altRows.map(r => {
        const mat = materials.find(m => m.kod === r.malkod)
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

  if (eklenecekBom.length) await supabase.from('uys_bom_trees').insert(eklenecekBom)
  if (eklenecekRec.length) await supabase.from('uys_recipes').insert(eklenecekRec)

  return { eklenenBom: eklenecekBom.length, eklenenRecete: eklenecekRec.length }
}