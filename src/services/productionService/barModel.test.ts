/**
 * barModel.ts — Saf fonksiyon birim testleri
 *
 * Supabase'e dokunan barModelSync / acikBarTuket vb. Playwright E2E'de kapsanır.
 * Burada: isBarMaterial, isBarMaterialByKod, deterministik ID üreticiler,
 *         acikBarHavuzuToplamMm.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  isBarMaterial,
  isBarMaterialByKod,
  barAcilisStokId,
  acikBarKayitId,
  acikBarHavuzuToplamMm,
} from './barModel'
import type { Material } from '@/types'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}))

vi.mock('@/lib/utils', () => ({
  today: () => '2026-05-17',
  uid: () => 'test-uid',
}))

function malzeme(overrides: Partial<Material> = {}): Material {
  return {
    id: 'm1', kod: 'TEST', ad: 'Test',
    tip: 'Hammadde', hammaddeTipi: '', birim: 'Adet',
    boy: 0, en: 0, kalinlik: 0, uzunluk: 0, cap: 0, icCap: 0,
    minStok: 0, opId: '', opKod: '',
    revizyon: 0, revizyonTarihi: '', oncekiId: '', aktif: true,
    ...overrides,
  } as Material
}

// ═══════════════════════════════════════════════════════════════
// isBarMaterial
// ═══════════════════════════════════════════════════════════════
describe('isBarMaterial', () => {
  it('undefined → false', () => {
    expect(isBarMaterial(undefined)).toBe(false)
  })

  it('Hammadde ama uzunluk=0 → false', () => {
    expect(isBarMaterial(malzeme({ tip: 'Hammadde', uzunluk: 0 }))).toBe(false)
  })

  it('Hammadde + uzunluk=6000 → true', () => {
    expect(isBarMaterial(malzeme({ tip: 'Hammadde', uzunluk: 6000 }))).toBe(true)
  })

  it('YarıMamul + uzunluk=6000 → false (tip yanlış)', () => {
    expect(isBarMaterial(malzeme({ tip: 'YarıMamul', uzunluk: 6000 }))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// isBarMaterialByKod
// ═══════════════════════════════════════════════════════════════
describe('isBarMaterialByKod', () => {
  const mats: Material[] = [
    malzeme({ kod: 'S275', tip: 'Hammadde', uzunluk: 6000 }),
    malzeme({ kod: 'SARF01', tip: 'Sarf', uzunluk: 0 }),
  ]

  it('boş malkod → false', () => {
    expect(isBarMaterialByKod('', mats)).toBe(false)
  })

  it('listede olmayan kod → false', () => {
    expect(isBarMaterialByKod('XYZ999', mats)).toBe(false)
  })

  it('büyük/küçük harf fark etmez → true', () => {
    expect(isBarMaterialByKod('s275', mats)).toBe(true)
  })

  it('bar model dışı malzeme (uzunluk=0) → false', () => {
    expect(isBarMaterialByKod('SARF01', mats)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Deterministik ID üreticiler
// ═══════════════════════════════════════════════════════════════
describe('barAcilisStokId / acikBarKayitId — deterministik format', () => {
  it('barAcilisStokId: bar-open-{planId}-{satirId}-{idx}', () => {
    expect(barAcilisStokId('PLAN1', 'SATIR1', 0)).toBe('bar-open-PLAN1-SATIR1-0')
    expect(barAcilisStokId('p', 's', 99)).toBe('bar-open-p-s-99')
  })

  it('acikBarKayitId: ab-{planId}-{satirId}-{idx}', () => {
    expect(acikBarKayitId('PLAN1', 'SATIR1', 0)).toBe('ab-PLAN1-SATIR1-0')
    expect(acikBarKayitId('p', 's', 5)).toBe('ab-p-s-5')
  })

  it('aynı parametreler → her çağrıda aynı ID (idempotency)', () => {
    expect(barAcilisStokId('X', 'Y', 2)).toBe(barAcilisStokId('X', 'Y', 2))
  })
})

// ═══════════════════════════════════════════════════════════════
// acikBarHavuzuToplamMm
// ═══════════════════════════════════════════════════════════════
describe('acikBarHavuzuToplamMm', () => {
  const bars = [
    { hamMalkod: 'S275', uzunlukMm: 1240, durum: 'acik' },
    { hamMalkod: 'S275', uzunlukMm: 800,  durum: 'tuketildi' },  // atlanır
    { hamMalkod: 's275', uzunlukMm: 600,  durum: 'acik' },       // case-insensitive
    { hamMalkod: 'S355', uzunlukMm: 2000, durum: 'acik' },
  ]

  it('durum=tuketildi atlanır, acik olanlar toplanır', () => {
    expect(acikBarHavuzuToplamMm('S275', bars)).toBe(1240 + 600)
  })

  it('büyük/küçük harf insensitive', () => {
    expect(acikBarHavuzuToplamMm('s275', bars)).toBe(1840)
  })

  it('farklı malkod → sadece o kodun barları', () => {
    expect(acikBarHavuzuToplamMm('S355', bars)).toBe(2000)
  })

  it('boş dizi → 0', () => {
    expect(acikBarHavuzuToplamMm('S275', [])).toBe(0)
  })
})
