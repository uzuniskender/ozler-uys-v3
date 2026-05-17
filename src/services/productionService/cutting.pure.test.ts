/**
 * cutting.ts — Saf fonksiyon birim testleri (getParcaBoy, getHamBoy)
 *
 * cutting.ts Supabase import eder; vi.mock ile izole edildi.
 * kesimPlanOlustur / boykesimOptimum Playwright E2E'de kapsanır.
 *
 * NOT: getParcaBoy'daki fallback regex `/(\\d{3,5})\\s*[mM]{2}/`
 * bozuktur (çift kaçış) — malkod string'inden boy parse edilmez.
 * Bu davranış test 4'te doğrulanmıştır.
 */

import { describe, it, expect, vi } from 'vitest'
import { getParcaBoy, getHamBoy } from './cutting'
import type { Material } from '@/types'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/utils', () => ({
  uid: () => 'uid-test',
  today: () => '2026-05-17',
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
// getParcaBoy — malzeme tablosundan parça boy tespiti
// ═══════════════════════════════════════════════════════════════
describe('getParcaBoy', () => {
  it('malzeme uzunluk>0 → uzunluk döner', () => {
    const mats = [malzeme({ kod: 'PARCA1', uzunluk: 300 })]
    expect(getParcaBoy('PARCA1', mats)).toBe(300)
  })

  it('uzunluk=0, sadece boy dolu → boy döner', () => {
    const mats = [malzeme({ kod: 'PARCA1', uzunluk: 0, boy: 450, en: 0 })]
    expect(getParcaBoy('PARCA1', mats)).toBe(450)
  })

  it('hem boy hem en dolu → min(boy, en) döner (kısa kenar kesim)', () => {
    const mats = [malzeme({ kod: 'PARCA1', uzunluk: 0, boy: 500, en: 300 })]
    expect(getParcaBoy('PARCA1', mats)).toBe(300)
  })

  it('malzeme yok + fallback regex bozuk → 0 döner', () => {
    // Çift kaçış /(\\d...)/ → literal \d eşleşmez, 0 beklenir
    expect(getParcaBoy('BILINMEYEN-600MM', [])).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// getHamBoy — ham bar uzunluğu tespiti
// ═══════════════════════════════════════════════════════════════
describe('getHamBoy', () => {
  it('uzunluk>0 → uzunluk döner', () => {
    expect(getHamBoy(malzeme({ uzunluk: 6000, boy: 0, en: 0 }))).toBe(6000)
  })

  it('uzunluk=0, max(boy, en) döner', () => {
    expect(getHamBoy(malzeme({ uzunluk: 0, boy: 3000, en: 4000 }))).toBe(4000)
    expect(getHamBoy(malzeme({ uzunluk: 0, boy: 4000, en: 3000 }))).toBe(4000)
  })

  it('ad içinde MM kalıbı → doğru boy parse edilir', () => {
    const m = malzeme({ uzunluk: 0, boy: 0, en: 0, ad: 'BORU 48x3 - 6000MM', kod: '' })
    expect(getHamBoy(m)).toBe(6000)
  })

  it('birden fazla sayı, ≥500 olan en büyüğü alınır', () => {
    const m = malzeme({ uzunluk: 0, boy: 0, en: 0, ad: 'PROFIL 40x40 - 3000MM', kod: '' })
    expect(getHamBoy(m)).toBe(3000)
  })
})
