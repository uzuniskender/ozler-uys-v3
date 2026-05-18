/**
 * hesaplaMRP Unit Testleri
 * 
 * Bu testler bugün yaşanan 3 kritik davranış bozukluğunu kapsar:
 * 1. Tamamlanmış sipariş için hesap → 0 ihtiyaç (beklenen davranış)
 * 2. Retrospektif mod → tamamlanmış sipariş geçmiş ihtiyacını göstermeli
 * 3. kalan=0 WO → ihtiyaç üretmemeli (bağımsız YM İE'leri)
 */

import { describe, it, expect } from 'vitest'
import { hesaplaMRP } from '@/services/mrpService'
import type { WorkOrder, Recipe, StokHareket, Tedarik, Material, MrpRezerve } from '@/types'

// ─── Test fixture'ları ───────────────────────────────────────────
const baseOrder = {
  id: 'ord-001',
  adet: 10,
  mamulKod: 'YM-TEST-001',
  receteId: 'rc-001',
  durum: 'aktif',
  termin: '2026-06-01',
  urunler: [{ mamulKod: 'YM-TEST-001', adet: 10, termin: '2026-06-01' }],
}

const baseRecipe: Recipe = {
  id: 'rc-001',
  rcKod: 'RC-001',
  ad: 'Test Reçete',
  bomId: 'bom-001',
  mamulKod: 'YM-TEST-001',
  mamulAd: 'Test Ürün',
  satirlar: [
    {
      id: 'row-001',
      kirno: '',
      malkod: 'HM-TEST-001',
      malad: 'Test Hammadde',
      tip: 'Hammadde',
      miktar: 2,
      birim: 'Adet',
      opId: '',
      istId: '',
      hazirlikSure: 0,
      islemSure: 0,
    },
  ],
}

const baseWorkOrder: WorkOrder = {
  id: 'wo-001',
  orderId: 'ord-001',
  rcId: 'rc-001',
  sira: 1,
  kirno: '1',
  opId: '',
  opKod: '',
  opAd: '',
  istId: '',
  istKod: '',
  istAd: '',
  malkod: 'YM-TEST-001',
  malad: 'Test Ürün',
  hedef: 10,
  mpm: 1,
  hm: [{ malkod: 'HM-TEST-001', malad: 'Test Hammadde', miktarTotal: 2 }],
  ieNo: 'IE-TEST-001',
  whAlloc: 0,
  hazirlikSure: 0,
  islemSure: 0,
  durum: 'devam',
  bagimsiz: false,
  siparisDisi: false,
  termin: '2026-06-01',
  mamulKod: 'YM-TEST-001',
  mamulAd: 'Test Ürün',
  mamulAuto: false,
  operatorId: null,
  not: '',
  olusturma: '2026-01-01',
}

const emptyStok: StokHareket[] = []
const emptyTedarik: Tedarik[] = []
const emptyCutting: any[] = []
const emptyMaterials: Material[] = []
const emptyRezerve: MrpRezerve[] = []

// ─── GRUP 1: Aktif sipariş hesabı ───────────────────────────────
describe('hesaplaMRP — Aktif sipariş', () => {
  it('Hiç üretim yoksa brüt ihtiyaç = adet × birim miktar', () => {
    const logs: { woId: string; qty: number }[] = []
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.brut).toBe(20) // 10 adet × 2 birim
  })

  it('5/10 üretilmişse ihtiyaç yarıya düşmeli', () => {
    const logs = [{ woId: 'wo-001', qty: 5 }]
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.brut).toBeLessThan(20)
    expect(hm!.brut).toBeGreaterThan(0)
  })

  it('10/10 üretilmişse (tamamlandı) ihtiyaç 0 → satır üretilmemeli', () => {
    const logs = [{ woId: 'wo-001', qty: 10 }]
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    // Tamamlanmış sipariş → ihtiyaç yok → ya satır yok ya da brut=0
    if (hm) {
      expect(hm.brut).toBe(0)
    } else {
      expect(hm).toBeUndefined()
    }
  })
})

// ─── GRUP 2: Retrospektif mod ────────────────────────────────────
describe('hesaplaMRP — Retrospektif mod (arşiv)', () => {
  it('Tamamlanmış sipariş — retrospektif=true → toplam ihtiyacı göstermeli', () => {
    const logs = [{ woId: 'wo-001', qty: 10 }] // Tam üretildi
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
      true, // retrospektif=true
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.brut).toBe(20) // 10 × 2 = toplam kullanılan
  })

  it('Retrospektif modda yeterli stok varsa durum=yeterli', () => {
    const logs = [{ woId: 'wo-001', qty: 10 }]
    const stok: StokHareket[] = [
      { id: 'sh-001', tarih: '2026-01-01', malkod: 'HM-TEST-001', malad: '', miktar: 30, tip: 'giris', logId: '', woId: '', aciklama: '' },
    ]
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      stok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
      true,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.durum).toBe('yeterli')
    expect(hm!.net).toBeLessThanOrEqual(0)
  })
})

// ─── GRUP 3: Bağımsız YM İE — kalan kontrolü ────────────────────
describe('hesaplaMRP — Bağımsız YM İE kalan kontrolü', () => {
  const bagimsizWO: WorkOrder = {
    ...baseWorkOrder,
    id: 'wo-bag-001',
    orderId: '',
    bagimsiz: true,
    durum: 'devam',
    hedef: 10,
    hm: [{ malkod: 'HM-TEST-001', malad: 'Test Hammadde', miktarTotal: 5 }],
  }

  it('Bağımsız WO: kalan>0 → ihtiyaç üretmeli', () => {
    const logs: { woId: string; qty: number }[] = []
    const sonuc = hesaplaMRP(
      [],
      [],
      [bagimsizWO],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      new Set(['wo-bag-001']),
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.brut).toBeGreaterThan(0)
  })

  it('Bağımsız WO: durum=tamamlandi → ihtiyaç üretmemeli (normal mod)', () => {
    const tamamWO: WorkOrder = { ...bagimsizWO, durum: 'tamamlandi' }
    const logs = [{ woId: 'wo-bag-001', qty: 10 }]
    const sonuc = hesaplaMRP(
      [],
      [],
      [tamamWO],
      [baseRecipe],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      new Set(['wo-bag-001']),
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    if (hm) expect(hm.brut).toBe(0)
    else expect(hm).toBeUndefined()
  })
})

// ─── GRUP 4: Stok yeterliliği ────────────────────────────────────
describe('hesaplaMRP — Stok yeterliliği', () => {
  it('Stok >= brüt ihtiyaç → durum=yeterli, net=0', () => {
    const stok: StokHareket[] = [
      { id: 'sh-001', tarih: '2026-01-01', malkod: 'HM-TEST-001', malad: '', miktar: 100, tip: 'giris', logId: '', woId: '', aciklama: '' },
    ]
    const logs: { woId: string; qty: number }[] = []
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      stok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.durum).toBe('yeterli')
    expect(hm!.net).toBeLessThanOrEqual(0)
  })

  it('Stok < brüt ihtiyaç → durum=eksik, net>0', () => {
    const stok: StokHareket[] = [
      { id: 'sh-001', tarih: '2026-01-01', malkod: 'HM-TEST-001', malad: '', miktar: 5, tip: 'giris', logId: '', woId: '', aciklama: '' },
    ]
    const logs: { woId: string; qty: number }[] = []
    const sonuc = hesaplaMRP(
      ['ord-001'],
      [baseOrder],
      [baseWorkOrder],
      [baseRecipe],
      stok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      logs,
    )
    const hm = sonuc.find(r => r.malkod === 'HM-TEST-001')
    expect(hm).toBeDefined()
    expect(hm!.durum).toBe('eksik')
    expect(hm!.net).toBeGreaterThan(0)
  })
})

// ─── GRUP 5: Multi-level BOM + ara YM stok netting ─────────────────
describe('Multi-level BOM — ara YM stok netting', () => {
  // A → B(2) YarıMamul, B → D(3) Hammadde
  // bomPatlaNet: derinlik>0'da YM stoğu düşülür (line 66: derinlik > 0 ? ymStok : 0)
  const receteA: Recipe = {
    id: 'rc-multi-a',
    rcKod: 'RC-MULTI-A',
    ad: 'Multi Reçete A',
    bomId: 'bom-multi-a',
    mamulKod: 'YM-MULTI-A',
    mamulAd: 'Multi Ürün A',
    satirlar: [
      { id: 'row-multi-b', kirno: '', malkod: 'YM-MULTI-B', malad: 'Ara YM B', tip: 'YarıMamul', miktar: 2, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const receteB: Recipe = {
    id: 'rc-multi-b',
    rcKod: 'RC-MULTI-B',
    ad: 'Multi Reçete B',
    bomId: 'bom-multi-b',
    mamulKod: 'YM-MULTI-B',
    mamulAd: 'Ara YM B',
    satirlar: [
      { id: 'row-multi-d', kirno: '', malkod: 'HM-MULTI-D', malad: 'Alt Hammadde D', tip: 'Hammadde', miktar: 3, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const orderMulti = {
    id: 'ord-multi-001',
    adet: 5,
    mamulKod: 'YM-MULTI-A',
    receteId: 'rc-multi-a',
    durum: 'aktif',
    termin: '2026-06-01',
    urunler: [{ mamulKod: 'YM-MULTI-A', adet: 5, termin: '2026-06-01' }],
  }

  it('stokta YM varsa sadece üretilecek miktar için alt bileşen hesaplanmalı', () => {
    // B stok=4 → A=5 → B brüt=10, net B=6 → D=6×3=18
    const stokB: StokHareket[] = [
      { id: 'sh-multi-b', tarih: '2026-01-01', malkod: 'YM-MULTI-B', malad: '', miktar: 4, tip: 'giris', logId: '', woId: '', aciklama: '' },
    ]
    const sonuc = hesaplaMRP(
      ['ord-multi-001'],
      [orderMulti],
      [],
      [receteA, receteB],
      stokB,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const d = sonuc.find(r => r.malkod === 'HM-MULTI-D')
    expect(d).toBeDefined()
    expect(d!.brut).toBe(18) // stokta 4B var → sadece 6B üretilecek → 6×3=18
  })

  it('YM stoğu sıfırsa tüm alt bileşenler tam hesaplanmalı', () => {
    // B stok=0 → A=5 → B=5×2=10 → D=10×3=30
    const sonuc = hesaplaMRP(
      ['ord-multi-001'],
      [orderMulti],
      [],
      [receteA, receteB],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const d = sonuc.find(r => r.malkod === 'HM-MULTI-D')
    expect(d).toBeDefined()
    expect(d!.brut).toBe(30) // stok yok → 5×2=10B → 10×3=30D
  })
})

// ─── GRUP 6: FIFO stok paylaşımı — termin sırası ──────────────────
describe('FIFO stok paylaşımı — termin sırası', () => {
  // Aynı hammadde HM-FIFO-D, iki farklı siparişte farklı terminler.
  // brutIhtiyac termin bazında ayrılır → FIFO: erken termin pool'dan önce alır.
  const receteF1: Recipe = {
    id: 'rc-fifo-f1',
    rcKod: 'RC-FIFO-F1',
    ad: 'FIFO Test F1',
    bomId: 'bom-fifo-f1',
    mamulKod: 'YM-FIFO-F1',
    mamulAd: 'FIFO Mamul F1',
    satirlar: [
      { id: 'row-fifo-d1', kirno: '', malkod: 'HM-FIFO-D', malad: 'FIFO Hammadde D', tip: 'Hammadde', miktar: 2, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const receteF2: Recipe = {
    id: 'rc-fifo-f2',
    rcKod: 'RC-FIFO-F2',
    ad: 'FIFO Test F2',
    bomId: 'bom-fifo-f2',
    mamulKod: 'YM-FIFO-F2',
    mamulAd: 'FIFO Mamul F2',
    satirlar: [
      { id: 'row-fifo-d2', kirno: '', malkod: 'HM-FIFO-D', malad: 'FIFO Hammadde D', tip: 'Hammadde', miktar: 2, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const orderErken = {
    id: 'ord-fifo-erken',
    adet: 4,
    mamulKod: 'YM-FIFO-F1',
    receteId: 'rc-fifo-f1',
    durum: 'aktif',
    termin: '2026-05-01',
    urunler: [{ mamulKod: 'YM-FIFO-F1', adet: 4, termin: '2026-05-01' }],
  }
  const orderGec = {
    id: 'ord-fifo-gec',
    adet: 4,
    mamulKod: 'YM-FIFO-F2',
    receteId: 'rc-fifo-f2',
    durum: 'aktif',
    termin: '2026-07-01',
    urunler: [{ mamulKod: 'YM-FIFO-F2', adet: 4, termin: '2026-07-01' }],
  }
  const stokD: StokHareket[] = [
    { id: 'sh-fifo-d', tarih: '2026-01-01', malkod: 'HM-FIFO-D', malad: '', miktar: 10, tip: 'giris', logId: '', woId: '', aciklama: '' },
  ]

  it('erken terminli sipariş stoktan önce yararlanmalı', () => {
    // Erken brut=8, stok=10 → erken 8 alır, net=0
    const sonuc = hesaplaMRP(
      null,
      [orderErken, orderGec],
      [],
      [receteF1, receteF2],
      stokD,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const erken = sonuc.find(r => r.malkod === 'HM-FIFO-D' && r.termin === '2026-05-01')
    expect(erken).toBeDefined()
    expect(erken!.brut).toBe(8)  // 2×4
    expect(erken!.stok).toBe(8)  // 8 stoktan karşılandı
    expect(erken!.net).toBe(0)
    expect(erken!.durum).toBe('yeterli')
  })

  it('stok tükenince sonraki sipariş sıfır stok görür', () => {
    // Geç brut=8, pool'da 2 kaldı → stok=2, net=6
    const sonuc = hesaplaMRP(
      null,
      [orderErken, orderGec],
      [],
      [receteF1, receteF2],
      stokD,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const gec = sonuc.find(r => r.malkod === 'HM-FIFO-D' && r.termin === '2026-07-01')
    expect(gec).toBeDefined()
    expect(gec!.brut).toBe(8)  // 2×4
    expect(gec!.stok).toBe(2)  // pool'da kalan 2
    expect(gec!.net).toBe(6)   // 8-2=6 eksik
    expect(gec!.durum).toBe('eksik')
  })
})

// ─── GRUP 7: Ortak hammadde — çoklu reçete toplama ────────────────
describe('Ortak hammadde — çoklu reçete toplama', () => {
  // K1 → HM-ORT-D(3), K2 → HM-ORT-D(5), aynı termin → aynı grupKey'de toplanır
  const receteK1: Recipe = {
    id: 'rc-ort-k1',
    rcKod: 'RC-ORT-K1',
    ad: 'Ortak Test K1',
    bomId: 'bom-ort-k1',
    mamulKod: 'YM-ORT-K1',
    mamulAd: 'Ortak Mamul K1',
    satirlar: [
      { id: 'row-ort-d1', kirno: '', malkod: 'HM-ORT-D', malad: 'Ortak Hammadde D', tip: 'Hammadde', miktar: 3, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const receteK2: Recipe = {
    id: 'rc-ort-k2',
    rcKod: 'RC-ORT-K2',
    ad: 'Ortak Test K2',
    bomId: 'bom-ort-k2',
    mamulKod: 'YM-ORT-K2',
    mamulAd: 'Ortak Mamul K2',
    satirlar: [
      { id: 'row-ort-d2', kirno: '', malkod: 'HM-ORT-D', malad: 'Ortak Hammadde D', tip: 'Hammadde', miktar: 5, birim: 'Adet', opId: '', istId: '', hazirlikSure: 0, islemSure: 0 },
    ],
  }
  const orderK1 = {
    id: 'ord-ort-k1',
    adet: 2,
    mamulKod: 'YM-ORT-K1',
    receteId: 'rc-ort-k1',
    durum: 'aktif',
    termin: '2026-06-01',
    urunler: [{ mamulKod: 'YM-ORT-K1', adet: 2, termin: '2026-06-01' }],
  }
  const orderK2 = {
    id: 'ord-ort-k2',
    adet: 1,
    mamulKod: 'YM-ORT-K2',
    receteId: 'rc-ort-k2',
    durum: 'aktif',
    termin: '2026-06-01',
    urunler: [{ mamulKod: 'YM-ORT-K2', adet: 1, termin: '2026-06-01' }],
  }

  it('aynı hammadde farklı reçetelerden doğru toplanmalı', () => {
    // K1: 3×2=6, K2: 5×1=5 → aynı termin grupKey → brut=11
    const sonuc = hesaplaMRP(
      null,
      [orderK1, orderK2],
      [],
      [receteK1, receteK2],
      emptyStok,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const d = sonuc.find(r => r.malkod === 'HM-ORT-D')
    expect(d).toBeDefined()
    expect(d!.brut).toBe(11) // 6+5=11
  })

  it('toplam net ihtiyaç stok düşüldükten sonra doğru çıkmalı', () => {
    // brut=11, stok=4 → net=7
    const stokD: StokHareket[] = [
      { id: 'sh-ort-d', tarih: '2026-01-01', malkod: 'HM-ORT-D', malad: '', miktar: 4, tip: 'giris', logId: '', woId: '', aciklama: '' },
    ]
    const sonuc = hesaplaMRP(
      null,
      [orderK1, orderK2],
      [],
      [receteK1, receteK2],
      stokD,
      emptyTedarik,
      emptyCutting,
      emptyMaterials,
      null,
      emptyRezerve,
      undefined,
      [],
    )
    const d = sonuc.find(r => r.malkod === 'HM-ORT-D')
    expect(d).toBeDefined()
    expect(d!.stok).toBe(4)
    expect(d!.net).toBe(7)  // 11-4=7
    expect(d!.durum).toBe('eksik')
  })
})
