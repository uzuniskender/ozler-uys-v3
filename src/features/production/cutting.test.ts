/**
 * v15.48a — Kesim artığı helper birim testleri
 *
 * cutting.ts Supabase'e bağımlı olduğu için doğrudan test edilemez (vitest env
 * hatası verir). Saf fonksiyon `artikMalzemelerOlustur` ayrı modüle taşındı:
 * `cuttingArtik.ts`. Burada onun testleri.
 *
 * cutting.ts'in algoritma kısmı (boykesimOptimum, kesimPlanOlustur) Playwright
 * E2E testlerinde kapsanır.
 *
 * Çalıştırma:
 *   npm run test:unit            (tek seferlik)
 *   npm run test:unit:watch      (sürekli)
 */

import { describe, it, expect } from 'vitest'
import { artikMalzemelerOlustur, type ArtikSuggest } from './cuttingArtik'

// Tip-yardımcı: minimum CuttingPlanForArtik şekli
function plan(opts: {
  hamMalkod?: string
  hamMalad?: string
  satirlar: Array<{ durum: string; fireMm: number; hamAdet: number }>
}) {
  return {
    hamMalkod: opts.hamMalkod ?? 'S275',
    hamMalad: opts.hamMalad ?? 'S275 Profil',
    satirlar: opts.satirlar,
  }
}

// ═══════════════════════════════════════════════════════════════
// SENARYO 1: Sınır durumlar
// ═══════════════════════════════════════════════════════════════
describe('artikMalzemelerOlustur — sınır durumlar', () => {
  it('boş plan → boş array', () => {
    const result = artikMalzemelerOlustur(plan({ satirlar: [] }))
    expect(result).toEqual([])
  })

  it('null plan → boş array (defansif)', () => {
    expect(artikMalzemelerOlustur(null as never)).toEqual([])
  })

  it('undefined plan → boş array (defansif)', () => {
    expect(artikMalzemelerOlustur(undefined as never)).toEqual([])
  })

  it('bekliyor satırlar dahil edilmez (sadece tamamlandi)', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'bekliyor', fireMm: 1240, hamAdet: 5 },  // bekliyor → atılır
      ],
    }))
    expect(result).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════
// SENARYO 2: Eşik filtresi
// ═══════════════════════════════════════════════════════════════
describe('artikMalzemelerOlustur — eşik filtresi', () => {
  it('fire < 50mm atılır (default eşik)', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'tamamlandi', fireMm: 25, hamAdet: 3 },  // <50, atılır
        { durum: 'tamamlandi', fireMm: 49, hamAdet: 2 },  // <50, atılır
        { durum: 'tamamlandi', fireMm: 50, hamAdet: 4 },  // =50, dahil
      ],
    }))
    expect(result).toHaveLength(1)
    expect(result[0].uzunlukMm).toBe(50)
    expect(result[0].adet).toBe(4)
  })

  it('özel ESIK_MM = 100: 50mm atılır, 100mm dahil', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'tamamlandi', fireMm: 50, hamAdet: 1 },
        { durum: 'tamamlandi', fireMm: 100, hamAdet: 1 },
      ],
    }), 100)
    expect(result).toHaveLength(1)
    expect(result[0].uzunlukMm).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════
// SENARYO 3: Adet birleştirme
// ═══════════════════════════════════════════════════════════════
describe('artikMalzemelerOlustur — gruplama ve adet', () => {
  it('aynı uzunluktaki fire farklı satırlardan: adet birleşir', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'tamamlandi', fireMm: 1240, hamAdet: 3 },
        { durum: 'tamamlandi', fireMm: 1240, hamAdet: 2 },
        // 1240mm uzunluğunda toplam 5 bar artık beklenir
      ],
    }))
    expect(result).toHaveLength(1)
    expect(result[0].uzunlukMm).toBe(1240)
    expect(result[0].adet).toBe(5)
  })

  it('farklı uzunluklar: ayrı satırlar, en çok adet üstte', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'tamamlandi', fireMm: 800,  hamAdet: 1 },
        { durum: 'tamamlandi', fireMm: 1240, hamAdet: 5 },
        { durum: 'tamamlandi', fireMm: 600,  hamAdet: 3 },
      ],
    }))
    expect(result).toHaveLength(3)
    // En çok adet → en az adet
    expect(result[0]).toEqual(expect.objectContaining({ uzunlukMm: 1240, adet: 5 }))
    expect(result[1]).toEqual(expect.objectContaining({ uzunlukMm: 600, adet: 3 }))
    expect(result[2]).toEqual(expect.objectContaining({ uzunlukMm: 800, adet: 1 }))
  })

  it('fractional fire 1240.7 → yuvarlanır 1241', () => {
    const result = artikMalzemelerOlustur(plan({
      satirlar: [
        { durum: 'tamamlandi', fireMm: 1240.7, hamAdet: 1 },
      ],
    }))
    expect(result[0].uzunlukMm).toBe(1241)
    expect(result[0].onerilenKod).toBe('ARTIK-S275-1241')
  })
})

// ═══════════════════════════════════════════════════════════════
// SENARYO 4: Önerilen kod ve ad formatı
// ═══════════════════════════════════════════════════════════════
describe('artikMalzemelerOlustur — kod/ad formatı', () => {
  it('onerilenKod: ARTIK-{malkod}-{uzunluk}', () => {
    const result = artikMalzemelerOlustur(plan({
      hamMalkod: 'S275',
      hamMalad: 'S275 Profil',
      satirlar: [
        { durum: 'tamamlandi', fireMm: 1240, hamAdet: 1 },
      ],
    }))
    expect(result[0].onerilenKod).toBe('ARTIK-S275-1240')
    expect(result[0].onerilenAd).toBe('ARTIK S275 Profil (1240mm)')
    expect(result[0].hamMalkod).toBe('S275')   // referans korunur
    expect(result[0].hamMalad).toBe('S275 Profil')
  })

  it('result tip uyumu (ArtikSuggest interface)', () => {
    const result: ArtikSuggest[] = artikMalzemelerOlustur(plan({
      hamMalkod: 'X',
      hamMalad: 'X',
      satirlar: [
        { durum: 'tamamlandi', fireMm: 100, hamAdet: 1 },
      ],
    }))
    expect(result[0]).toHaveProperty('hamMalkod')
    expect(result[0]).toHaveProperty('hamMalad')
    expect(result[0]).toHaveProperty('uzunlukMm')
    expect(result[0]).toHaveProperty('adet')
    expect(result[0]).toHaveProperty('onerilenKod')
    expect(result[0]).toHaveProperty('onerilenAd')
  })
})
