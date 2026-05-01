/**
 * Sipariş State Machine (v16.33 — IE #14 Faz B Slice 2)
 *
 * 10 state, 2 terminal (kapali, iptal). DB'de `order_state` ENUM,
 * compute_order_state() fonksiyonu otomatik günceller.
 *
 * Bu dosya iki amaca hizmet eder:
 *
 * 1) Validation — caller'lar manuel state UPDATE yapmamalı; ama yine de
 *    canTransition() helper'ı invariant doğrulama için kullanılabilir
 *    (örn. test runner, sağlık raporu).
 *
 * 2) UI rozet metadata — stateLabel(state), stateColor(state) helper'ları
 *    Slice 3'te bütün rozet gösterimlerinde tek kaynak olur.
 *
 * NOT: TS state machine SADECE referans/UI içindir. Gerçek state hesabı
 * DB tarafında compute_order_state(). Caller'lar ASLA orders.state'i
 * doğrudan UPDATE etmez (DB trigger zincirini bozar).
 */

import type { OrderState } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Transition matrisi
// ─────────────────────────────────────────────────────────────────────────────
//
// Her state'ten geçilebilen state'lerin kümesi. Sadece "izin verilen" geçişler;
// gerçek geçişi DB compute_order_state() yapar. canTransition validation amaçlı.
//
// İptal: her non-terminal'den serbest. (Saha kuralı 1 May 2026.)
// Terminal: kapali, iptal — geri dönüş yok.

const TRANSITIONS: Record<OrderState, OrderState[]> = {
  yeni: ['recete_yok', 'plan_bekliyor', 'uretilebilir', 'iptal'],
  recete_yok: ['plan_bekliyor', 'uretilebilir', 'yeni', 'iptal'],
  plan_bekliyor: ['tedarik_bekliyor', 'uretilebilir', 'iptal'],
  tedarik_bekliyor: ['uretilebilir', 'plan_bekliyor', 'iptal'],
  uretilebilir: ['uretiliyor', 'plan_bekliyor', 'tedarik_bekliyor', 'iptal'],
  uretiliyor: ['tamamlandi', 'iptal'],
  tamamlandi: ['kapanma_bekliyor', 'kapali', 'iptal'],
  kapanma_bekliyor: ['kapali', 'iptal'],
  kapali: [],   // terminal
  iptal: [],    // terminal
}

export function canTransition(from: OrderState, to: OrderState): boolean {
  if (from === to) return true   // no-op değişim her zaman valid
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isTerminal(state: OrderState): boolean {
  return state === 'kapali' || state === 'iptal'
}

export function isActive(state: OrderState): boolean {
  // "Aktif" = sipariş hâlâ üretim akışında. Saha sayfaları "aktif siparişler" filtresinde kullanır.
  return state !== 'kapali' && state !== 'iptal'
}

// ─────────────────────────────────────────────────────────────────────────────
// UI metadata
// ─────────────────────────────────────────────────────────────────────────────

const LABELS: Record<OrderState, string> = {
  yeni: 'Yeni',
  recete_yok: 'Reçete Yok',
  plan_bekliyor: 'Plan Bekliyor',
  tedarik_bekliyor: 'Tedarik Bekliyor',
  uretilebilir: 'Üretilebilir',
  uretiliyor: 'Üretiliyor',
  tamamlandi: 'Tamamlandı',
  kapanma_bekliyor: 'Kapanma Bekliyor',
  kapali: 'Kapalı',
  iptal: 'İptal',
}

export function stateLabel(state: OrderState): string {
  return LABELS[state] ?? String(state)
}

// Tailwind renk paleti — saha UI'sinde tutarlılık için tek kaynak.
// Slice 3'teki rozet bileşenleri buradan okur.
const COLORS: Record<OrderState, { bg: string; text: string; border: string }> = {
  yeni:             { bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-300' },
  recete_yok:       { bg: 'bg-orange-100',  text: 'text-orange-800',  border: 'border-orange-300' },
  plan_bekliyor:    { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300' },
  tedarik_bekliyor: { bg: 'bg-yellow-100',  text: 'text-yellow-800',  border: 'border-yellow-300' },
  uretilebilir:     { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300' },
  uretiliyor:       { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-300' },
  tamamlandi:       { bg: 'bg-green-100',   text: 'text-green-800',   border: 'border-green-300' },
  kapanma_bekliyor: { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300' },
  kapali:           { bg: 'bg-zinc-200',    text: 'text-zinc-700',    border: 'border-zinc-400' },
  iptal:            { bg: 'bg-red-100',     text: 'text-red-800',     border: 'border-red-300' },
}

export function stateColor(state: OrderState) {
  return COLORS[state] ?? { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' }
}

// Tek-string rozet sınıfı (kısa kullanım için)
export function stateBadgeClass(state: OrderState): string {
  const c = stateColor(state)
  return `${c.bg} ${c.text} ${c.border} border rounded px-2 py-0.5 text-xs font-medium`
}

// ─────────────────────────────────────────────────────────────────────────────
// Listeleme ve filtreleme yardımcıları
// ─────────────────────────────────────────────────────────────────────────────

export const ALL_STATES: OrderState[] = [
  'yeni', 'recete_yok', 'plan_bekliyor', 'tedarik_bekliyor',
  'uretilebilir', 'uretiliyor', 'tamamlandi', 'kapanma_bekliyor',
  'kapali', 'iptal',
]

// "İşle ilgili" state'ler — saha siparis listesi default filtresi için.
// Slice 3'te Orders.tsx default filter olarak kullanılabilir.
export const ACTIVE_STATES: OrderState[] = [
  'yeni', 'recete_yok', 'plan_bekliyor', 'tedarik_bekliyor',
  'uretilebilir', 'uretiliyor', 'tamamlandi', 'kapanma_bekliyor',
]

export const TERMINAL_STATES: OrderState[] = ['kapali', 'iptal']
