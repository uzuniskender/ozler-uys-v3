/**
 * hesaplaMRP Unit Testleri
 * 
 * Bu testler bugün yaşanan 3 kritik davranış bozukluğunu kapsar:
 * 1. Tamamlanmış sipariş için hesap → 0 ihtiyaç (beklenen davranış)
 * 2. Retrospektif mod → tamamlanmış sipariş geçmiş ihtiyacını göstermeli
 * 3. kalan=0 WO → ihtiyaç üretmemeli (bağımsız YM İE'leri)
 */

import { describe, it, expect } from 'vitest'
import { hesaplaMRP } from './mrp'
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
      kirno: '1',
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
