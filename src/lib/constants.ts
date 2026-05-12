/**
 * constants.ts — Uygulama genelinde sabit string değerleri
 *
 * KURAL: Durum string'leri yalnızca buradan kullanılır.
 * Yeni durum eklenirse tek yer güncellenir, TypeScript her yerde hata verir.
 */

// ─── İş Emri Durumları ───────────────────────────────────────────────────────
export const WO_DURUM = {
  BEKLIYOR:     'bekliyor',
  URETIMDE:     'uretimde',
  TAMAMLANDI:   'tamamlandi',
  KISMI_TAMAM:  'kismi_tamam',
  BEKLEMEDE:    'beklemede',
  IPTAL:        'iptal',
} as const
export type WoDurum = typeof WO_DURUM[keyof typeof WO_DURUM]

// ─── Sipariş Durumları ───────────────────────────────────────────────────────
export const ORDER_DURUM = {
  AKTIF:           'aktif',
  PLAN_BEKLIYOR:   'plan_bekliyor',
  URETILIYOR:      'uretiliyor',
  TAMAMLANDI:      'tamamlandi',
  KAPALI:          'kapali',
  IPTAL:           'iptal',
  TESLIM_EDILDI:   'teslim_edildi',
  FATURA_KESILDI:  'fatura_kesildi',
  KAPATILDI:       'kapatildi',
} as const
export type OrderDurum = typeof ORDER_DURUM[keyof typeof ORDER_DURUM]

// ─── Kesim Planı Durumları ───────────────────────────────────────────────────
export const KESIM_DURUM = {
  TASLAK:       'taslak',
  ONAYLANDI:    'onaylandi',
  URETIMDE:     'uretimde',
  TAMAMLANDI:   'tamamlandi',
  IPTAL:        'iptal',
} as const
export type KesimDurum = typeof KESIM_DURUM[keyof typeof KESIM_DURUM]

// ─── Stok Hareket Tipleri ────────────────────────────────────────────────────
export const STOK_TIP = {
  GIRIS:      'giris',
  CIKIS:      'cikis',
  BAR_ACILIS: 'bar_acilis',
} as const
export type StokTip = typeof STOK_TIP[keyof typeof STOK_TIP]

// ─── Tedarik Durumu ──────────────────────────────────────────────────────────
export const TEDARIK_DURUM = {
  BEKLIYOR: 'bekliyor',
  YOLDA:    'yolda',
  GELDI:    'geldi',
  IPTAL:    'iptal',
} as const
