// ═══ PENDING FLOW — v15.36 ═══
// Sipariş → Kesim → MRP → Tedarik akışında yarım kalan işleri takip eder.
// Her kullanıcı aynı anda 1 aktif flow tutabilir; aktif flow'u bitirene
// kadar yeni sipariş başlatması UI'da engellenir.

import { supabase } from './supabase'
import { uid } from './utils'
import type { PendingFlow, FlowStep, FlowType } from '@/types'

const TABLE = 'uys_pending_flows'

/**
 * Kullanıcının aktif flow'unu (varsa) getirir.
 * Aynı kullanıcının birden fazla aktif flow'u olması beklenmez — en son olan döner.
 */
export async function getActiveFlow(userId: string): Promise<PendingFlow | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('durum', 'aktif')
    .order('son_aktivite', { ascending: false })
    .limit(1)
  if (error) { console.error('[pendingFlow] getActiveFlow:', error); return null }
  if (!data?.length) return null
  const r = data[0] as Record<string, unknown>
  return {
    id: r.id as string,
    flowType: (r.flow_type || 'siparis') as FlowType,
    currentStep: (r.current_step || 'siparis') as FlowStep,
    stateData: (r.state_data || {}) as PendingFlow['stateData'],
    userId: (r.user_id || '') as string,
    userAd: (r.user_ad || '') as string,
    baslangic: (r.baslangic || '') as string,
    sonAktivite: (r.son_aktivite || '') as string,
    durum: (r.durum || 'aktif') as PendingFlow['durum'],
    not: (r.not_ || '') as string,
  }
}

/**
 * Yeni akış başlat. Kullanıcının aktif flow'u varsa üstüne yeni eklemez;
 * caller aktif flow kontrolünü kendisi yapmalı (UI'da uyarı).
 */
export async function startFlow(params: {
  flowType: FlowType
  initialStep: FlowStep
  userId: string
  userAd: string
  stateData?: PendingFlow['stateData']
  not?: string
}): Promise<PendingFlow | null> {
  const now = new Date().toISOString()
  const id = uid()
  const row = {
    id,
    flow_type: params.flowType,
    current_step: params.initialStep,
    state_data: params.stateData || {},
    user_id: params.userId,
    user_ad: params.userAd,
    baslangic: now,
    son_aktivite: now,
    durum: 'aktif',
    not_: params.not || '',
  }
  const { error } = await supabase.from(TABLE).insert(row)
  if (error) { console.error('[pendingFlow] startFlow:', error); return null }
  return {
    id,
    flowType: params.flowType,
    currentStep: params.initialStep,
    stateData: params.stateData || {},
    userId: params.userId,
    userAd: params.userAd,
    baslangic: now,
    sonAktivite: now,
    durum: 'aktif',
    not: params.not || '',
  }
}

/**
 * Mevcut akışı bir sonraki adıma taşı.
 * stateData merge edilir (eski + yeni).
 */
export async function advanceFlow(
  flowId: string,
  newStep: FlowStep,
  stateDataPatch?: PendingFlow['stateData'],
): Promise<boolean> {
  if (!flowId) return false

  const update: Record<string, unknown> = {
    current_step: newStep,
    son_aktivite: new Date().toISOString(),
  }

  // stateData patch varsa mevcut state ile merge
  if (stateDataPatch) {
    const { data: existing } = await supabase
      .from(TABLE)
      .select('state_data')
      .eq('id', flowId)
      .single()
    const mevcut = (existing?.state_data || {}) as PendingFlow['stateData']
    update.state_data = { ...mevcut, ...stateDataPatch }
  }

  const { error } = await supabase.from(TABLE).update(update).eq('id', flowId)
  if (error) { console.error('[pendingFlow] advanceFlow:', error); return false }
  return true
}

/** Akışı başarıyla tamamla */
export async function completeFlow(flowId: string): Promise<boolean> {
  if (!flowId) return false
  const { error } = await supabase
    .from(TABLE)
    .update({ durum: 'tamamlandi', current_step: 'tamamlandi', son_aktivite: new Date().toISOString() })
    .eq('id', flowId)
  if (error) { console.error('[pendingFlow] completeFlow:', error); return false }
  return true
}

/** Akışı iptal et */
export async function cancelFlow(flowId: string, not?: string): Promise<boolean> {
  if (!flowId) return false
  const { error } = await supabase
    .from(TABLE)
    .update({
      durum: 'iptal',
      current_step: 'iptal',
      son_aktivite: new Date().toISOString(),
      not_: not || 'Kullanıcı iptal etti',
    })
    .eq('id', flowId)
  if (error) { console.error('[pendingFlow] cancelFlow:', error); return false }
  return true
}

/** Step → route map (Topbar badge "devam et"e basınca nereye gidilecek) */
export function stepToRoute(step: FlowStep): string {
  switch (step) {
    case 'siparis': return '#/orders'
    case 'kesim':   return '#/cutting'
    case 'mrp':     return '#/mrp'
    case 'tedarik': return '#/procurement'
    default:        return '#/'
  }
}

/** Step → okunabilir başlık */
export function stepLabel(step: FlowStep): string {
  switch (step) {
    case 'siparis':      return 'Sipariş'
    case 'kesim':        return 'Kesim Planı'
    case 'mrp':          return 'MRP'
    case 'tedarik':      return 'Tedarik'
    case 'tamamlandi':   return 'Tamamlandı'
    case 'iptal':        return 'İptal'
    default:             return step
  }
}
