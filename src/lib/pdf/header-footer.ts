import type { jsPDF } from 'jspdf'
import { OZLER, sirketAdresMetni, sirketVergiMetni, type SirketBilgileri } from '@/lib/sirket-bilgileri'

export interface HeaderOptions {
  baslik: string
  altBaslik?: string
  sirket?: SirketBilgileri
  irsaliyeYerineGecer?: boolean
}

export interface FooterOptions {
  imzaIki?: boolean
  imzaLabels?: string[]
  notlar?: string
  disclaimer?: string
}

export function ozlerHeader(doc: jsPDF, opts: HeaderOptions): number {
  const s = opts.sirket || OZLER
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFont('DejaVuSans', 'normal')
  doc.setFontSize(11)
  doc.text(s.kisaUnvan, margin, 20, { maxWidth: 75 })
  doc.setFontSize(8)
  const adresLines = sirketAdresMetni(s).split('\n')
  let yLeft = 25
  for (const line of adresLines) {
    doc.text(line, margin, yLeft, { maxWidth: 75 })
    yLeft += 4
  }

  doc.setFontSize(18)
  doc.text(opts.baslik, pageWidth / 2, 22, { align: 'center' })
  if (opts.altBaslik) {
    doc.setFontSize(11)
    doc.text(opts.altBaslik, pageWidth / 2, 30, { align: 'center' })
  }
  if (opts.irsaliyeYerineGecer) {
    doc.setFontSize(8)
    doc.text('(İrsaliye yerine geçer)', pageWidth / 2, 36, { align: 'center' })
  }

  doc.setFontSize(8)
  const vergiLines = sirketVergiMetni(s).split('\n')
  let yRight = 20
  for (const line of vergiLines) {
    doc.text(line, pageWidth - margin, yRight, { align: 'right' })
    yRight += 4
  }
  yRight += 2
  const tarih = new Date().toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Yazdırma: ${tarih}`, pageWidth - margin, yRight, { align: 'right' })

  const lineY = Math.max(yLeft, yRight) + 2
  doc.setLineWidth(0.3)
  doc.line(margin, lineY, pageWidth - margin, lineY)

  return lineY + 5
}

export function ozlerFooter(doc: jsPDF, opts: FooterOptions = {}) {
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 35

  doc.setFont('DejaVuSans', 'normal')

  if (opts.notlar) {
    doc.setFontSize(8)
    doc.text(opts.notlar, margin, footerY - 8, { maxWidth: pageWidth - 2 * margin })
  }

  let labels: string[]
  if (opts.imzaLabels && opts.imzaLabels.length > 0) {
    labels = opts.imzaLabels
  } else if (opts.imzaIki) {
    labels = ['Gönderen (Kaşe + İmza)', 'Alıcı (Kaşe + İmza)']
  } else {
    labels = ['Düzenleyen (İmza)']
  }

  doc.setFontSize(9)

  const n = labels.length
  if (n === 1) {
    const cellW = 80
    const startX = (pageWidth - cellW) / 2
    doc.line(startX, footerY + 10, startX + cellW, footerY + 10)
    doc.text(labels[0], pageWidth / 2, footerY + 14, { align: 'center' })
  } else {
    const totalGap = (n - 1) * 10
    const cellW = (pageWidth - 2 * margin - totalGap) / n
    for (let i = 0; i < n; i++) {
      const x1 = margin + i * (cellW + 10)
      const x2 = x1 + cellW
      doc.line(x1, footerY + 10, x2, footerY + 10)
      doc.text(labels[i], (x1 + x2) / 2, footerY + 14, { align: 'center' })
    }
  }

  if (opts.disclaimer) {
    doc.setFontSize(7)
    doc.setTextColor(110, 110, 110)
    doc.text(opts.disclaimer, pageWidth / 2, pageHeight - 14, { align: 'center', maxWidth: pageWidth - 2 * margin })
    doc.setTextColor(0, 0, 0)
  }

  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  const pageNo = doc.getNumberOfPages()
  doc.text(`Sayfa ${pageNo}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  doc.text('UYS v3 — Üretim Yönetim Sistemi', margin, pageHeight - 8)
}

/** Uzun string'i belirli karaktere kadar kes + "…" ekle. */
export function kisaltma(s: string | undefined | null, max = 50): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** Tarih formatı — '2026-04-30' veya ISO → 'GG.AA.YYYY' */
export function trTarih(d: string | Date | undefined | null): string {
  if (!d) return ''
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    if (isNaN(date.getTime())) return String(d)
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return String(d) }
}

/** Sayı formatı — 1.234,56 */
export function trSayi(n: number | string | undefined | null, ondalik = 0): string {
  if (n === null || n === undefined || n === '') return ''
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return String(n)
  return num.toLocaleString('tr-TR', { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik })
}
