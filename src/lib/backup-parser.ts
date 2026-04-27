/**
 * v15.53 Adım 1 — Eski v22 → v3 yedek migration parser (SKELETON)
 * ─────────────────────────────────────────────────────────────────────────
 * Bu dosya Faz 3'te (Adım 3) dolduruluyor. Şu an sadece tip skeleton'u +
 * versiyon tespit fonksiyonu var. Kullanıcının "Dosyadan Geri Yükle" ile
 * yüklediği eski monolit UYS yedek dosyalarını yeni v3 formatına çevirir.
 *
 * Eski v22 formatı:
 *   {
 *     orders: [...],
 *     workOrders: [...],
 *     logs: [...],
 *     ...
 *   }
 *
 * Yeni v3 formatı (BackupSnapshot):
 *   {
 *     _version: 'v3',
 *     _takenAt: '...',
 *     _takenBy: '...',
 *     tables: { uys_orders: [...], uys_work_orders: [...], ... }
 *   }
 *
 * v22 → v3 dönüşümünde alan adları ve tablo prefix'leri değişiyor.
 * Mevcut store mapper'ı (src/store/index.ts) bu işi tersinden yapıyor;
 * Faz 3'te onu kullanan adapter yazılacak.
 */

import type { BackupSnapshot } from './backup'

export type BackupVersion = 'v3' | 'v22' | 'unknown'

/**
 * Yüklenen JSON'un hangi formatta olduğunu tespit et.
 *
 * - v3: `_version === 'v3'` ve `tables` objesi var
 * - v22: top-level keys (orders, workOrders, ...) var, _version yok
 * - unknown: hiçbiri
 */
export function detectBackupVersion(json: any): BackupVersion {
  if (!json || typeof json !== 'object') return 'unknown'
  if (json._version === 'v3' && json.tables && typeof json.tables === 'object') return 'v3'
  // v22: top-level array keys, _version yok
  if (
    !json._version &&
    Array.isArray(json.orders) &&
    (Array.isArray(json.workOrders) || Array.isArray(json.work_orders))
  ) {
    return 'v22'
  }
  return 'unknown'
}

/**
 * v22 JSON blob'unu v3 BackupSnapshot formatına dönüştür.
 *
 * NOT: v15.53 Faz 3'te dolduruluyor. Şu an throw eder.
 */
export function parseV22Backup(_json: any): BackupSnapshot {
  throw new Error('parseV22Backup: not implemented yet (v15.53 Faz 3 — ayrı oturumda)')
}
