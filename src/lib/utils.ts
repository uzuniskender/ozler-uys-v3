import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function pctColor(pct: number): string {
  if (pct >= 100) return 'text-green'
  if (pct >= 50) return 'text-amber'
  return 'text-red'
}

// ─── Tarih formatlama — tek kaynak ────────────────────────────────────────────
// fmtDate('2026-05-12')          → '12 May 2026'
// fmtDate('2026-05-12', 'short') → '12.05.2026'
// fmtDate('2026-05-12', 'month') → 'Mayıs 2026'
export function fmtDate(tarih: string | null | undefined, format: 'long' | 'short' | 'month' | 'monthday' = 'long'): string {
  if (!tarih) return '—'
  const d = new Date(tarih)
  if (isNaN(d.getTime())) return tarih
  if (format === 'short') return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (format === 'month') return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  if (format === 'monthday') return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}
