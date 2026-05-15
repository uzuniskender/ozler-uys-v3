// src/services/acikBarlarService.ts
// uys_acik_barlar için okuma + hurda mutasyonu servisi.
//
// Kapsam karar notları:
//   - Bar açma / tüketme / geri alma → domain işlemi, src/features/production/barModel.ts'te kalır.
//   - Bu servis: list/get sorguları + Warehouse.tsx'teki inline hurda update'ini sarar.
//   - not_ ↔ not, ham_malkod ↔ hamMalkod vb. köprüsü toAcikBar() mapper'ında.

import { supabase } from '@/lib/supabase'
import { wrap } from '@/services/_base/errors'
import { applyIlikeArama } from '@/services/_base/query'
import type { AcikBar } from '@/types'

const TABLO = 'uys_acik_barlar'

// DB satırı → AcikBar (store mapper ile aynı mantık)
function toAcikBar(r: Record<string, unknown>): AcikBar {
  return {
    id: r.id as string,
    hamMalkod: (r.ham_malkod || '') as string,
    hamMalad: (r.ham_malad || '') as string,
    uzunlukMm: (r.uzunluk_mm as number) || 0,
    kaynakPlanId: (r.kaynak_plan_id || '') as string,
    kaynakSatirId: (r.kaynak_satir_id || '') as string,
    barIndex: (r.bar_index as number) || 0,
    olusmaTarihi: ((r.olusmaTarihi || r.olusma_tarihi) || '') as string,
    durum: (r.durum || 'acik') as AcikBar['durum'],
    tuketimLogId: (r.tuketim_log_id || '') as string,
    tuketimTarihi: (r.tuketim_tarihi || '') as string,
    not: (r.not_ || '') as string,
    hurdaTarihi: (r.hurda_tarihi || undefined) as string | undefined,
    hurdaSebep: (r.hurda_sebep || undefined) as string | undefined,
    hurdaKullaniciId: (r.hurda_kullanici_id || undefined) as string | undefined,
    hurdaKullaniciAd: (r.hurda_kullanici_ad || undefined) as string | undefined,
  }
}

export interface ListeOpts {
  /** Belirli bir ham malzemenin barlarını getir. */
  hamMalkod?: string
  /** Durum filtresi (birden fazla olabilir). Verilmezse tümü gelir. */
  durumlar?: Array<AcikBar['durum']>
  /** hamMalkod / hamMalad içinde ILIKE araması. */
  arama?: string
}

/** Açık barları listele. */
export async function listAcikBarlar(opts: ListeOpts = {}): Promise<AcikBar[]> {
  let q = supabase
    .from(TABLO)
    .select('*')
    .order('olusma_tarihi', { ascending: false })

  if (opts.hamMalkod) q = q.eq('ham_malkod', opts.hamMalkod)
  if (opts.durumlar && opts.durumlar.length > 0) q = q.in('durum', opts.durumlar)
  q = applyIlikeArama(q, opts.arama, ['ham_malkod', 'ham_malad'])

  const { data, error } = await q
  wrap(error, { table: TABLO, op: 'select' })
  return ((data ?? []) as Record<string, unknown>[]).map(toAcikBar)
}

/** Tek bar id ile. */
export async function getAcikBar(id: string): Promise<AcikBar | null> {
  const { data, error } = await supabase
    .from(TABLO)
    .select('*')
    .eq('id', id)
    .maybeSingle()
  wrap(error, { table: TABLO, op: 'select' })
  return data ? toAcikBar(data as Record<string, unknown>) : null
}

export interface HurdaPayload {
  sebep?: string | null
  kullaniciId?: string | null
  kullaniciAd?: string | null
}

/**
 * Seçili barları hurdaya gönder.
 * Warehouse.tsx AcikBarHurdaModal'daki inline update'i sarar.
 * `ids` boşsa hiçbir şey yapmaz.
 */
export async function hurdaGonder(
  ids: string[],
  payload: HurdaPayload = {},
): Promise<void> {
  if (ids.length === 0) return

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from(TABLO)
    .update({
      durum: 'hurda',
      hurda_tarihi: nowIso,
      hurda_sebep: payload.sebep?.trim() || null,
      hurda_kullanici_id: payload.kullaniciId ?? null,
      hurda_kullanici_ad: payload.kullaniciAd ?? null,
    })
    .in('id', ids)

  wrap(error, { table: TABLO, op: 'update' })
}
