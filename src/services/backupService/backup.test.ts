/**
 * Backup servisi Unit Testleri
 *
 * Kapsam:
 *   - detectBackupVersion  : v3 / v22 / unknown format tespiti
 *   - takeBackup            : input validation, DB hatası, başarılı yedek
 *   - cleanOldBackups       : keepDays < 1, başarılı silme, DB hatası
 *   - restoreBackup         : 11 senaryo — input validation, güvenlik yedeği,
 *                             versiyon kontrolü, merge/replace akışları,
 *                             hata yayılımı, 500+ kayıt chunking
 *
 * Mock stratejisi:
 *   Supabase fluent builder tamamen mock. Her method self döndürür → thenable.
 *   Tablo başına çağrı sayacı ile farklı çağrılar farklı sonuç alır.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── vi.hoisted: vi.mock factory'den önce çalışır ────────────────────────────

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
  fetchAll: vi.fn(),
}))

// ─── Imports ────────────────────────────────────────────────────────────────

import {
  restoreBackup,
  takeBackup,
  cleanOldBackups,
  type BackupSnapshot,
} from '@/services/backupService'
import { detectBackupVersion } from '@/services/backupService/backup-parser'

// ─── Supabase chain builder ──────────────────────────────────────────────────

/**
 * Tüm Supabase fluent metodları self döndürür; await → result çözümlenir.
 * Böylece .from(t).select().eq().single() gibi her zincir doğru sonucu verir.
 */
function makeChain(result: any) {
  const self: any = {
    then: (resolve: (v: any) => any, reject?: (e: any) => any) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (fn: (e: any) => any) => Promise.resolve(result).catch(fn),
  }
  ;[
    'select', 'insert', 'delete', 'upsert', 'update',
    'not', 'is', 'single', 'order', 'eq', 'lt', 'gte',
    'limit', 'neq', 'filter',
  ].forEach(m => { self[m] = (..._: any[]) => self })
  return self
}

// ─── Test helpers ────────────────────────────────────────────────────────────

/** Minimal v3 snapshot; tableData ile istenen tablolara veri ekle */
function makeV3Snapshot(tableData: Record<string, any[]> = {}): BackupSnapshot {
  return {
    _version: 'v3',
    _takenAt: '2026-01-01T00:00:00.000Z',
    _takenBy: 'test-user',
    tables: {
      uys_orders: [],
      uys_work_orders: [],
      ...tableData,
    },
  }
}

/** uys_yedekler DB satırı fixture */
function makeYedekRow(snapshot: any, id = 'backup-abc') {
  return {
    id,
    alindi_tarih: '2026-01-01',
    alindi_saat: '2026-01-01T10:00:00Z',
    alan_kisi: 'test-user',
    tip: 'manuel' as const,
    boyut_kb: 10,
    veri: snapshot,
    notlar: null,
  }
}

/**
 * Standart happy-path mock:
 *   - Tüm BACKUP_TABLES select: boş veri
 *   - uys_yedekler 1. çağrı (insert): { data: { id: 'guv-id' } }
 *   - uys_yedekler 2. çağrı (select): tam backup satırı
 *   - Her diğer çağrı: { data: [], error: null }
 */
function setupHappyPath(snapshot: BackupSnapshot, backupId = 'backup-abc') {
  let yedeklerCount = 0
  mockFrom.mockImplementation((table: string) => {
    if (table === 'uys_yedekler') {
      yedeklerCount++
      if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
      return makeChain({ data: makeYedekRow(snapshot, backupId), error: null })
    }
    return makeChain({ data: [], error: null })
  })
}

// ─── detectBackupVersion ─────────────────────────────────────────────────────

describe('detectBackupVersion', () => {
  it('v3 formatını tanır', () => {
    expect(detectBackupVersion({ _version: 'v3', tables: {} })).toBe('v3')
  })

  it('v22 formatını tanır — workOrders', () => {
    expect(detectBackupVersion({ orders: [], workOrders: [] })).toBe('v22')
  })

  it('v22 formatını tanır — work_orders', () => {
    expect(detectBackupVersion({ orders: [], work_orders: [] })).toBe('v22')
  })

  it('bilinmeyen format → unknown', () => {
    expect(detectBackupVersion({ foo: 'bar' })).toBe('unknown')
  })

  it('null input → unknown', () => {
    expect(detectBackupVersion(null)).toBe('unknown')
  })

  it('_version:v3 ama tables eksik → unknown', () => {
    expect(detectBackupVersion({ _version: 'v3' })).toBe('unknown')
  })
})

// ─── takeBackup ──────────────────────────────────────────────────────────────

describe('takeBackup', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
  })

  it('alanKisi boş → ok:false, Supabase çağrısı yok', async () => {
    const r = await takeBackup('')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/alanKisi/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('tablo select hatası → ok:false, error mesajı tabloya ait', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_orders') {
        return makeChain({ data: null, error: { message: 'table missing' } })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await takeBackup('test-user')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('table missing')
  })

  it('insert hatası → ok:false', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        return makeChain({ data: null, error: { message: 'insert rejected' } })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await takeBackup('test-user')
    expect(r.ok).toBe(false)
    expect(r.error).toContain('insert rejected')
  })

  it('başarılı yedek — id ve boyutKb dolu', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        return makeChain({ data: { id: 'new-backup-001' }, error: null })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await takeBackup('test-user', 'manuel', 'test notu')
    expect(r.ok).toBe(true)
    expect(r.id).toBe('new-backup-001')
    expect(r.boyutKb).toBeGreaterThan(0)
  })
})

// ─── cleanOldBackups ─────────────────────────────────────────────────────────

describe('cleanOldBackups', () => {
  beforeEach(() => {
    mockFrom.mockReset()
    mockFrom.mockReturnValue(makeChain({ data: [], error: null }))
  })

  it('keepDays < 1 → error, Supabase çağrısı yok', async () => {
    const r = await cleanOldBackups(0)
    expect(r.deleted).toBe(0)
    expect(r.error).toBeTruthy()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('başarılı silme — deleted sayısı data.length', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    )
    const r = await cleanOldBackups(30)
    expect(r.deleted).toBe(2)
    expect(r.error).toBeUndefined()
  })

  it('DB hatası → deleted:0 + error', async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: { message: 'connection timeout' } })
    )
    const r = await cleanOldBackups(30)
    expect(r.deleted).toBe(0)
    expect(r.error).toBe('connection timeout')
  })
})

// ─── restoreBackup — Input Validation ────────────────────────────────────────

describe('restoreBackup — Input Validation', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('backupId boş → ok:false, Supabase çağrısı yok', async () => {
    const r = await restoreBackup('', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/backupId/)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('alanKisi boş → ok:false, Supabase çağrısı yok', async () => {
    const r = await restoreBackup('bid-123', 'merge', '')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/alanKisi/)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

// ─── restoreBackup — Güvenlik Yedeği Hatası ──────────────────────────────────

describe('restoreBackup — Güvenlik Yedeği Hatası', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('takeBackup DB hatası → step:guvenlik_yedegi, ok:false', async () => {
    // uys_orders select hata verir → takeBackup throw → güvenlik yedeği alınamaz
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_orders') {
        return makeChain({ data: null, error: { message: 'table not found' } })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await restoreBackup('bid-123', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.step).toBe('guvenlik_yedegi')
    expect(r.error).toMatch(/Güvenlik yedeği alınamadı/)
  })
})

// ─── restoreBackup — Yedek Okuma Hatası ──────────────────────────────────────

describe('restoreBackup — Yedek Okuma', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('getBackup DB hatası → step:yedek_okuma', async () => {
    let yedeklerCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: null, error: { message: 'not found' } })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await restoreBackup('bid-123', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.step).toBe('yedek_okuma')
  })

  it('backup.veri null → step:yedek_okuma, error mesajı açıklayıcı', async () => {
    let yedeklerCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: makeYedekRow(null), error: null })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await restoreBackup('bid-123', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.step).toBe('yedek_okuma')
    expect(r.error).toMatch(/bulunamad/)
  })
})

// ─── restoreBackup — Versiyon Kontrolü ───────────────────────────────────────

describe('restoreBackup — Versiyon Kontrolü', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('_version:v22 → desteklenmiyor hatası', async () => {
    const badSnap = { _version: 'v22', orders: [] }
    let yedeklerCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: makeYedekRow(badSnap), error: null })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await restoreBackup('bid-123', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/desteklenmiyor/)
  })

  it('snapshot.tables eksik → hata', async () => {
    const badSnap = { _version: 'v3', _takenAt: '2026-01-01T00:00:00Z', _takenBy: 'x' }
    let yedeklerCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: makeYedekRow(badSnap), error: null })
      }
      return makeChain({ data: [], error: null })
    })
    const r = await restoreBackup('bid-123', 'merge', 'test-user')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/snapshot\.tables/)
  })
})

// ─── restoreBackup — Merge Mode Başarılı ─────────────────────────────────────

describe('restoreBackup — Merge Mode', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('2 tabloda veri → ok:true, insertedRows:2, affectedTables:2', async () => {
    const snap = makeV3Snapshot({
      uys_orders: [{ id: 'ord-1', mamul_kod: 'YM-001' }],
      uys_work_orders: [{ id: 'wo-1', order_id: 'ord-1' }],
    })
    setupHappyPath(snap)

    const r = await restoreBackup('backup-abc', 'merge', 'test-user')

    expect(r.ok).toBe(true)
    expect(r.mode).toBe('merge')
    expect(r.insertedRows).toBe(2)
    expect(r.affectedTables).toBe(2)
    expect(r.guvenlikYedegiId).toBe('guv-id')
  })

  it('boş snapshot → ok:true, insertedRows:0, affectedTables:0', async () => {
    const snap = makeV3Snapshot({})
    setupHappyPath(snap)

    const r = await restoreBackup('backup-abc', 'merge', 'test-user')

    expect(r.ok).toBe(true)
    expect(r.insertedRows).toBe(0)
    expect(r.affectedTables).toBe(0)
  })

  it('onProgress callback 4 adımda doğru sırayla çağrılır', async () => {
    const snap = makeV3Snapshot({})
    setupHappyPath(snap)

    const progressLines: string[] = []
    await restoreBackup('backup-abc', 'merge', 'test-user', (line) => progressLines.push(line))

    expect(progressLines).toHaveLength(4)
    expect(progressLines[0]).toMatch(/Güvenlik yedeği/)
    expect(progressLines[1]).toMatch(/Yedek okunuyor/)
    expect(progressLines[2]).toMatch(/birle/)   // birleştiriliyor
    expect(progressLines[3]).toMatch(/Tamamland/)
  })
})

// ─── restoreBackup — Replace Mode ────────────────────────────────────────────

describe('restoreBackup — Replace Mode', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('replace mode başarılı — ok:true, mode:replace', async () => {
    const snap = makeV3Snapshot({
      uys_orders: [{ id: 'ord-1' }],
    })
    setupHappyPath(snap)

    const r = await restoreBackup('backup-abc', 'replace', 'test-user')

    expect(r.ok).toBe(true)
    expect(r.mode).toBe('replace')
    expect(r.insertedRows).toBe(1)
    expect(r.affectedTables).toBe(1)
  })

  it('delete hatası → step:temizleme, guvenlikYedegiId kayıtlı', async () => {
    // pt_problemler ters-sırada ilk silinen tablo; 1. çağrı takeBackup select, 2. çağrı delete
    let yedeklerCount = 0
    let ptCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: makeYedekRow(makeV3Snapshot({})), error: null })
      }
      if (table === 'pt_problemler') {
        ptCount++
        if (ptCount === 1) return makeChain({ data: [], error: null }) // takeBackup select
        return makeChain({ data: null, error: { message: 'FK constraint violation' } }) // delete
      }
      return makeChain({ data: [], error: null })
    })

    const r = await restoreBackup('backup-abc', 'replace', 'test-user')

    expect(r.ok).toBe(false)
    expect(r.step).toBe('temizleme')
    expect(r.guvenlikYedegiId).toBe('guv-id')
    expect(r.error).toMatch(/temizlenemedi/)
  })
})

// ─── restoreBackup — Upsert Hatası ───────────────────────────────────────────

describe('restoreBackup — Upsert Hatası', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('merge upsert hatası → step:birlestirme, guvenlikYedegiId kayıtlı', async () => {
    const snap = makeV3Snapshot({ uys_orders: [{ id: 'ord-1' }] })
    let yedeklerCount = 0
    let ordersCount = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'uys_yedekler') {
        yedeklerCount++
        if (yedeklerCount === 1) return makeChain({ data: { id: 'guv-id' }, error: null })
        return makeChain({ data: makeYedekRow(snap), error: null })
      }
      if (table === 'uys_orders') {
        ordersCount++
        if (ordersCount === 1) return makeChain({ data: [], error: null }) // takeBackup select
        return makeChain({ data: null, error: { message: 'unique constraint' } }) // upsert
      }
      return makeChain({ data: [], error: null })
    })

    const r = await restoreBackup('backup-abc', 'merge', 'test-user')

    expect(r.ok).toBe(false)
    expect(r.step).toBe('birlestirme')
    expect(r.guvenlikYedegiId).toBe('guv-id')
    expect(r.error).toContain('Insert/upsert hatası')
  })
})

// ─── restoreBackup — 500+ Kayıt Chunking ─────────────────────────────────────

describe('restoreBackup — Chunking (500+ kayıt)', () => {
  beforeEach(() => { mockFrom.mockReset() })

  it('501 kayıt → uys_orders için 2 ayrı upsert çağrısı', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ id: `ord-${i}` }))
    const snap = makeV3Snapshot({ uys_orders: rows })
    setupHappyPath(snap)

    await restoreBackup('backup-abc', 'merge', 'test-user')

    // uys_orders çağrıları:
    //   1) takeBackup içinde select('*')
    //   2) upsert chunk [0..499]
    //   3) upsert chunk [500]
    const ordersCalls = mockFrom.mock.calls.filter(([t]: [string]) => t === 'uys_orders')
    expect(ordersCalls).toHaveLength(3)
  })
})
