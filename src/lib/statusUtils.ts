/**
 * Durum String Normalizasyon Helper'ları (v15.47.2)
 *
 * UYS v3'te tablolar arası durum string'leri tutarsız. Eski kod / yeni kod
 * farklı string'ler kullanmış, kimse standartlaştırmamış. Aynı kavramı (örn.
 * "tamamlandı") farklı tablolar farklı yazıyor:
 *
 *   uys_kesim_planlari.durum   = 'tamamlandi'
 *   uys_work_orders.durum      = 'tamamlandi'
 *   uys_orders.mrp_durum       = 'tamam'         (kısa form)
 *   uys_orders.durum           = 'kapalı'        (apaçık farklı)
 *   uys_tedarikler             — durum yok, sadece geldi flag'i
 *
 * DB seviyesinde migrate riskli (başka mantıkları kırabilir). Çözüm: bu
 * yardımcı fonksiyonlar tüm tutarsızlığı normalize eder. Topbar dışı
 * yerlerden de kullanılır (statü kontrolü gereken her sayfa).
 *
 * Daha fazla bilgi: docs/UYS_v3_Bilgi_Bankasi.md §18.3 Durum String Konvansiyonu
 */

import type { Order, WorkOrder, CuttingPlan, Tedarik } from '@/types'

// ─── ORDERS (siparişler) ─────────────────────────────────────────

/**
 * Bir siparişin "tamamlanmış" olduğunu kabul eden tüm durum string'leri.
 * - 'tamamlandi' — modern kod (yeni siparişler)
 * - 'kapalı'     — eski kod (sevki/işi bitmiş, kapatılmış)
 * - 'iptal'      — iptal edilmiş, gündemde değil
 */
const ORDER_INACTIVE_STATES = new Set(['tamamlandi', 'kapalı', 'kapali', 'iptal'])

/**
 * Sipariş hala aktif mi? (gündemde, henüz kapanmamış)
 * Boş/null durum aktif sayılır (yeni oluşturulmuş, henüz işlenmemiş).
 */
export function isOrderActive(o: Order): boolean {
  const d = (o.durum || '').toLowerCase().trim()
  return !ORDER_INACTIVE_STATES.has(d)
}

/**
 * Bir siparişin MRP'sinin "tamamlanmış" sayıldığı tüm string'ler.
 * - 'tamamlandi' — modern kod
 * - 'tamam'      — eski kod (kısa form)
 */
const MRP_DONE_STATES = new Set(['tamamlandi', 'tamam'])

/**
 * Bu siparişin MRP'si bekleniyor mu?
 * (Sadece aktif siparişler için anlamlı — kapanmış siparişin MRP'si artık beklenmiyor.)
 */
export function isOrderMrpPending(o: Order): boolean {
  if (!isOrderActive(o)) return false
  const m = (o.mrpDurum || '').toLowerCase().trim()
  return !MRP_DONE_STATES.has(m)
}

// ─── WORK ORDERS (iş emirleri) ───────────────────────────────────

/**
 * Bir İE'nin "kapanmış" olduğunu kabul eden tüm string'ler.
 * Modern kod tutarlı: 'tamamlandi' veya 'iptal'.
 */
const WO_CLOSED_STATES = new Set(['tamamlandi', 'iptal'])

/**
 * İş emri hala açık mı? (üretilebilir, plana girilebilir)
 */
export function isWorkOrderOpen(w: WorkOrder): boolean {
  const d = (w.durum || '').toLowerCase().trim()
  return !WO_CLOSED_STATES.has(d)
}

// ─── CUTTING PLANS (kesim planları) ──────────────────────────────

/**
 * Bir kesim planının "kapanmış" olduğunu kabul eden tüm string'ler.
 */
const CP_CLOSED_STATES = new Set(['iptal'])

/**
 * Plan satırlarındaki WO'ları sayıma dahil etmek için: plan iptal değilse evet.
 * 'tamamlandi' planlardaki WO'lar da plana atanmış sayılır (zaten plana girmiş).
 */
export function isCuttingPlanActive(cp: CuttingPlan): boolean {
  const d = (cp.durum || '').toLowerCase().trim()
  return !CP_CLOSED_STATES.has(d)
}

// ─── TEDARIKLER (tedarik/satınalma) ──────────────────────────────

/**
 * Bir tedarik kaleminin "bekleyen" sayılması için:
 * - geldi flag'i false
 * - durum 'iptal' değil
 *
 * uys_tedarikler tablosunda durum alanı şu an sadece 'geldi' string'ini
 * kullanıyor (geldi=true olunca). Bekleyenler için durum boş veya null.
 * Yine de gelecekte durum genişlerse hazır olalım.
 */
const TEDARIK_CANCELLED_STATES = new Set(['iptal', 'iptaledildi'])

/**
 * Tedarik bekleniyor mu? (henüz gelmedi ve iptal değil)
 */
export function isProcurementPending(t: Tedarik): boolean {
  if (t.geldi) return false
  const d = (t.durum || '').toLowerCase().trim()
  return !TEDARIK_CANCELLED_STATES.has(d)
}
