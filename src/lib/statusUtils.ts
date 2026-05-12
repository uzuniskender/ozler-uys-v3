import { getStok, computeOrderEksik } from '@/lib/hammaddeHesap'
export { computeOrderEksik as computeOrderHammaddeEksik }
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

import type { Order, WorkOrder, CuttingPlan, Tedarik, AcikBar } from '@/types'

// ─── v16.05 — #20 Sipariş-bütünü hammadde rekabeti helper ─────────────────────────────────────────

/**
 * Sipariş bazında toplam hammadde ihtiyacını hesaplar ve stok+yolda yetmeyenleri döndürür.
 * Sentinel #16'nın mantığını UI'a yansıtmak için: aynı siparişteki birden çok IE aynı
 * hammaddeyi paylaşırsa toplam ihtiyac stok+yoldayı aşıyor olabilir ama her IE tek başına
 * yeterli görünüyor. Saha vakası: S26A_03150 plywood 5 IE x ortalama 43 levha = 214 toplam,
 * stok 83 → ancak IE-14 tek başına 100 ihtiyaç ile yakalandı, IE-10/11/12/13 "yeterli" sanıldı.
 *
 * @returns Map<orderId, Set<eksik_malkod>>
 */

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
 * Sipariş "arşivde" mi? — yani MRP listesinde ve aktif iş akışında gizlenir.
 * v15.50b — §19 MRP Filtre Sözleşmesi opsiyonel iyileştirmesi.
 *
 * Mantık olarak `!isOrderActive(o)` ile aynı, fakat niyet okunabilirliği için
 * ayrı helper. Filter kararında `isOrderArchived(o) ? gizle : göster` yazımı
 * `!isOrderActive(o) ? gizle : göster`'den daha açık ve §19 sözleşmesi ile birebir
 * eşleşiyor (sözleşme "arşiv" terimini kullanıyor).
 */
export function isOrderArchived(o: Order): boolean {
  return !isOrderActive(o)
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
 * Bir İE'nin "kapanmış veya duraklatılmış" olduğunu kabul eden tüm string'ler.
 * - 'tamamlandi' — bitirilmiş
 * - 'iptal'      — iptal edilmiş
 * - 'beklemede'  — duraklatılmış (paused) — operatör tarafından beklemeye alınmış,
 *                  şu an üretilmiyor; plana yeniden alınmamalı
 *
 * v15.47.3: 'beklemede' eklendi. Önceden Topbar KESİM badge'i paused İE'leri
 * "açık" sayıp false positive üretiyordu (WorkOrders.tsx satır 168, 543'te
 * 'beklemede' kullanılıyor — Devam Et butonu için).
 */
const WO_CLOSED_OR_PAUSED_STATES = new Set(['tamamlandi', 'iptal', 'beklemede'])

/**
 * İş emri hala açık mı? (üretilebilir, plana girilebilir)
 * 'beklemede' durumu da AÇIK SAYILMAZ — paused İE'ye plan oluşturulmamalı.
 */
export function isWorkOrderOpen(w: WorkOrder): boolean {
  const d = (w.durum || '').toLowerCase().trim()
  return !WO_CLOSED_OR_PAUSED_STATES.has(d)
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

/**
 * Bir kesim planının "tamamlanmamış" olduğu — yani üretim bekleniyor.
 * v15.47.3: CuttingPlans listeleme/sayım için. 'iptal' veya 'tamamlandi'
 * dışı her şey pending sayılır.
 */
const CP_PENDING_OR_ACTIVE = new Set(['bekliyor', 'devam', '', 'planlandi'])

export function isCuttingPlanPending(cp: CuttingPlan): boolean {
  const d = (cp.durum || '').toLowerCase().trim()
  // 'tamamlandi' ve 'iptal' kesin kapalı — pending değil
  if (d === 'tamamlandi' || d === 'iptal') return false
  // Geri kalan her şey pending (boş string, 'bekliyor', 'devam', 'planlandi' vs.)
  return CP_PENDING_OR_ACTIVE.has(d) || d === ''
}

// ─── ACIK BAR (havuz) ────────────────────────────────────────────

/**
 * Bir açık barın "havuzda kullanılabilir" olduğu durum.
 * uys_acik_barlar.durum 3 değer alır:
 * - 'acik'      — havuzda, kullanıma hazır
 * - 'tuketildi' — bir log'da tüketildi
 * - 'hurda'     — hurdaya gönderildi
 *
 * v15.47.3: AcikBar kullanan sayfalarda (CuttingPlans havuz önerisi vb.)
 * doğrudan `b.durum === 'acik'` yerine bu helper.
 */
export function isAcikBarAvailable(b: AcikBar): boolean {
  return (b.durum || '').toLowerCase().trim() === 'acik'
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

// ─── KESIM (kesim operasyonu / kesim planları) ───────────────────
// v15.52b — Topbar.tsx'teki KESIM badge mantığının ortak helper'a çıkarılmış hali.
// Orders.tsx (sipariş listesi kesim eksik kolonu) da bunları kullanır.
// NOT: Topbar.tsx şu an kendi inline mantığını koruyor — refactor ayrı patch'te.

/**
 * Kesim operasyonu sayılan opAd anahtar kelimeleri (büyük harf normalize'li).
 * Tüm kesim varyantları: 'KESİM', 'KESME', 'KES' (kök), '+ kesim makineleri'.
 * Eski Topbar.tsx sadece 'KESIM' arıyordu, "KESME LAZER" gibi yakalanmıyordu (v15.50a.6 fix).
 */
const KESIM_OP_KEYWORDS = ['KESİM', 'KESME', 'KES', 'LAZER', 'PLAZMA', 'PUNCH', 'ROUTER']

/**
 * WO'nun operasyon adı kesim operasyonu mu?
 * opAd üzerinden direkt arama — operations tablosuna bağımlılık yok, opId boş bile olsa çalışır.
 */
export function isKesimWO(w: { opAd?: string | null }): boolean {
  const opAd = (w.opAd || '').toLocaleUpperCase('tr-TR')
  return KESIM_OP_KEYWORDS.some(k => opAd.includes(k))
}

/**
 * Aktif (iptal olmamış) kesim planlarındaki tüm WO ID'lerini döner.
 * Kullanım: Hangi WO'lar plana atanmış? Set'te olan = atanmış.
 */
export function getPlanliWoIds(cuttingPlans: CuttingPlan[]): Set<string> {
  const set = new Set<string>()
  for (const cp of cuttingPlans) {
    if (!isCuttingPlanActive(cp)) continue
    for (const s of (cp.satirlar || [])) {
      for (const k of (s.kesimler || [])) {
        if (k.woId) set.add(k.woId)
      }
    }
  }
  return set
}

/**
 * Aktif kesim planlarındaki tüm ieNo değerlerini döner.
 * Eski planlar woId yerine ieNo ile kaydedilmiş olabilir — fallback için.
 * v16.53 fix: woId eksik planlarda ieNo üzerinden eşleşme sağlar.
 */
export function getPlanliIeNos(cuttingPlans: CuttingPlan[]): Set<string> {
  const set = new Set<string>()
  for (const cp of cuttingPlans) {
    if (!isCuttingPlanActive(cp)) continue
    for (const s of (cp.satirlar || [])) {
      for (const k of (s.kesimler || [])) {
        const ieNo = (k as any).ieNo
        if (ieNo) set.add(ieNo)
      }
    }
  }
  return set
}

/**
 * Kesim eksik olan WO ID'lerini döner.
 * Şartlar:
 *   - WO açık (tamamlanmadı, iptal değil, paused değil)
 *   - WO kesim operasyonu (isKesimWO = true)
 *   - Henüz aktif bir kesim planına atanmamış
 *
 * Kullanım: Topbar KESİM badge sayısı, Orders.tsx kesim eksik kolonu, vb.
 */
export function getKesimEksikWoIds(
  workOrders: WorkOrder[],
  cuttingPlans: CuttingPlan[]
): Set<string> {
  const planli = getPlanliWoIds(cuttingPlans)
  const planliIeNos = getPlanliIeNos(cuttingPlans)
  const eksik = new Set<string>()
  for (const w of workOrders) {
    if (!isWorkOrderOpen(w)) continue
    if (!isKesimWO(w)) continue
    if (planli.has(w.id)) continue
    if (w.ieNo && planliIeNos.has(w.ieNo)) continue  // v16.53: ieNo fallback
    eksik.add(w.id)
  }
  return eksik
}


// ─── EFEKTİF DURUM (v15.79 — İş Emri #13 madde 8+9) ─────────────
// "Plan Bekliyor" / "Üretilebilir" durumları DB'ye yazılmaz, anlık türetilir.
// Operatör paneli sadece Üretilebilir + Üretimde görür → yanılma riski yok.
// Detay: docs/UYS_v3_Bilgi_Bankasi.md §24

import type { StokHareket } from '@/types'

export type EffectiveWoStatus =
  | 'iptal' | 'tamamlandi' | 'beklemede' | 'uretimde'  // mevcut DB durumları
  | 'PlanBekliyor' | 'Uretilebilir'                     // türetilmiş

export interface StatusReason {
  status: EffectiveWoStatus
  /** Tooltip metni — eksik ne ise onu yazar (boş string Üretilebilir için) */
  reason: string
  /** Hangi adım bloke ediyor (ileride ayrı sayım için) */
  blockedBy: 'kesim_plan' | 'tedarik_yok' | 'tedarik_yolda' | null
}

/**
 * v15.79 — Bir WO'nun anlık efektif durumunu hesaplar.
 *
 * Karar sırası (öncelik yukarıdan aşağı):
 *   1. DB durumu zorlayıcı (iptal/tamamlandi/beklemede/uretimde) → onu döndür
 *   2. Kesim opsiyonlu + plan yok → 'PlanBekliyor', reason='Kesim planı oluşturulmamış'
 *   3. Hammadde stoğu yeterli → 'Uretilebilir', reason=''
 *   4. Hammadde eksik + tedarik açılmamış → 'PlanBekliyor', reason='X malzeme tedariki açılmamış'
 *   5. Hammadde eksik + tedarik yolda → 'PlanBekliyor', reason='X malzeme tedariki yolda'
 *
 * "Eksik tedarik" hangi varyant: ÖNCELİK tedarik_yok > tedarik_yolda. Yani aynı anda
 * 2 hammadde eksikse ve birinin tedariği açılmamış birinin yoldaysa, açılmamış olan
 * tooltip'e yazılır (operatöre "ilk yapılması gereken" bildirilir).
 */
export function getEffectiveStatus(
  w: WorkOrder,
  cuttingPlans: CuttingPlan[],
  tedarikler: Tedarik[],
  stokHareketler: StokHareket[],
  logs?: { woId: string; qty: number }[],
  orderHmEksikMap?: Map<string, Set<string>>,
): StatusReason {
  // 1. DB durumu zorlayıcı
  const d = (w.durum || '').toLowerCase().trim()
  if (d === 'iptal') return { status: 'iptal', reason: 'İptal edilmiş', blockedBy: null }
  if (d === 'tamamlandi') return { status: 'tamamlandi', reason: 'Tamamlandı', blockedBy: null }
  if (d === 'beklemede') return { status: 'beklemede', reason: 'Bekletiliyor', blockedBy: null }
  if (d === 'uretimde') return { status: 'uretimde', reason: 'Üretimde', blockedBy: null }

  // 2. Kesim opsiyonlu + plan yok
  if (isKesimWO(w)) {
    const planli = getPlanliWoIds(cuttingPlans)
    const planliIeNos = getPlanliIeNos(cuttingPlans)
    const planliMi = planli.has(w.id) || (w.ieNo ? planliIeNos.has(w.ieNo) : false)
    if (!planliMi) {
      return { status: 'PlanBekliyor', reason: 'Kesim planı oluşturulmamış', blockedBy: 'kesim_plan' }
    }
    // Kesim planında → hammadde ihtiyacı plan karşılar, stok kontrolünü atla
    return { status: 'Uretilebilir', reason: '', blockedBy: null }
  }

  // 3-5. Hammadde stoğu kontrolü
  const hm = (w.hm || []) as Array<{ malkod: string; malad: string; miktarTotal: number }>
  if (hm.length === 0) {
    // BOM tanımsız İE — varsayılan Üretilebilir (operatör panel canProduceWO ek koruma)
    return { status: 'Uretilebilir', reason: '', blockedBy: null }
  }

  // v16.05 — #20: Sipariş-bütünü hammadde rekabeti (sentinel #16 mantığının UI yansıması)
  if (orderHmEksikMap && w.orderId) {
    const orderEksik = orderHmEksikMap.get(w.orderId)
    if (orderEksik && hm.length > 0) {
      const ilkOrtak = hm.find(h => orderEksik.has(h.malkod))
      if (ilkOrtak) {
        // Bu sipariş bütününde bu hammadde eksik → tedarik yok kabul et
        return {
          status: 'PlanBekliyor',
          reason: `${ilkOrtak.malad || ilkOrtak.malkod} sipariş toplamında stok+yolda yetmiyor (sipariş paylaşımlı eksik)`,
          blockedBy: 'tedarik_yok',
        }
      }
    }
  }

  // Üretim ilerlemesi → kalan hammadde ihtiyacı
  const uretildi = logs ? logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0) : 0
  const kalanOran = w.hedef > 0 ? Math.max(0, (w.hedef - uretildi) / w.hedef) : 0
  if (kalanOran === 0) {
    // Üretim tamamlandı (DB durumu update gecikmiş olabilir)
    return { status: 'Uretilebilir', reason: '', blockedBy: null }
  }

  let ilkTedarikYok: { malkod: string; malad: string } | null = null
  let ilkTedarikYolda: { malkod: string; malad: string } | null = null

  for (const h of hm) {
    const stok = getStok(h.malkod, stokHareketler)
    const kalanIhtiyac = h.miktarTotal * kalanOran
    if (stok >= kalanIhtiyac) continue  // bu hammadde yeterli

    // Eksik — tedarik durumu
    const acikTedarik = tedarikler.find(t => t.malkod === h.malkod && !t.geldi)
    if (!acikTedarik) {
      if (!ilkTedarikYok) ilkTedarikYok = { malkod: h.malkod, malad: h.malad }
    } else {
      if (!ilkTedarikYolda) ilkTedarikYolda = { malkod: h.malkod, malad: h.malad }
    }
  }

  // Öncelik: tedarik_yok > tedarik_yolda
  if (ilkTedarikYok) {
    return {
      status: 'PlanBekliyor',
      reason: `${ilkTedarikYok.malad || ilkTedarikYok.malkod} tedariki açılmamış`,
      blockedBy: 'tedarik_yok',
    }
  }
  if (ilkTedarikYolda) {
    return {
      status: 'PlanBekliyor',
      reason: `${ilkTedarikYolda.malad || ilkTedarikYolda.malkod} tedariki yolda (geliş bekleniyor)`,
      blockedBy: 'tedarik_yolda',
    }
  }

  // Tüm hammadde yeterli
  return { status: 'Uretilebilir', reason: '', blockedBy: null }
}

/**
 * v15.79 — Plan Bekleyen WO ID'leri.
 * Topbar [PLAN BEKLEYEN N] rozeti için. Açık (iptal/tamamlandi/beklemede dışı) WO'lar arasında
 * effective status === 'PlanBekliyor' olanları sayar.
 *
 * Performans: 1000 WO için tipik 50-100ms (her WO için 1 status hesabı). Topbar'da useMemo ile cache.
 */
export function getPlanBekleyenWoIds(
  workOrders: WorkOrder[],
  cuttingPlans: CuttingPlan[],
  tedarikler: Tedarik[],
  stokHareketler: StokHareket[],
  logs?: { woId: string; qty: number }[],
  orderHmEksikMap?: Map<string, Set<string>>,
): Set<string> {
  const set = new Set<string>()
  for (const w of workOrders) {
    if (!isWorkOrderOpen(w)) continue
    const eff = getEffectiveStatus(w, cuttingPlans, tedarikler, stokHareketler, logs, orderHmEksikMap)
    if (eff.status === 'PlanBekliyor') set.add(w.id)
  }
  return set
}
