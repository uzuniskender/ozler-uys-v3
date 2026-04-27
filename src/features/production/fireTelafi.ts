import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import type { FireLog, WorkOrder, Recipe, StokHareket, Material } from '@/types'

export interface TelafiSonuc {
  basarili: number
  hata: number
  olusturulanIeNolar: string[]
  hatalar: string[]
}

export interface TelafiAkisSonuc {
  acilenWoIds: string[]
  hammaddeAcigi: { malkod: string; malad: string; miktar: number; birim: string }[]
  hatalar: string[]
}

function getStok(malkod: string, stokHareketler: StokHareket[]): number {
  return Math.floor(stokHareketler
    .filter(h => h.malkod === malkod)
    .reduce((a, h) => a + (h.tip === 'giris' ? h.miktar : -h.miktar), 0))
}

// ═══ v15.76 — FİRE TELAFİ AKIŞI (İş Emri #13 madde 13) ═══
// Spec: "Fire çıktıysa, fire iş emri açıldıysa, yeni sipariş/iş emri adımları gerçekleştirilir."
//
// Mantık (Buket 27 Nis 2026):
//   - Fire X adet, operasyon N (örn kaynak)
//   - Telafi WO açılır (X adet, operasyon N için, orijinal sipariş'e bağlı)
//   - Alt basamağa in: yarımamul stoğu yetiyorsa dur, yetmiyorsa o operasyon için ek WO
//   - Recursive alt basamaklar
//   - En altta hammadde eksikse caller MRP'yi tetikler (bu fonksiyon hammadde açığını döner)
//
// SAHA UYUMU:
//   - Sipariş.adet aynı (50 → 50, müşteriye 50 gider)
//   - WO hedefleri toplamı = üretim hedefi (50 + 5 fire telafi = 55)
//   - OEE hesabında kalite katsayısı = 50/55
//
// KRİTİK: Sonsuz döngü engellemek için recursive çağrı sayısı Recipe.satirlar derinliğiyle sınırlı.
export async function fireTelafiAkisi(
  fire: FireLog,
  orijinalWO: WorkOrder,
  recipe: Recipe,
  stokHareketler: StokHareket[],
  workOrders: WorkOrder[],
  _materials: Material[],
): Promise<TelafiAkisSonuc> {
  const sonuc: TelafiAkisSonuc = { acilenWoIds: [], hammaddeAcigi: [], hatalar: [] }

  if (!fire.qty || fire.qty < 1) {
    sonuc.hatalar.push('Fire miktarı sıfır veya negatif')
    return sonuc
  }
  if (fire.telafiWoId) {
    sonuc.hatalar.push('Bu fire için telafi zaten açıldı')
    return sonuc
  }

  // 1) Üst telafi WO'sunu aç
  const ustWoId = await telafiWoOlustur(fire, orijinalWO, fire.qty)
  if (!ustWoId) {
    sonuc.hatalar.push('Üst telafi WO oluşturulamadı')
    return sonuc
  }
  sonuc.acilenWoIds.push(ustWoId)
  await supabase.from('uys_fire_logs').update({ telafi_wo_id: ustWoId }).eq('id', fire.id)

  // 2) Recursive alt basamaklar
  const ustKirno = orijinalWO.kirno || ''
  if (!ustKirno) return sonuc

  const ustDepth = ustKirno.split('.').length
  const dogrudanAltlar = (recipe.satirlar || []).filter(s => {
    const k = s.kirno || ''
    return k.startsWith(ustKirno + '.') && k.split('.').length === ustDepth + 1
  })

  for (const altSatir of dogrudanAltlar) {
    const altIhtiyac = Math.ceil(fire.qty * (altSatir.miktar || 1))

    if (altSatir.tip === 'Hammadde') {
      // En alt — hammadde, MRP/tedarik akışına bırak
      const stok = getStok(altSatir.malkod, stokHareketler)
      const eksik = Math.max(0, altIhtiyac - stok)
      if (eksik > 0) {
        sonuc.hammaddeAcigi.push({
          malkod: altSatir.malkod,
          malad: altSatir.malad || altSatir.malkod,
          miktar: eksik,
          birim: altSatir.birim || 'Adet',
        })
      }
      continue
    }

    if (altSatir.tip === 'YarıMamul' && altSatir.opId) {
      const stok = getStok(altSatir.malkod, stokHareketler)
      if (stok >= altIhtiyac) continue  // Yarımamul stoğu yeterli, alt WO gerek yok

      const eksikYM = altIhtiyac - stok

      // Operasyon kod/ad'ı DB'den al
      let opKod = ''
      let opAd = ''
      if (altSatir.opId) {
        const { data: opRow } = await supabase
          .from('uys_operations').select('kod, ad').eq('id', altSatir.opId).single()
        if (opRow) {
          opKod = (opRow as any).kod || ''
          opAd = (opRow as any).ad || ''
        }
      }

      const altSahteWO: WorkOrder = {
        ...orijinalWO,
        kirno: altSatir.kirno || '',
        opId: altSatir.opId,
        opKod, opAd,
        istId: altSatir.istId || '',
        malkod: altSatir.malkod,
        malad: altSatir.malad || altSatir.malkod,
        mamulKod: altSatir.malkod,
        mamulAd: altSatir.malad || altSatir.malkod,
        mpm: altSatir.miktar || 1,
        hazirlikSure: altSatir.hazirlikSure || 0,
        islemSure: altSatir.islemSure || 0,
      }

      const altSahteFire: FireLog = {
        ...fire,
        id: 'recursive-' + uid(),
        qty: eksikYM,
        woId: orijinalWO.id,
        telafiWoId: undefined,
      }

      const altWoId = await telafiWoOlustur(altSahteFire, altSahteWO, eksikYM)
      if (altWoId) {
        sonuc.acilenWoIds.push(altWoId)
        // Recursive: bu alt WO için de hammadde/yarımamul ihtiyacı var mı?
        const altSubResult = await fireTelafiAkisi(
          altSahteFire, altSahteWO, recipe, stokHareketler, workOrders, _materials
        )
        sonuc.acilenWoIds.push(...altSubResult.acilenWoIds)
        sonuc.hammaddeAcigi.push(...altSubResult.hammaddeAcigi)
        sonuc.hatalar.push(...altSubResult.hatalar)
      } else {
        sonuc.hatalar.push(`Alt operasyon WO oluşturulamadı: ${altSatir.malkod}`)
      }
    }
  }

  return sonuc
}

// Yardımcı: tek bir telafi WO insert (orijinal sipariş'e bağlı, siparis_disi=false)
async function telafiWoOlustur(
  fire: FireLog,
  orijinalWO: WorkOrder,
  hedefAdet: number,
): Promise<string | null> {
  const newId = uid()
  const yeniIeNo = (orijinalWO.ieNo || 'IE') + '-FT' + String(fire.id || '').slice(-4).toUpperCase()

  const row = {
    id: newId,
    order_id: orijinalWO.orderId || '',  // v15.76 — sipariş'e BAĞLI
    rc_id: orijinalWO.rcId || '',
    sira: 0,
    kirno: orijinalWO.kirno || '',
    op_id: orijinalWO.opId || '',
    op_kod: orijinalWO.opKod || '',
    op_ad: orijinalWO.opAd || '',
    ist_id: orijinalWO.istId || '',
    malkod: orijinalWO.malkod || '',
    malad: orijinalWO.malad || '',
    mamul_kod: orijinalWO.mamulKod || '',
    mamul_ad: orijinalWO.mamulAd || '',
    hedef: hedefAdet,
    mpm: orijinalWO.mpm || 1,
    hm: orijinalWO.hm || [],
    ie_no: yeniIeNo,
    wh_alloc: 0,
    hazirlik_sure: orijinalWO.hazirlikSure || 0,
    islem_sure: orijinalWO.islemSure || 0,
    durum: 'bekliyor',
    bagimsiz: false,        // v15.76 — siparişe bağlı
    siparis_disi: false,    // v15.76 — siparişe bağlı
    not_: `Fire telafisi · orijinal: ${fire.ieNo || ''} · ${hedefAdet} adet · ${fire.tarih || today()}`,
    olusturma: today(),
  }

  const { error } = await supabase.from('uys_work_orders').insert(row)
  if (error) {
    console.error('[v15.76 telafiWoOlustur]:', error.message)
    return null
  }
  return newId
}

// ═══ ESKİ API — geriye uyum ═══
// fireTelafiIeOlustur eski caller'lar için kalır, ama içerideki davranış değişti:
//   - order_id artık orijinalWO.orderId (eski: '')
//   - siparis_disi: false, bagimsiz: false (eski: true, true)
// Recursive alt akış YOK — sadece tek WO. Yeni davranış için fireTelafiAkisi kullan.
export async function fireTelafiIeOlustur(
  fire: FireLog,
  orijinalWo: WorkOrder,
): Promise<{ woId: string; ieNo: string } | null> {
  if (!fire.qty || fire.qty < 1) return null
  if (fire.telafiWoId) return null
  if (!orijinalWo) return null

  const woId = await telafiWoOlustur(fire, orijinalWo, fire.qty)
  if (!woId) return null

  await supabase.from('uys_fire_logs').update({ telafi_wo_id: woId }).eq('id', fire.id)
  const yeniIeNo = (orijinalWo.ieNo || 'IE') + '-FT' + String(fire.id || '').slice(-4).toUpperCase()
  return { woId, ieNo: yeniIeNo }
}

// ═══ TOPLU TELAFİ — Reports butonu (v15.76: recursive akış) ═══
export async function topluFireTelafi(
  fireLogs: FireLog[],
  workOrders: WorkOrder[],
  recipes?: Recipe[],
  stokHareketler?: StokHareket[],
  materials?: Material[],
): Promise<TelafiSonuc> {
  const sonuc: TelafiSonuc = { basarili: 0, hata: 0, olusturulanIeNolar: [], hatalar: [] }
  const telafisiz = fireLogs.filter(f => f.qty > 0 && !f.telafiWoId)

  for (const f of telafisiz) {
    const wo = workOrders.find(w => w.id === f.woId)
    if (!wo) {
      sonuc.hata++
      sonuc.hatalar.push(`${f.ieNo || f.id}: orijinal İE bulunamadı`)
      continue
    }

    if (recipes && stokHareketler && materials) {
      const rc = recipes.find(r => r.id === wo.rcId)
      if (rc) {
        const akis = await fireTelafiAkisi(f, wo, rc, stokHareketler, workOrders, materials)
        if (akis.acilenWoIds.length > 0) {
          sonuc.basarili++
          sonuc.olusturulanIeNolar.push(`${f.ieNo}: ${akis.acilenWoIds.length} WO`)
        } else {
          sonuc.hata++
          sonuc.hatalar.push(`${f.ieNo || f.id}: WO açılamadı (${akis.hatalar.join(', ')})`)
        }
        continue
      }
    }

    // Reçete verilmezse — eski davranış (sadece tek WO, alt zincir yok)
    const r = await fireTelafiIeOlustur(f, wo)
    if (r) {
      sonuc.basarili++
      sonuc.olusturulanIeNolar.push(r.ieNo)
    } else {
      sonuc.hata++
      sonuc.hatalar.push(`${f.ieNo || f.id}: İE oluşturulamadı`)
    }
  }
  return sonuc
}
