/**
 * mrpEngine Unit Testleri
 *
 * explodeBOM, aggregateBOM, netting fonksiyonları için saf fonksiyon testleri.
 * Supabase / DOM gerektirmez — node ortamında çalışır.
 */

import { describe, it, expect } from 'vitest'
import { explodeBOM, aggregateBOM, netting } from '@/services/mrpService/mrpEngine'
import type { Recipe, StokHareket, Tedarik } from '@/types'

// ─── Yardımcı factory'ler ─────────────────────────────────────────

function makeRecipe(mamulKod: string, satirlar: Recipe['satirlar']): Recipe {
  return {
    id: `rc-${mamulKod}`,
    rcKod: `RC-${mamulKod}`,
    ad: mamulKod,
    bomId: `bom-${mamulKod}`,
    mamulKod,
    mamulAd: mamulKod,
    satirlar,
  }
}

function satir(
  malkod: string,
  miktar: number,
  tip: string = 'Hammadde',
  kirno: string = '',
): Recipe['satirlar'][0] {
  return {
    id: `row-${malkod}`,
    kirno,
    malkod,
    malad: malkod,
    tip,
    miktar,
    birim: 'Adet',
    opId: '',
    istId: '',
    hazirlikSure: 0,
    islemSure: 0,
  }
}

function giris(malkod: string, miktar: number): StokHareket {
  return {
    id: `sh-${malkod}-${miktar}`,
    tarih: '2026-01-01',
    malkod,
    malad: malkod,
    miktar,
    tip: 'giris',
    logId: '',
    woId: '',
    aciklama: '',
  }
}

function tedarik(malkod: string, miktar: number, geldi = false): Tedarik {
  return {
    id: `ted-${malkod}`,
    malkod,
    malad: malkod,
    miktar,
    birim: 'Adet',
    orderId: '',
    siparisNo: '',
    durum: 'bekleniyor',
    geldi,
    teslimTarihi: '2026-06-01',
    tedarikcId: '',
    tedarikcAd: '',
    not: '',
    tarih: '2026-01-01',
  }
}

// ═══════════════════════════════════════════════════════════════════
// KATMAN 1 — explodeBOM
// ═══════════════════════════════════════════════════════════════════

describe('explodeBOM', () => {
  it('Reçete bulunamadığında boş dizi döner', () => {
    const result = explodeBOM('MAMUL-YOK', 10, [], [])
    expect(result).toEqual([])
  })

  it('adet <= 0 olduğunda boş dizi döner', () => {
    const rc = makeRecipe('MAMUL-A', [satir('HM-001', 2)])
    expect(explodeBOM('MAMUL-A', 0, [rc], [])).toEqual([])
    expect(explodeBOM('MAMUL-A', -5, [rc], [])).toEqual([])
  })

  it('Flat BOM — tek hammadde, miktar adet ile doğru çarpılır', () => {
    const rc = makeRecipe('MAMUL-B', [satir('HM-101', 3)])
    const result = explodeBOM('MAMUL-B', 5, [rc], [])
    expect(result).toHaveLength(1)
    expect(result[0].malkod).toBe('HM-101')
    expect(result[0].miktar).toBe(15) // 3 × 5
    expect(result[0].tip).toBe('Hammadde')
  })

  it('Flat BOM — birden fazla malzeme hepsini döner', () => {
    const rc = makeRecipe('MAMUL-C', [
      satir('HM-201', 2),
      satir('HM-202', 4),
      satir('SARF-301', 1, 'Sarf'),
    ])
    const result = explodeBOM('MAMUL-C', 2, [rc], [])
    expect(result).toHaveLength(3)
    const hm201 = result.find(r => r.malkod === 'HM-201')
    expect(hm201?.miktar).toBe(4)  // 2 × 2
    const sarf = result.find(r => r.malkod === 'SARF-301')
    expect(sarf?.miktar).toBe(2)   // 1 × 2
    expect(sarf?.tip).toBe('Sarf')
  })

  it('Flat BOM — YarıMamul rekürsif patlama: alt hammaddeler de listelenir', () => {
    const rcAlt = makeRecipe('YM-001', [satir('HM-ALT-001', 4)])
    const rcUst = makeRecipe('MAMUL-D', [satir('YM-001', 2, 'YarıMamul')])
    const result = explodeBOM('MAMUL-D', 3, [rcUst, rcAlt], [])

    // YM-001 kendisi + HM-ALT-001 (rekürsif)
    const ymLine = result.find(r => r.malkod === 'YM-001')
    expect(ymLine).toBeDefined()
    expect(ymLine?.tip).toBe('YarıMamul')
    expect(ymLine?.miktar).toBe(6) // 2 × 3

    const hmLine = result.find(r => r.malkod === 'HM-ALT-001')
    expect(hmLine).toBeDefined()
    expect(hmLine?.miktar).toBe(24) // 4 × (2 × 3)
  })

  it('Dongu korumasi: mamul kendi BOMuna referans verirse sonsuz donguye girmez', () => {
    const rcDongu = makeRecipe('MAMUL-DONGU', [satir('MAMUL-DONGU', 1, 'YarıMamul')])
    const result = explodeBOM('MAMUL-DONGU', 5, [rcDongu], [])
    // Döngü kırıldığı için sonlu bir liste dönmeli
    expect(Array.isArray(result)).toBe(true)
  })

  it('Rekürsif derinlik > 10 olduğunda güvenlik durağı devreye girer', () => {
    // 12 katmanlı zincirleme YM — derinlik > 10 aşılınca durmalı
    const recipes: Recipe[] = []
    for (let i = 0; i <= 12; i++) {
      const altkod = i < 12 ? `YM-D${i + 1}` : 'HM-DERIN'
      const tip = i < 12 ? 'YarıMamul' : 'Hammadde'
      recipes.push(makeRecipe(`YM-D${i}`, [satir(altkod, 1, tip)]))
    }
    const result = explodeBOM('YM-D0', 1, recipes, [])
    // Derin zincir 10'dan fazla açılmamalı
    expect(result.length).toBeLessThan(15)
  })

  it('Satırda malkod boşsa satır atlanır', () => {
    const rc = makeRecipe('MAMUL-E', [
      { id: 'row-bos', kirno: '', malkod: '', malad: '', tip: 'Hammadde', miktar: 1, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
      satir('HM-999', 5),
    ])
    const result = explodeBOM('MAMUL-E', 2, [rc], [])
    expect(result).toHaveLength(1)
    expect(result[0].malkod).toBe('HM-999')
  })
})

// ═══════════════════════════════════════════════════════════════════
// KATMAN 2 — aggregateBOM
// ═══════════════════════════════════════════════════════════════════

describe('aggregateBOM', () => {
  it('Boş liste → boş obje döner', () => {
    expect(aggregateBOM([])).toEqual({})
  })

  it('Tek satır → brut doğru atanır', () => {
    const result = aggregateBOM([
      { malkod: 'HM-001', malad: 'HM-001', tip: 'Hammadde', birim: 'Adet', miktar: 7, termin: '2026-06-01' },
    ])
    const key = 'hm-001__2026-06-01'
    expect(result[key]).toBeDefined()
    expect(result[key].brut).toBe(7)
  })

  it('Aynı malkod + aynı termin → brut toplanır', () => {
    const lines = [
      { malkod: 'HM-002', malad: 'HM-002', tip: 'Hammadde', birim: 'Adet', miktar: 10, termin: '2026-06-01' },
      { malkod: 'HM-002', malad: 'HM-002', tip: 'Hammadde', birim: 'Adet', miktar: 15, termin: '2026-06-01' },
    ]
    const result = aggregateBOM(lines)
    const key = 'hm-002__2026-06-01'
    expect(result[key].brut).toBe(25)
  })

  it('Aynı malkod, farklı termin → ayrı gruplar oluşur', () => {
    const lines = [
      { malkod: 'HM-003', malad: 'HM-003', tip: 'Hammadde', birim: 'Adet', miktar: 5, termin: '2026-05-01' },
      { malkod: 'HM-003', malad: 'HM-003', tip: 'Hammadde', birim: 'Adet', miktar: 8, termin: '2026-06-01' },
    ]
    const result = aggregateBOM(lines)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['hm-003__2026-05-01'].brut).toBe(5)
    expect(result['hm-003__2026-06-01'].brut).toBe(8)
  })

  it('YarıMamul satırları excludeYM=true (varsayılan) olunca hariç tutulur', () => {
    const lines = [
      { malkod: 'YM-001', malad: 'YM', tip: 'YarıMamul', birim: 'Adet', miktar: 3 },
      { malkod: 'HM-004', malad: 'HM', tip: 'Hammadde', birim: 'Adet', miktar: 6 },
    ]
    const result = aggregateBOM(lines)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['hm-004__'].brut).toBe(6)
  })

  it('YarıMamul satırları excludeYM=false olunca dahil edilir', () => {
    const lines = [
      { malkod: 'YM-001', malad: 'YM', tip: 'YarıMamul', birim: 'Adet', miktar: 3 },
      { malkod: 'HM-004', malad: 'HM', tip: 'Hammadde', birim: 'Adet', miktar: 6 },
    ]
    const result = aggregateBOM(lines, false)
    expect(Object.keys(result)).toHaveLength(2)
  })

  it('Kesirli toplam Math.ceil ile yuvarlanır', () => {
    const lines = [
      { malkod: 'HM-005', malad: '', tip: 'Hammadde', birim: 'Adet', miktar: 1.3 },
      { malkod: 'HM-005', malad: '', tip: 'Hammadde', birim: 'Adet', miktar: 1.3 },
    ]
    const result = aggregateBOM(lines)
    // 1.3 + 1.3 = 2.6 → Math.ceil → 3
    expect(result['hm-005__'].brut).toBe(3)
  })

  it('Malkod büyük/küçük harf farkı gözetmez — aynı grupta toplanır', () => {
    const lines = [
      { malkod: 'hm-006', malad: '', tip: 'Hammadde', birim: 'Adet', miktar: 4, termin: '2026-01-01' },
      { malkod: 'HM-006', malad: '', tip: 'Hammadde', birim: 'Adet', miktar: 6, termin: '2026-01-01' },
    ]
    const result = aggregateBOM(lines)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['hm-006__2026-01-01'].brut).toBe(10)
  })
})

// ═══════════════════════════════════════════════════════════════════
// KATMAN 3 — netting
// ═══════════════════════════════════════════════════════════════════

describe('netting', () => {
  it('Boş brutMap → boş dizi döner', () => {
    expect(netting({}, [], [])).toEqual([])
  })

  it('Stok yeterli → net=0, durum=yeterli', () => {
    const brutMap = {
      'hm-a__2026-06-01': { malkod: 'HM-A', malad: 'HM-A', tip: 'Hammadde', birim: 'Adet', miktar: 10, brut: 10, termin: '2026-06-01' },
    }
    const result = netting(brutMap, [giris('HM-A', 20)], [])
    expect(result).toHaveLength(1)
    expect(result[0].net).toBe(0)
    expect(result[0].durum).toBe('yeterli')
    expect(result[0].stok).toBe(10)
  })

  it('Stok yetersiz → net>0, durum=eksik', () => {
    const brutMap = {
      'hm-b__2026-06-01': { malkod: 'HM-B', malad: 'HM-B', tip: 'Hammadde', birim: 'Adet', miktar: 30, brut: 30, termin: '2026-06-01' },
    }
    const result = netting(brutMap, [giris('HM-B', 5)], [])
    expect(result[0].net).toBe(25)
    expect(result[0].durum).toBe('eksik')
    expect(result[0].stok).toBe(5)
  })

  it('Stok yokken açık tedarik kısmen karşılar', () => {
    const brutMap = {
      'hm-c__2026-06-01': { malkod: 'HM-C', malad: 'HM-C', tip: 'Hammadde', birim: 'Adet', miktar: 20, brut: 20, termin: '2026-06-01' },
    }
    const result = netting(brutMap, [], [tedarik('HM-C', 12)])
    expect(result[0].acikTedarik).toBe(12)
    expect(result[0].net).toBe(8)  // 20 - 12
    expect(result[0].durum).toBe('eksik')
  })

  it('Stok + açık tedarik birlikte brütü karşılarsa net=0, durum=yeterli', () => {
    const brutMap = {
      'hm-d__2026-06-01': { malkod: 'HM-D', malad: 'HM-D', tip: 'Hammadde', birim: 'Adet', miktar: 25, brut: 25, termin: '2026-06-01' },
    }
    const result = netting(brutMap, [giris('HM-D', 10)], [tedarik('HM-D', 15)])
    expect(result[0].stok).toBe(10)
    expect(result[0].acikTedarik).toBe(15)
    expect(result[0].net).toBe(0)
    expect(result[0].durum).toBe('yeterli')
  })

  it('FIFO termin sırası: erken termin önce stoktan alır', () => {
    // Aynı malkod, iki farklı termin. Stok 10. Erken termin 8 almalı, geç termin 2 almalı.
    const brutMap = {
      'hm-e__2026-05-01': { malkod: 'HM-E', malad: 'HM-E', tip: 'Hammadde', birim: 'Adet', miktar: 8, brut: 8, termin: '2026-05-01' },
      'hm-e__2026-07-01': { malkod: 'HM-E', malad: 'HM-E', tip: 'Hammadde', birim: 'Adet', miktar: 8, brut: 8, termin: '2026-07-01' },
    }
    const result = netting(brutMap, [giris('HM-E', 10)], [])

    const erken = result.find(r => r.termin === '2026-05-01')
    const gec   = result.find(r => r.termin === '2026-07-01')

    // Erken termin 8 adet stokla tam karşılanır
    expect(erken?.stok).toBe(8)
    expect(erken?.net).toBe(0)

    // Geç termin kalan 2 ile kısmen karşılanır → 6 eksik
    expect(gec?.stok).toBe(2)
    expect(gec?.net).toBe(6)
  })

  it('YarıMamul satırları netting sonucuna dahil edilmez', () => {
    const brutMap = {
      'ym-001__2026-06-01': { malkod: 'YM-001', malad: 'YM-001', tip: 'YarıMamul', birim: 'Adet', miktar: 5, brut: 5, termin: '2026-06-01' },
      'hm-f__2026-06-01':   { malkod: 'HM-F', malad: 'HM-F', tip: 'Hammadde', birim: 'Adet', miktar: 10, brut: 10, termin: '2026-06-01' },
    }
    const result = netting(brutMap, [], [])
    expect(result.some(r => r.malkod === 'YM-001')).toBe(false)
    expect(result.some(r => r.malkod === 'HM-F')).toBe(true)
  })

  it('Geldi=true olan tedarik açık tedarik olarak sayılmaz', () => {
    const brutMap = {
      'hm-g__2026-06-01': { malkod: 'HM-G', malad: 'HM-G', tip: 'Hammadde', birim: 'Adet', miktar: 20, brut: 20, termin: '2026-06-01' },
    }
    const gelmisTedarik = tedarik('HM-G', 100, true) // geldi=true
    const result = netting(brutMap, [], [gelmisTedarik])
    // Gelen tedarik sayılmamalı, tüm ihtiyaç net olarak kalmalı
    expect(result[0].acikTedarik).toBe(0)
    expect(result[0].net).toBe(20)
  })
})
