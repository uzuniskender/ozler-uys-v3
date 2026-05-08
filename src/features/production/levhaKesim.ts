/**
 * levhaKesim.ts — 2D Guillotine Cut Algoritması
 * v16.52 — Plywood / Levha kesim optimizasyonu
 *
 * Giriş: Kesilecek parça listesi + levha boyutu
 * Çıkış: Her levhada hangi parçalar nerede, artık alanlar
 *
 * Algoritma: Best-Fit Decreasing Area + Guillotine Split
 * - Parçalar alana göre büyükten küçüğe sıralanır
 * - Her parça için mevcut boşluklara denenır (rotation ile)
 * - En küçük sığan boşluğa yerleştirilir (Best Fit)
 * - Kalan alan iki dikdörtgene bölünür (Guillotine)
 * - Hiç sığmazsa yeni levha açılır
 */

export interface LevhaParca {
  woId: string
  malkod: string
  malad: string
  en: number    // mm
  boy: number   // mm
  adet: number
}

export interface YerlesimParca {
  woId: string
  malkod: string
  malad: string
  en: number
  boy: number
  x: number     // sol üst köşe x
  y: number     // sol üst köşe y
  rotated: boolean  // 90° döndürüldü mü
  adet: number
}

export interface ArtikBolge {
  x: number; y: number; en: number; boy: number
}

export interface LevhaSonuc {
  levhaIndex: number
  parcalar: YerlesimParca[]
  artiklar: ArtikBolge[]
  kullanimOrani: number  // 0-1
  kullanilanAlan: number // mm²
  toplamAlan: number     // mm²
}

export interface LevhaKesimSonuc {
  levhalar: LevhaSonuc[]
  toplamLevha: number
  ortKullanimOrani: number
  hamMalkod: string
  hamEn: number
  hamBoy: number
  toleransMm: number
}

const TOLERANS_MM = 4  // Testere kalınlığı (mm)

/** Boş alanı guillotine ile ikiye böl */
function guillotineBol(
  bosluk: ArtikBolge,
  parcaEn: number,
  parcaBoy: number,
  tolerans: number
): { sagBosluk: ArtikBolge | null; altBosluk: ArtikBolge | null } {
  const sagEn = bosluk.en - parcaEn - tolerans
  const altBoy = bosluk.boy - parcaBoy - tolerans

  // Sağ bölge
  const sagBosluk: ArtikBolge | null = sagEn >= 50 ? {
    x: bosluk.x + parcaEn + tolerans,
    y: bosluk.y,
    en: sagEn,
    boy: parcaBoy
  } : null

  // Alt bölge (tüm genişlik)
  const altBosluk: ArtikBolge | null = altBoy >= 50 ? {
    x: bosluk.x,
    y: bosluk.y + parcaBoy + tolerans,
    en: bosluk.en,
    boy: altBoy
  } : null

  return { sagBosluk, altBosluk }
}

/** Bir parçanın bir boşluğa sığıp sığmadığını kontrol et */
function sigabilir(bosluk: ArtikBolge, en: number, boy: number): boolean {
  return en <= bosluk.en && boy <= bosluk.boy
}

/** Best-Fit: en küçük sığan boşluğu bul */
function bestFit(
  bosluklar: ArtikBolge[],
  en: number,
  boy: number
): { idx: number; rotated: boolean } | null {
  let bestIdx = -1
  let bestAlan = Infinity
  let bestRotated = false

  for (let i = 0; i < bosluklar.length; i++) {
    const b = bosluklar[i]
    // Normal
    if (sigabilir(b, en, boy)) {
      const alan = b.en * b.boy
      if (alan < bestAlan) { bestAlan = alan; bestIdx = i; bestRotated = false }
    }
    // Rotated (90°)
    if (en !== boy && sigabilir(b, boy, en)) {
      const alan = b.en * b.boy
      if (alan < bestAlan) { bestAlan = alan; bestIdx = i; bestRotated = true }
    }
  }

  return bestIdx >= 0 ? { idx: bestIdx, rotated: bestRotated } : null
}

/**
 * Ana fonksiyon — Levha kesim optimizasyonu
 * @param parcalar Kesilecek parçalar (her biri adet adedinde tekrarlanır)
 * @param hamMalkod Ham levha malzeme kodu
 * @param hamEn Levha eni (mm)
 * @param hamBoy Levha boyu (mm)
 */
export function levhaKesimOptimum(
  parcalar: LevhaParca[],
  hamMalkod: string,
  hamEn: number,
  hamBoy: number
): LevhaKesimSonuc {
  const tolerans = TOLERANS_MM

  // Tüm parçaları tekrar sayısına göre genişlet, alana göre büyükten küçüğe sırala
  const tumParcalar: (LevhaParca & { sira: number })[] = []
  parcalar.forEach((p, sira) => {
    for (let i = 0; i < p.adet; i++) {
      tumParcalar.push({ ...p, adet: 1, sira })
    }
  })
  tumParcalar.sort((a, b) => (b.en * b.boy) - (a.en * a.boy))

  const levhalar: LevhaSonuc[] = []
  let bosluklar: ArtikBolge[] = []

  function yeniLevhaAc() {
    levhalar.push({
      levhaIndex: levhalar.length + 1,
      parcalar: [],
      artiklar: [],
      kullanimOrani: 0,
      kullanilanAlan: 0,
      toplamAlan: hamEn * hamBoy
    })
    bosluklar = [{ x: 0, y: 0, en: hamEn, boy: hamBoy }]
  }

  yeniLevhaAc()

  for (const parca of tumParcalar) {
    let yerlestirildi = false

    // Mevcut levhaların boşluklarında dene
    while (!yerlestirildi) {
      const fit = bestFit(bosluklar, parca.en, parca.boy)

      if (fit) {
        const b = bosluklar[fit.idx]
        const gercekEn = fit.rotated ? parca.boy : parca.en
        const gercekBoy = fit.rotated ? parca.en : parca.boy

        // Parçayı yerleştir
        const sonLevha = levhalar[levhalar.length - 1]
        sonLevha.parcalar.push({
          woId: parca.woId,
          malkod: parca.malkod,
          malad: parca.malad,
          en: gercekEn,
          boy: gercekBoy,
          x: b.x,
          y: b.y,
          rotated: fit.rotated,
          adet: 1
        })
        sonLevha.kullanilanAlan += gercekEn * gercekBoy

        // Boşluğu kaldır, yenileri ekle
        bosluklar.splice(fit.idx, 1)
        const { sagBosluk, altBosluk } = guillotineBol(b, gercekEn, gercekBoy, tolerans)
        if (sagBosluk) bosluklar.push(sagBosluk)
        if (altBosluk) bosluklar.push(altBosluk)

        // Boşlukları alana göre küçükten büyüğe sırala (Best Fit için)
        bosluklar.sort((a, b) => (a.en * a.boy) - (b.en * b.boy))

        yerlestirildi = true
      } else {
        // Sığmadı — yeni levha aç
        // Önce mevcut levhanın artıklarını kaydet
        const sonLevha = levhalar[levhalar.length - 1]
        sonLevha.artiklar = bosluklar.filter(b => b.en >= 100 && b.boy >= 100)
        sonLevha.kullanimOrani = sonLevha.kullanilanAlan / sonLevha.toplamAlan
        yeniLevhaAc()
      }
    }
  }

  // Son levhayı kapat
  if (levhalar.length > 0) {
    const sonLevha = levhalar[levhalar.length - 1]
    sonLevha.artiklar = bosluklar.filter(b => b.en >= 100 && b.boy >= 100)
    sonLevha.kullanimOrani = sonLevha.kullanilanAlan / sonLevha.toplamAlan
  }

  const ortKullanimOrani = levhalar.reduce((a, l) => a + l.kullanimOrani, 0) / levhalar.length

  return {
    levhalar,
    toplamLevha: levhalar.length,
    ortKullanimOrani,
    hamMalkod,
    hamEn,
    hamBoy,
    toleransMm: tolerans
  }
}

/**
 * Levha kesim sonucunu uys_kesim_planlari formatına dönüştür
 * Her levha → bir "satır", her parça → "kesim"
 */
export function levhaSonucunaKesimPlaniDonustur(
  sonuc: LevhaKesimSonuc
): { satirlar: any[]; gerekliAdet: number } {
  const satirlar = sonuc.levhalar.map((levha, i) => ({
    id: `levha-${i + 1}`,
    levhaIndex: levha.levhaIndex,
    hamAdet: 1,  // Bu levha 1 adet levha kullanıyor
    fireMm: 0,
    kullanimOrani: Math.round(levha.kullanimOrani * 100),
    kullanilanAlan: levha.kullanilanAlan,
    artiklar: levha.artiklar,
    kesimler: levha.parcalar.map(p => ({
      woId: p.woId,
      malkod: p.malkod,
      malad: p.malad,
      parcaBoy: p.boy,
      parcaEn: p.en,
      x: p.x,
      y: p.y,
      rotated: p.rotated,
      adet: 1,
      tamamlandi: 0
    }))
  }))

  return { satirlar, gerekliAdet: sonuc.toplamLevha }
}

/**
 * PLY WO'larından parça listesi çıkar
 */
export function wolardenParcaListesi(
  wos: Array<{
    id: string
    malkod: string
    malad: string
    hedef: number
    durum: string
    hm?: Array<{ malkod: string; miktarTotal: number }>
  }>,
  hamMalkod: string,
  materials: Array<{ kod: string; en?: number; boy?: number }>
): LevhaParca[] {
  const parcalar: LevhaParca[] = []

  for (const wo of wos) {
    if (wo.durum === 'iptal' || wo.durum === 'tamamlandi') continue
    if (!wo.hm?.some(h => h.malkod === hamMalkod)) continue

    const mat = materials.find(m => m.kod === wo.malkod)
    if (!mat || !mat.en || !mat.boy) continue

    parcalar.push({
      woId: wo.id,
      malkod: wo.malkod,
      malad: wo.malad,
      en: mat.en,
      boy: mat.boy,
      adet: wo.hedef
    })
  }

  return parcalar
}
