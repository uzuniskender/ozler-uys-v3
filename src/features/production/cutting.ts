import { uid, today } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { WorkOrder, Material, Recipe } from '@/types'

interface KesimKesim {
  woId: string; ieNo: string
  malkod: string; malad: string
  parcaBoy: number; parcaEn?: number
  adet: number; tamamlandi: number
}

interface KesimSatir {
  id: string; hamAdet: number; fireMm: number
  kesimler: KesimKesim[]; durum: string
  havuzBarId?: string    // v15.35 — satır havuz barından üretiliyorsa dolu, hamAdet=1
}

interface KesimPlanSonuc {
  id: string; hamMalkod: string; hamMalad: string; hamBoy: number; hamEn: number
  kesimTip: string; durum: string; tarih: string
  satirlar: KesimSatir[]; gerekliAdet: number
}

// Parça boyunu malzeme bilgisinden al
export function getParcaBoy(malkod: string, materials: Material[]): number {
  const m = findMaterialByKod(materials, malkod)
  if (!m) return 0
  if (m.uzunluk > 0) return m.uzunluk // profil/boru parça uzunluğu
  if (m.boy && m.en) return Math.min(m.boy, m.en)
  if (m.boy) return m.boy
  return 0
}

function getParcaEn(malkod: string, materials: Material[]): number {
  const m = findMaterialByKod(materials, malkod)
  if (!m) return 0
  if (m.uzunluk > 0) return 0 // uzunluk varsa boy kesim, en yok
  if (m.boy && m.en) return Math.max(m.boy, m.en)
  return 0
}

// HM bar boyu: uzunluk > 0 ise uzunluk, yoksa max(boy,en),
// hiçbiri yoksa malzeme adından MM parse et (örn. "6000 MM" → 6000)
export function getHamBoy(m: Material): number {
  if (m.uzunluk > 0) return m.uzunluk
  const b = Math.max(m.boy || 0, m.en || 0)
  if (b > 0) return b
  // Fallback — ad içinden boy parse et (tolerant: "6000 mm", "6000MM", "6000 MM")
  const ad = (m.ad || '') + ' ' + (m.kod || '')
  const match = ad.match(/(\d{3,5})\s*[mM]{2}/g)
  if (match && match.length) {
    // En büyük rakamı bar boyu kabul et (profil/boru için hep uzun kenar)
    const sayilar = match.map(s => parseInt(s.replace(/[^\d]/g, ''), 10)).filter(n => n >= 500)
    if (sayilar.length) return Math.max(...sayilar)
  }
  return 0
}

// Case-insensitive + trim material lookup
// Kullanım: reçetede 'BORU x 6000 mm' yazılmış, karttaysa 'BORU X 6000 MM' varsa eşleşir
function findMaterialByKod(materials: Material[], kod: string): Material | undefined {
  if (!kod) return undefined
  const target = kod.trim().toLowerCase()
  return materials.find(x => (x.kod || '').trim().toLowerCase() === target)
}

// ═══ KESİM PLANI OLUŞTUR — v2 _kesimPlanOlusturCore port'u ═══
export function kesimPlanOlustur(
  workOrders: WorkOrder[],
  operations: { id: string; ad: string; kod: string }[],
  recipes: Recipe[],
  materials: Material[],
  logs: { woId: string; qty: number }[],
  mevcutPlanlar: KesimPlanSonuc[]
): KesimPlanSonuc[] {
  function wProd(woId: string): number { return logs.filter(l => l.woId === woId).reduce((a, l) => a + l.qty, 0) }
  function wPct(w: WorkOrder): number { return w.hedef > 0 ? Math.min(100, Math.round(wProd(w.id) / w.hedef * 100)) : 0 }

  const kesimOps = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH']

  console.group('🔧 KESİM PLAN HESAPLAMA')
  console.log('İE sayısı:', workOrders.length, '| Reçete:', recipes.length, '| Malzeme:', materials.length)

  // HM bazlı gruplama: hamMalkod → ihtiyaçlar
  const gruplar: Record<string, {
    hamMalkod: string; hamMalad: string; hamBoy: number; hamEn: number
    kesimTip: string; ihtiyaclar: { woId: string; ieNo: string; malkod: string; malad: string; parcaBoy: number; parcaEn: number; adet: number }[]
  }> = {}

  for (const w of workOrders) {
    if (wPct(w) >= 100 || w.durum === 'iptal') continue
    const kalan = Math.max(0, w.hedef - wProd(w.id))
    if (!kalan) continue

    // Sadece kesim operasyonlu İE'ler
    const wOp = operations.find(o => o.id === w.opId)
    const wOpAd = (wOp?.ad || w.opAd || '').toUpperCase()
    if (!kesimOps.some(k => wOpAd.includes(k))) continue

    console.group(`📋 ${w.ieNo} — ${w.malad}`)
    console.log('Operasyon:', wOpAd, '| Hedef:', w.hedef, '| Kalan:', kalan)
    console.log('malkod:', w.malkod, '| rcId:', w.rcId, '| kirno:', w.kirno)
    console.log('w.hm:', w.hm)

    // HM bileşenlerini bul — sadece gerçek hammaddeler (YarıMamul ve ürünün kendisi hariç)
    const hmSatirlar: { malkod: string; malad: string }[] = []
    if (w.hm?.length) {
      w.hm.forEach(h => {
        // Ürünün kendisini atla
        if (h.malkod === w.malkod || h.malkod === w.mamulKod) { console.log('⏩ Ürünün kendisi atlandı:', h.malkod); return }
        const mat = findMaterialByKod(materials, h.malkod)
        // YarıMamul ise kesim planına dahil etme
        if (mat?.tip === 'YarıMamul') { console.log('⏩ YM atlandı:', h.malkod, h.malad); return }
        hmSatirlar.push({ malkod: h.malkod, malad: h.malad })
      })
      console.log('✅ HM w.hm dizisinden (filtrelenmiş):', hmSatirlar.length, 'satır')
    } else {
      console.log('⚠ w.hm boş — reçeteden aranıyor...')
      // BOM'dan bir seviye aşağı
      const rc = recipes.find(r => r.id === w.rcId) || recipes.find(r => r.mamulKod === w.malkod)
      if (rc?.satirlar) {
        console.log('Reçete bulundu:', rc.ad, '| mamulKod:', rc.mamulKod, '| satirlar:', rc.satirlar.length)
        const woKirno = w.kirno || '1'
        const depth = woKirno.split('.').length
        const altlar = rc.satirlar.filter(s =>
          (s.tip === 'Hammadde' || s.tip === 'Sarf') &&
          (s.kirno || '').startsWith(woKirno + '.') &&
          (s.kirno || '').split('.').length === depth + 1
        )
        console.log(`Kirno "${woKirno}" altındaki HM satırlar:`, altlar.map(s => `${s.kirno} ${s.malkod} ${s.malad} (${s.tip})`))
        altlar.forEach(s => hmSatirlar.push({ malkod: s.malkod || '', malad: s.malad || '' }))
      } else {
        console.log('❌ Reçete bulunamadı! rcId:', w.rcId, '| malkod:', w.malkod)
      }
    }

    if (!hmSatirlar.length) {
      console.log('❌ SONUÇ: HM satır yok — bu İE için kesim planı oluşturulamaz')
      console.groupEnd()
      continue
    }

    for (const hm of hmSatirlar) {
      const hmalkod = hm.malkod; if (!hmalkod) { console.log('❌ HM malkod boş'); continue }
      const hmM = findMaterialByKod(materials, hmalkod)
      if (!hmM) { console.log('❌ HM malzeme kartı bulunamadı:', hmalkod); continue }
      const hamBoy = getHamBoy(hmM)
      const hamEn = hmM.uzunluk > 0 ? 0 : Math.min(hmM.boy || 0, hmM.en || 0)
      if (!hamBoy) { console.log('❌ HM boy bilgisi yok:', hmalkod, '| boy:', hmM.boy, '| en:', hmM.en, '| uzunluk:', hmM.uzunluk); continue }

      const parcaBoy = getParcaBoy(w.malkod, materials)
      const parcaEn = getParcaEn(w.malkod, materials)
      const kesimTip = parcaEn > 0 ? 'yuzey' : 'boy'

      console.log(`✅ HM: ${hmalkod} (${hamBoy}mm) → Parça: ${w.malkod} (${parcaBoy}mm) | Tip: ${kesimTip}`)

      if (!parcaBoy) { console.log('❌ Parça boy bilgisi yok! Malzeme kartında uzunluk/boy eksik:', w.malkod) }

      if (!gruplar[hmalkod]) {
        gruplar[hmalkod] = {
          hamMalkod: hmalkod, hamMalad: hm.malad || hmM?.ad || hmalkod,
          hamBoy, hamEn, kesimTip, ihtiyaclar: []
        }
      }

      // Aynı WO zaten varsa topla
      const mevcut = gruplar[hmalkod].ihtiyaclar.find(x => x.woId === w.id && x.malkod === w.malkod)
      if (mevcut) { mevcut.adet += kalan }
      else {
        gruplar[hmalkod].ihtiyaclar.push({
          woId: w.id, ieNo: w.ieNo || w.id,
          malkod: w.malkod, malad: w.malad || w.malkod,
          parcaBoy: parcaBoy || 0, parcaEn: parcaEn || 0,
          adet: kalan
        })
      }
    }
    console.groupEnd()
  }

  console.log('Toplam HM grubu:', Object.keys(gruplar).length)
  if (!Object.keys(gruplar).length) { console.log('❌ Hiç grup oluşmadı — plan yok'); console.groupEnd(); return [] }
  console.groupEnd()

  // Her grup için optimum kesim planı oluştur
  const sonuclar: KesimPlanSonuc[] = []
  const mevcutKopyasi = [...mevcutPlanlar]

  for (const g of Object.values(gruplar)) {
    // Sadece BEKLEYEN plan varsa birleştir — başladı/tamamlandı planlara dokunma
    const mevcutPlan = mevcutKopyasi.find(p => p.hamMalkod === g.hamMalkod && p.durum === 'bekliyor')

    if (mevcutPlan) {
      // Bu plana daha önce eklenmemiş WO'ları ayıkla
      const planlananWoIds = new Set<string>()
      mevcutPlan.satirlar.forEach(s => s.kesimler.forEach(k => planlananWoIds.add(k.woId)))
      const yeniIhtiyaclar = g.ihtiyaclar.filter(iht => !planlananWoIds.has(iht.woId))

      if (yeniIhtiyaclar.length > 0) {
        // Mevcut satırları bar seed'i olarak ver → önce fire'a sığdır, sonra yeni bar aç, en son grupla
        const birlesik = boykesimOptimum(
          { ...g, ihtiyaclar: yeniIhtiyaclar },
          workOrders, materials, logs,
          mevcutPlan.satirlar,
        )
        mevcutPlan.satirlar = birlesik
        mevcutPlan.gerekliAdet = birlesik.reduce((a, s) => a + s.hamAdet, 0)
        console.log(`🔀 Plan birleştirildi: ${g.hamMalkod} | +${yeniIhtiyaclar.length} yeni İE | ${birlesik.length} satır`)
      }
      sonuclar.push(mevcutPlan)
    } else {
      // Yeni plan oluştur
      const satirlar = boykesimOptimum(g, workOrders, materials, logs)
      const plan: KesimPlanSonuc = {
        id: uid(), hamMalkod: g.hamMalkod, hamMalad: g.hamMalad,
        hamBoy: g.hamBoy, hamEn: g.hamEn, kesimTip: g.kesimTip,
        durum: 'bekliyor', tarih: today(),
        satirlar, gerekliAdet: satirlar.reduce((a, s) => a + s.hamAdet, 0),
      }
      sonuclar.push(plan)
    }
  }

  return sonuclar
}

// Boy kesim optimizasyonu — Decreasing First Fit + Fire Doldurma
// mevcutSatirlar verilirse: mevcut bar'lar seed olarak kullanılır, yeni ihtiyaçlar önce onların fire'ına sığdırılır
// v15.35: havuzBarlari verilirse → açık bar havuzundan bar'lar seed edilir (her biri ayrı satır, gruplanmaz)
function boykesimOptimum(
  g: { hamMalkod: string; hamBoy: number; ihtiyaclar: { woId: string; ieNo: string; malkod: string; malad: string; parcaBoy: number; parcaEn: number; adet: number }[] },
  allWOs: WorkOrder[],
  materials: Material[],
  logs: { woId: string; qty: number }[],
  mevcutSatirlar?: KesimSatir[],
  havuzBarlari?: { id: string; uzunlukMm: number }[]
): KesimSatir[] {
  const hamBoy = g.hamBoy || 6000
  const ihtiyaclar = g.ihtiyaclar.slice().sort((a, b) => (b.parcaBoy || 0) - (a.parcaBoy || 0))

  // Bar listesi — mevcut satırlar varsa bar'lara patlat (hamAdet kadar)
  const barlar: { kalan: number; kesimler: KesimKesim[]; kilitli?: boolean; havuzBarId?: string }[] = []
  if (mevcutSatirlar?.length) {
    for (const s of mevcutSatirlar) {
      // Başlayan/tamamlanan satırlar kilitli — fire'ına dokunma, kesim düzenini koru
      const kilitli = !!(s.durum && s.durum !== 'bekliyor')
      for (let i = 0; i < s.hamAdet; i++) {
        barlar.push({
          kalan: kilitli ? 0 : (s.fireMm || 0),
          kesimler: JSON.parse(JSON.stringify(s.kesimler)),
          kilitli,
          // Havuz satırı ise havuzBarId korunur (hamAdet=1 olduğu için tek kez eklenir)
          havuzBarId: s.havuzBarId,
        })
      }
    }
  }

  // v15.35 — Açık bar havuzu seed: her havuz barı ayrı bar olarak eklenir
  // kalan = uzunlukMm, kesimler = [] (boş), havuzBarId ile işaretli
  if (havuzBarlari?.length) {
    for (const ab of havuzBarlari) {
      if ((ab.uzunlukMm || 0) <= 0) continue
      barlar.push({
        kalan: ab.uzunlukMm,
        kesimler: [],
        havuzBarId: ab.id,
      })
    }
  }

  for (const iht of ihtiyaclar) {
    const parcaBoy = iht.parcaBoy; if (!parcaBoy) continue
    let kalanAdet = iht.adet

    while (kalanAdet > 0) {
      // Best-fit: en az boşluk bırakan bar'ı seç (kilitli barlar kalan=0 olduğu için otomatik dışlanır)
      let enIyiBi = -1; let enIyiKalan = Infinity
      for (let bi = 0; bi < barlar.length; bi++) {
        const adedPerBor = Math.floor(barlar[bi].kalan / parcaBoy)
        if (adedPerBor > 0) {
          const konulacak = Math.min(adedPerBor, kalanAdet)
          const kalanSonra = barlar[bi].kalan - konulacak * parcaBoy
          if (kalanSonra < enIyiKalan) { enIyiKalan = kalanSonra; enIyiBi = bi }
        }
      }
      if (enIyiBi >= 0) {
        const bar = barlar[enIyiBi]
        const adedPerBor = Math.floor(bar.kalan / parcaBoy)
        const konulan = Math.min(adedPerBor, kalanAdet)
        const mev = bar.kesimler.find(k => k.woId === iht.woId && k.malkod === iht.malkod)
        if (mev) mev.adet += konulan
        else bar.kesimler.push({ woId: iht.woId, ieNo: iht.ieNo, malkod: iht.malkod, malad: iht.malad, parcaBoy, adet: konulan, tamamlandi: 0 })
        bar.kalan -= konulan * parcaBoy
        kalanAdet -= konulan
      } else {
        // Yeni bar aç
        const adedPerYeni = Math.floor(hamBoy / parcaBoy)
        const konulan = Math.min(adedPerYeni, kalanAdet)
        barlar.push({
          kalan: hamBoy - konulan * parcaBoy,
          kesimler: [{ woId: iht.woId, ieNo: iht.ieNo, malkod: iht.malkod, malad: iht.malad, parcaBoy, adet: konulan, tamamlandi: 0 }]
        })
        kalanAdet -= konulan
      }
    }
  }

  // Fire doldurma — 3 aşama (kilitli barlar zaten kalan=0, etkilenmez)
  // 1) Diğer açık İE'lerden parça sığdır
  for (const bar of barlar) {
    if (bar.kalan < 10) continue
    const ilgiliWOs = allWOs.filter(w => {
      if (w.durum === 'iptal') return false
      const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
      if (prod >= w.hedef) return false
      return (w.hm || []).some(h => h.malkod === g.hamMalkod)
    })
    for (const w of ilgiliWOs) {
      const pb = getParcaBoy(w.malkod, materials); if (!pb || pb > bar.kalan) continue
      const zatenPlan = barlar.reduce((a, b) => { const k = b.kesimler.find(k => k.woId === w.id); return a + (k ? k.adet : 0) }, 0)
      const kalan = Math.max(0, (w.hedef || 0) - zatenPlan)
      if (!kalan) continue
      const sigacak = Math.min(Math.floor(bar.kalan / pb), kalan)
      if (!sigacak) continue
      const mev = bar.kesimler.find(k => k.woId === w.id)
      if (mev) mev.adet += sigacak
      else bar.kesimler.push({ woId: w.id, ieNo: w.ieNo || w.id, malkod: w.malkod, malad: w.malad, parcaBoy: pb, adet: sigacak, tamamlandi: 0 })
      bar.kalan -= sigacak * pb
    }
  }

  // 2) Mevcut parçalardan fire doldurma — aynı parçadan daha fazla kes (stok oluştur)
  for (const bar of barlar) {
    if (bar.kalan < 10) continue
    let devam = true; let maxLoop = 50
    while (devam && maxLoop-- > 0) {
      devam = false
      // En büyük sığabilecek mevcut parçayı bul
      let enIyiK: KesimKesim | null = null; let enIyiEk = 0
      for (const k of bar.kesimler) {
        const pb = k.parcaBoy || 0; if (!pb || pb > bar.kalan) continue
        const ekAdet = Math.floor(bar.kalan / pb)
        if (ekAdet > 0 && ekAdet > enIyiEk) { enIyiK = k; enIyiEk = ekAdet }
      }
      if (enIyiK && enIyiEk > 0) {
        enIyiK.adet += enIyiEk
        bar.kalan -= enIyiEk * (enIyiK.parcaBoy || 0)
        devam = true
      }
    }
  }

  // Aynı kesim düzenindeki barları grupla
  // v15.35: havuz barları (havuzBarId taşıyan) asla gruplanmaz — her biri ayrı satır
  // v15.35.1: 0 kesimli havuz barı satır oluşturmaz — havuzda kalsın (parça sığmadı)
  const gruplu: KesimSatir[] = []
  for (const bar of barlar) {
    // Havuz barı: her biri benzersiz → ayrı satır, hamAdet=1
    if (bar.havuzBarId) {
      // v15.35.1: hiç parça sığmadıysa havuzda kalsın, plana eklemedik
      if (bar.kesimler.length === 0) continue
      gruplu.push({
        id: uid(),
        hamAdet: 1,
        fireMm: bar.kalan,
        kesimler: JSON.parse(JSON.stringify(bar.kesimler)),
        durum: bar.kilitli ? 'basladi' : 'bekliyor',
        havuzBarId: bar.havuzBarId,
      })
      continue
    }
    const anahtar = bar.kesimler.map(k => k.woId + ':' + k.parcaBoy + ':' + k.adet).sort().join('|') + '#' + (bar.kilitli ? 'LOCK' : 'OK')
    const mev = gruplu.find(g => {
      if (g.havuzBarId) return false  // havuz satırlarıyla birleşme
      const gAnahtar = g.kesimler.map(k => k.woId + ':' + k.parcaBoy + ':' + k.adet).sort().join('|') + '#' + (g.durum === 'bekliyor' ? 'OK' : 'LOCK')
      return gAnahtar === anahtar
    })
    if (mev) mev.hamAdet++
    else gruplu.push({ id: uid(), hamAdet: 1, fireMm: bar.kalan, kesimler: JSON.parse(JSON.stringify(bar.kesimler)), durum: bar.kilitli ? 'basladi' : 'bekliyor' })
  }

  return gruplu
}

// ═══ HAVUZ ÖNERİSİ — v15.35 ═══
// Verilen mevcut planı, seçilen havuz barları ile yeniden optimize eder.
// Plan satırlarından YENİ (havuzBarId'siz + bekliyor) satırlar atılır, onlardaki
// ihtiyaçlar + seçilen havuz barları optimizer'a gönderilir. KİLİTLİ satırlar
// (başlayan/tamamlanan) ve varsa eski havuz satırları korunur.
//
// Dönüş: yeni satırlar (plan.satirlar yerine yazılabilir).
export function havuzdanYenidenOptimize(
  plan: KesimPlanSonuc,
  secilenHavuzBarlari: { id: string; uzunlukMm: number }[],
  workOrders: WorkOrder[],
  materials: Material[],
  logs: { woId: string; qty: number }[]
): KesimSatir[] {
  const hmM = findMaterialByKod(materials, plan.hamMalkod)
  if (!hmM) { console.warn('[havuz] ham malzeme bulunamadı:', plan.hamMalkod); return plan.satirlar }

  // Mevcut satırları ayır: kilitli (dokunma) + yeni açılan (yeniden optimize)
  const kilitliSatirlar: KesimSatir[] = []
  const yenidenKesim: { woId: string; ieNo: string; malkod: string; malad: string; parcaBoy: number; parcaEn: number; adet: number }[] = []

  for (const s of plan.satirlar) {
    const kilitli = !!(s.durum && s.durum !== 'bekliyor')
    if (kilitli) {
      kilitliSatirlar.push(s)
      continue
    }
    // Bekliyor durumundaki satırlardaki kesimleri ihtiyaç olarak topla
    // (hem eski havuz satırları hem yeni bar satırları — hepsi yeniden hesaplanacak)
    for (const k of s.kesimler) {
      yenidenKesim.push({
        woId: k.woId, ieNo: k.ieNo,
        malkod: k.malkod, malad: k.malad,
        parcaBoy: k.parcaBoy || 0, parcaEn: k.parcaEn || 0,
        adet: (k.adet || 0) * (s.hamAdet || 1),  // grupluysa hamAdet kadar çarp
      })
    }
  }

  // İhtiyaçları woId+malkod bazında birleştir (boykesimOptimum bekliyor)
  const ihtiyacMap: Record<string, typeof yenidenKesim[0]> = {}
  for (const it of yenidenKesim) {
    const k = it.woId + '|' + it.malkod
    if (!ihtiyacMap[k]) ihtiyacMap[k] = { ...it, adet: 0 }
    ihtiyacMap[k].adet += it.adet
  }
  const ihtiyaclar = Object.values(ihtiyacMap)

  if (!ihtiyaclar.length) {
    // Tüm satırlar kilitliyse dokunma
    return plan.satirlar
  }

  const yeniSatirlar = boykesimOptimum(
    { hamMalkod: plan.hamMalkod, hamBoy: plan.hamBoy, ihtiyaclar },
    workOrders, materials, logs,
    kilitliSatirlar,          // kilitli satırlar seed (kilitli=true olarak işaretlenir)
    secilenHavuzBarlari,       // havuz barları seed
  )

  return yeniSatirlar
}

// Kesim planlarını Supabase'e kaydet
export async function kesimPlanlariKaydet(planlar: KesimPlanSonuc[]): Promise<number> {
  if (!planlar.length) return 0
  for (const plan of planlar) {
    await supabase.from('uys_kesim_planlari').upsert({
      id: plan.id,
      ham_malkod: plan.hamMalkod, ham_malad: plan.hamMalad,
      ham_boy: plan.hamBoy, ham_en: plan.hamEn,
      kesim_tip: plan.kesimTip, durum: plan.durum,
      satirlar: plan.satirlar, gerekli_adet: plan.gerekliAdet,
      tarih: plan.tarih,
    }, { onConflict: 'id' })
  }
  return planlar.length
}

// ═══ BACKWARD COMPAT ═══
export { kesimPlanlariKaydet as kesimPlaniKaydet }

interface KesimIhtiyacCompat { malkod: string; malad: string; boy: number; adet: number; woId?: string; ieNo?: string }
interface KesimSonucCompat { hamMalkod: string; hamMalad: string; hamBoy: number; kesimTip: string; gerekliAdet: number; satirlar: { malkod: string; malad: string; boy: number; adet: number }[]; fire: number; fireOran: number }

export function optimizeKesim(ihtiyaclar: KesimIhtiyacCompat[], hamMalzemeler: Material[]): KesimSonucCompat[] {
  if (!ihtiyaclar.length) return []
  const groups: Record<string, KesimIhtiyacCompat[]> = {}
  ihtiyaclar.forEach(k => { const key = k.malkod.replace(/\d+$/, ''); if (!groups[key]) groups[key] = []; groups[key].push(k) })
  const sonuclar: KesimSonucCompat[] = []
  for (const [, parcalar] of Object.entries(groups)) {
    const uygunHM = hamMalzemeler.filter(m => (m.tip === 'Hammadde' || m.tip === 'YarıMamul') && m.boy > 0 && parcalar.some(p => p.boy > 0 && p.boy <= m.boy))
    if (!uygunHM.length) continue
    let best: KesimSonucCompat | null = null
    for (const hm of uygunHM) {
      const items: number[] = []; parcalar.forEach(p => { for (let i = 0; i < p.adet; i++) items.push(p.boy) }); items.sort((a, b) => b - a)
      const bars: number[] = []
      for (const item of items) { if (item <= 0 || item > hm.boy) continue; let placed = false; for (let i = 0; i < bars.length; i++) { if (bars[i] >= item) { bars[i] -= item; placed = true; break } }; if (!placed) bars.push(hm.boy - item) }
      const totalFire = bars.reduce((a, b) => a + b, 0); const totalUsed = bars.length * hm.boy; const fireOran = totalUsed > 0 ? Math.round(totalFire / totalUsed * 100) : 0
      const plan: KesimSonucCompat = { hamMalkod: hm.kod, hamMalad: hm.ad, hamBoy: hm.boy, kesimTip: 'boy', gerekliAdet: bars.length, satirlar: parcalar.map(p => ({ malkod: p.malkod, malad: p.malad, boy: p.boy, adet: p.adet })), fire: totalFire, fireOran }
      if (!best || plan.fireOran < best.fireOran) best = plan
    }
    if (best) sonuclar.push(best)
  }
  return sonuclar
}

// ═══════════════════════════════════════════════════════════════
// v15.48a — KESİM ARTIĞI MALZEME ÖNERİSİ
// ═══════════════════════════════════════════════════════════════
//
// v15.48a hotfix: artikMalzemelerOlustur'un implementasyonu './cuttingArtik'
// dosyasına taşındı (vitest Supabase env hatası sebebiyle). Geriye uyumluluk
// için aynı isimle re-export ediliyor — kullanıcı kodu etkilenmez.
//
// Detay: cuttingArtik.ts saf fonksiyon, Supabase import etmiyor → vitest'te
// import edilebilir. cutting.ts ise Supabase'e bağımlı (kesimPlanlariKaydet
// vb.), ondan test edilemez.

export { artikMalzemelerOlustur, type ArtikSuggest } from './cuttingArtik'
