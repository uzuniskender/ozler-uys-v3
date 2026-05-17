/**
 * fireTelafi.ts — Guard ve filtreleme birim testleri
 *
 * Supabase'e bağlı async akışlar vi.mock ile izole edilir.
 * Burada: null-dönüş guard'ları (qty<1, telafiWoId, orijinalWo),
 *         hata mesajı doğruları, topluFireTelafi filtreleme mantığı.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  fireTelafiIeOlustur,
  fireTelafiAkisi,
  topluFireTelafi,
} from './fireTelafi'
import type { FireLog, WorkOrder, Recipe } from '@/types'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}))

vi.mock('@/lib/utils', () => ({
  uid: () => 'test-uid-123',
  today: () => '2026-05-17',
}))

vi.mock('@/lib/hammaddeHesap', () => ({
  getStok: vi.fn().mockReturnValue(0),
}))

function firelog(overrides: Partial<FireLog> = {}): FireLog {
  return {
    id: 'fire-1', logId: 'log-1', woId: 'wo-1',
    tarih: '2026-05-17', malkod: 'MAL1', malad: 'Malzeme 1',
    qty: 5, ieNo: 'IE-001', opAd: 'Kaynak',
    operatorlar: [], not: '',
    ...overrides,
  }
}

function workorder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1', orderId: 'ord-1', rcId: 'rc-1',
    sira: 1, kirno: '', opId: 'op-1', opKod: 'KY', opAd: 'Kaynak',
    istId: '', istKod: '', istAd: '',
    malkod: 'MAL1', malad: 'Malzeme 1',
    hedef: 10, mpm: 1, hm: [], ieNo: 'IE-001',
    whAlloc: 0, hazirlikSure: 0, islemSure: 0,
    durum: 'bekliyor', bagimsiz: false, siparisDisi: false,
    termin: '', mamulKod: 'MAL1', mamulAd: 'Malzeme 1',
    mamulAuto: false, operatorId: null, not: '',
    ...overrides,
  } as WorkOrder
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'rc-1', rcKod: '', ad: '', bomId: '',
    mamulKod: 'MAL1', mamulAd: '', satirlar: [],
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════
// fireTelafiIeOlustur — guard kontrolleri (null dönüşler)
// ═══════════════════════════════════════════════════════════════
describe('fireTelafiIeOlustur — guard kontrolleri', () => {
  it('qty=0 → null', async () => {
    expect(await fireTelafiIeOlustur(firelog({ qty: 0 }), workorder())).toBeNull()
  })

  it('qty negatif → null', async () => {
    expect(await fireTelafiIeOlustur(firelog({ qty: -3 }), workorder())).toBeNull()
  })

  it('telafiWoId zaten dolu → null', async () => {
    expect(
      await fireTelafiIeOlustur(firelog({ telafiWoId: 'wo-mevcut' }), workorder()),
    ).toBeNull()
  })

  it('orijinalWo null → null', async () => {
    expect(await fireTelafiIeOlustur(firelog(), null as never)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════
// fireTelafiAkisi — hata yolları ve başarılı tek-WO yolu
// ═══════════════════════════════════════════════════════════════
describe('fireTelafiAkisi — guard hata mesajları', () => {
  it('qty=0 → hatalar içinde "Fire miktarı sıfır veya negatif"', async () => {
    const sonuc = await fireTelafiAkisi(
      firelog({ qty: 0 }),
      workorder(),
      recipe(), [], [], [],
    )
    expect(sonuc.hatalar).toContain('Fire miktarı sıfır veya negatif')
    expect(sonuc.acilenWoIds).toHaveLength(0)
  })

  it('telafiWoId dolu → hatalar içinde "Bu fire için telafi zaten açıldı"', async () => {
    const sonuc = await fireTelafiAkisi(
      firelog({ telafiWoId: 'wo-mevcut' }),
      workorder(),
      recipe(), [], [], [],
    )
    expect(sonuc.hatalar).toContain('Bu fire için telafi zaten açıldı')
    expect(sonuc.acilenWoIds).toHaveLength(0)
  })

  it('geçerli fire + kirno="" → üst WO açılır, alt zincir yok', async () => {
    const sonuc = await fireTelafiAkisi(
      firelog({ qty: 3 }),
      workorder({ kirno: '' }),
      recipe(), [], [], [],
    )
    expect(sonuc.hatalar).toHaveLength(0)
    expect(sonuc.acilenWoIds).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// topluFireTelafi — filtreleme mantığı
// ═══════════════════════════════════════════════════════════════
describe('topluFireTelafi — filtreleme', () => {
  it('tüm fireler zaten telafi edilmiş → basarili=0, hata=0', async () => {
    const fires: FireLog[] = [
      firelog({ qty: 3, telafiWoId: 'wo-x' }),
      firelog({ qty: 5, telafiWoId: 'wo-y' }),
    ]
    const sonuc = await topluFireTelafi(fires, [])
    expect(sonuc.basarili).toBe(0)
    expect(sonuc.hata).toBe(0)
    expect(sonuc.olusturulanIeNolar).toHaveLength(0)
  })

  it('qty=0 fire atlanır, işlenmez', async () => {
    const fires: FireLog[] = [
      firelog({ qty: 0 }),
      firelog({ qty: 0, id: 'fire-2' }),
    ]
    const sonuc = await topluFireTelafi(fires, [])
    expect(sonuc.basarili).toBe(0)
    expect(sonuc.hata).toBe(0)
  })

  it('telafisiz fire ama eşleşen WO yok → hata sayısı artar', async () => {
    const fires: FireLog[] = [firelog({ qty: 2, woId: 'WO-YOOOOK' })]
    const sonuc = await topluFireTelafi(fires, [])
    expect(sonuc.hata).toBe(1)
    expect(sonuc.hatalar[0]).toContain('orijinal İE bulunamadı')
  })
})
