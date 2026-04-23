/**
 * BAR MODEL — v15.31
 * ════════════════════════════════════════════════════════════════
 * Ham profil/boru/plaka için kesir stok düşümü yerine fiziksel
 * "bar aç → parça kes → artık havuza gir" modelini uygular.
 *
 * AKIŞ:
 *   1. Kesim planı oluşturulduğunda → hiç stok hareketi yazılmaz.
 *      MRP mevcut cutting-override mantığıyla planı rezerve olarak okur.
 *
 *   2. Üretim girişi yazıldığında → ilgili kesim planı satırının tüm İE'leri
 *      tamamlandıysa tetiklenir:
 *        - bar_acilis × hamAdet   → uys_stok_hareketler'e yazılır (ham stok −1)
 *        - fireMm > 0 ise          → uys_acik_barlar'a kayıt eklenir
 *      İdempotent: id = `bar-open-{planId}-{satirId}-{index}` — 2 kez
 *      tetiklense duplicate yazmaz (tedarikStokId paternine paralel).
 *
 * STOK HAREKETİ SEMANTİĞİ:
 *   bar_acilis → ham stoktan çıkış. Mevcut stok hesapları (tip==='giris' ? +:-)
 *   bu satırları doğal olarak çıkış sayar.
 *
 *   Açık bar havuza giriş/çıkış → uys_stok_hareketler'de DEĞİL,
 *   uys_acik_barlar tablosunda izlenir. Ham malkod bakiyesini etkilemez.
 *
 * HANGİ MALZEMELER BAR MODELİNE GİRER?
 *   isBarMaterial(m): m.tip === 'Hammadde' && m.uzunluk > 0
 *   Diğer HM'ler (sarf, kimyasal, ayar mili vb.) eski orantılı yolda kalır.
 */

import { supabase } from '@/lib/supabase'
import { today } from '@/lib/utils'
import type { WorkOrder, ProductionLog, Material, CuttingPlan } from '@/types'

// ═══ YARDIMCILAR ═══

/** Bu malzeme bar modelinde mi? Ham + uzunluk>0 → evet */
export function isBarMaterial(m: Material | undefined): boolean {
  if (!m) return false
  return m.tip === 'Hammadde' && (m.uzunluk || 0) > 0
}

/** malkod → isBarMaterial? (case-insensitive material lookup) */
export function isBarMaterialByKod(malkod: string, materials: Material[]): boolean {
  if (!malkod) return false
  const target = malkod.trim().toLowerCase()
  const m = materials.find(x => (x.kod || '').trim().toLowerCase() === target)
  return isBarMaterial(m)
}

/** Deterministik ID üretici — idempotency sağlar */
export const barAcilisStokId = (planId: string, satirId: string, idx: number) =>
  `bar-open-${planId}-${satirId}-${idx}`
export const acikBarKayitId = (planId: string, satirId: string, idx: number) =>
  `ab-${planId}-${satirId}-${idx}`

// ═══ KESİM PLAN SATIR TAMAMLANMA TESPİTİ ═══

interface KesimSatir {
  id: string
  hamAdet: number
  fireMm: number
  kesimler: Array<{
    woId: string
    ieNo?: string
    malkod: string
    malad?: string
    parcaBoy?: number
    adet: number
    tamamlandi?: number
  }>
  durum?: string
}

/**
 * Satır fiziksel olarak tamamlandı mı?
 * Kriter: satır içindeki tüm kesim WO'larının üretimi hedefe ulaşmış mı
 */
function satirTamamlandiMi(
  satir: KesimSatir,
  workOrders: WorkOrder[],
  logs: ProductionLog[]
): boolean {
  if (!satir.kesimler?.length) return false
  for (const k of satir.kesimler) {
    const wo = workOrders.find(w => w.id === k.woId)
    if (!wo) return false  // WO silinmişse satırı tamamlanmış sayma
    if (wo.durum === 'iptal') continue  // iptal edilmişse skip
    const prod = logs.filter(l => l.woId === wo.id).reduce((a, l) => a + (l.qty || 0), 0)
    if (prod < (wo.hedef || 0)) return false
  }
  return true
}

// ═══ BAR AÇILIŞ TETİKLEYİCİ ═══

/**
 * Üretim girişi yazıldıktan sonra çağrılır.
 * Bu WO'nun bağlı olduğu kesim planlarını tarar; tamamlanan satırlar için
 * bar_acilis + acik_bar_giris hareketlerini idempotent yazar.
 *
 * Dönüş: { barSayisi, acikBarSayisi }
 */
export async function barModelSync(
  tetikleyiciWoId: string,
  cuttingPlans: CuttingPlan[],
  workOrders: WorkOrder[],
  logs: ProductionLog[],
  materials: Material[]
): Promise<{ barSayisi: number; acikBarSayisi: number }> {
  let barSayisi = 0
  let acikBarSayisi = 0

  // İlgili kesim planlarını bul (bu WO'yu içeren)
  const ilgiliPlanlar = cuttingPlans.filter(p =>
    (p.satirlar || []).some((s: any) =>
      (s.kesimler || []).some((k: any) => k.woId === tetikleyiciWoId)
    )
  )

  if (!ilgiliPlanlar.length) return { barSayisi, acikBarSayisi }

  const stokRows: Record<string, unknown>[] = []
  const acikBarRows: Record<string, unknown>[] = []
  const tarih = today()

  for (const plan of ilgiliPlanlar) {
    const hamMalkod = (plan as any).hamMalkod || ''
    const hamMalad = (plan as any).hamMalad || ''
    if (!hamMalkod) continue

    // Bar modelinde olmayan malzemeler atlanır (ör. YarıMamul kesimleri)
    if (!isBarMaterialByKod(hamMalkod, materials)) continue

    const satirlar: KesimSatir[] = (plan as any).satirlar || []
    for (const satir of satirlar) {
      if (!satir.id) continue
      if (!satirTamamlandiMi(satir, workOrders, logs)) continue

      const hamAdet = satir.hamAdet || 0
      if (hamAdet <= 0) continue

      // Her bar için kayıt üret (idempotent)
      for (let i = 0; i < hamAdet; i++) {
        // Bar açılışı — ham maldan −1 (uys_stok_hareketler)
        stokRows.push({
          id: barAcilisStokId(plan.id, satir.id, i),
          tarih,
          malkod: hamMalkod,
          malad: hamMalad,
          miktar: 1,
          tip: 'bar_acilis',
          log_id: null,
          wo_id: tetikleyiciWoId,
          aciklama: `Bar açılışı — plan ${plan.id.slice(-6)} / satır ${satir.id.slice(-6)} / bar ${i + 1}/${hamAdet}`,
        })
        barSayisi++

        // Artık varsa: uys_acik_barlar tablosuna kayıt (stok_hareketler'e DEĞİL)
        // Açık bar havuzunun raw malkod stok bakiyesini etkilemez —
        // ayrı tabloda izlenir.
        const fireMm = satir.fireMm || 0
        if (fireMm > 0) {
          acikBarRows.push({
            id: acikBarKayitId(plan.id, satir.id, i),
            ham_malkod: hamMalkod,
            ham_malad: hamMalad,
            uzunluk_mm: fireMm,
            kaynak_plan_id: plan.id,
            kaynak_satir_id: satir.id,
            bar_index: i,
            olusma_tarihi: tarih,
            durum: 'acik',
            tuketim_log_id: null,
            tuketim_tarihi: null,
            not_: '',
          })
          acikBarSayisi++
        }
      }
    }
  }

  // Upsert — idempotent
  if (stokRows.length) {
    const { error: e1 } = await supabase
      .from('uys_stok_hareketler')
      .upsert(stokRows, { onConflict: 'id' })
    if (e1) console.error('[barModel] Stok hareket upsert:', e1)
  }
  if (acikBarRows.length) {
    const { error: e2 } = await supabase
      .from('uys_acik_barlar')
      .upsert(acikBarRows, { onConflict: 'id' })
    if (e2) console.error('[barModel] Açık bar upsert:', e2)
  }

  return { barSayisi, acikBarSayisi }
}

// ═══ AÇIK BAR HAVUZU — STOK HESABI ═══

/**
 * Bir ham malkod için açık bar havuzundaki toplam kalan mm.
 * MRP stok hesabında "bu kadar mm zaten havuzda var" diye kullanılabilir.
 */
export function acikBarHavuzuToplamMm(
  hamMalkod: string,
  acikBarlar: { hamMalkod: string; uzunlukMm: number; durum: string }[]
): number {
  const target = (hamMalkod || '').trim().toLowerCase()
  return acikBarlar
    .filter(a => a.durum === 'acik' && (a.hamMalkod || '').trim().toLowerCase() === target)
    .reduce((s, a) => s + (a.uzunlukMm || 0), 0)
}

/**
 * Bir açık barı belirli bir log için tüketildi olarak işaretle.
 * (Şu an için: kullanılmıyor — kesim planı havuzdan çekim iyileştirmesi Faz B.)
 */
export async function acikBarTuket(
  acikBarId: string,
  logId: string
): Promise<boolean> {
  const tarih = today()
  const { error } = await supabase
    .from('uys_acik_barlar')
    .update({
      durum: 'tuketildi',
      tuketim_log_id: logId,
      tuketim_tarihi: tarih,
    })
    .eq('id', acikBarId)
  if (error) { console.error('[barModel] Açık bar tüket:', error); return false }
  return true
}
