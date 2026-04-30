/**
 * PDF ortak yardımcı modülü — v16.29 (Asama 4 v2 sonrasi PDF altyapı).
 *
 * - jsPDF + jspdf-autotable kullanır
 * - DejaVu Sans TTF font (public/fonts/DejaVuSans.ttf) — Türkçe karakter destekli
 * - Lazy fetch: ilk PDF üretiminde TTF indirilir + cache'lenir, sonraki PDF'ler hızlı
 * - Bundle etkilenmez (TTF statik dosya, fetch ile yüklenir)
 *
 * Kullanım:
 *   import { newPdf, ozlerHeader, ozlerFooter } from '@/lib/pdf-utils'
 *   const doc = await newPdf()
 *   ozlerHeader(doc, { baslik: 'IS EMRI', altBaslik: 'IE-2026-001' })
 *   doc.autoTable({ ... })
 *   ozlerFooter(doc)
 *   doc.save('IE-2026-001.pdf')
 */

import { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import { OZLER, sirketAdresMetni, sirketVergiMetni, type SirketBilgileri } from './sirket-bilgileri'

// Font byte array cache (modul scope, sayfa yenilenene kadar tutulur)
let fontCache: { regular: string | null } = { regular: null }

/**
 * DejaVu Sans TTF'i fetch et + base64 string olarak cache'le.
 * jsPDF.addFileToVFS base64 string ister.
 */
async function loadFontBase64(): Promise<string> {
  if (fontCache.regular) return fontCache.regular

  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const url = `${baseUrl}/fonts/DejaVuSans.ttf`

  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`PDF font yuklenemedi: ${url} → ${resp.status}`)
  }
  const buf = await resp.arrayBuffer()

  // arrayBuffer → base64 string (chunked, big buffer için)
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const b64 = btoa(bin)
  fontCache.regular = b64
  return b64
}

/**
 * Yeni jsPDF oluştur — DejaVu Sans yüklü + default font set.
 * A4 portrait, mm birim. Türkçe karakterler tam destekli.
 */
export async function newPdf(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const b64 = await loadFontBase64()
  doc.addFileToVFS('DejaVuSans.ttf', b64)
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
  doc.setFont('DejaVuSans', 'normal')

  return doc
}

export interface HeaderOptions {
  baslik: string // ÖRNEKE: "İŞ EMRİ" veya "SEVK İRSALİYESİ"
  altBaslik?: string // ÖRNEKE: "IE-2026-001" veya "Sevk No: SEV-2026-005"
  sirket?: SirketBilgileri
  irsaliyeYerineGecer?: boolean // E-İrsaliye matbu sureti için
}

/**
 * Standart Özler header — sayfanın üst kısmını çizer + cursor'u içerik başlangıcına bırakır.
 * Layout:
 *   [SOL] Logo / Unvan       [ORTA] BÜYÜK BAŞLIK       [SAĞ] VKN + Vergi Dairesi
 *         Adres satırları                                       Tarih
 * Geri dönüş: y koordinatı (içerik bu y'den itibaren başlar)
 */
export function ozlerHeader(doc: jsPDF, opts: HeaderOptions): number {
  const s = opts.sirket || OZLER
  const margin = 15
  const pageWidth = doc.internal.pageSize.getWidth()

  // Sol blok: unvan + adres
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

  // Orta: Büyük başlık
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

  // Sağ blok: VKN + Vergi dairesi + tarih
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

  // Yatay çizgi
  const lineY = Math.max(yLeft, yRight) + 2
  doc.setLineWidth(0.3)
  doc.line(margin, lineY, pageWidth - margin, lineY)

  return lineY + 5
}

export interface FooterOptions {
  imzaIki?: boolean // true = Gönderen + Alıcı imzası, false = sadece Düzenleyen imzası
  notlar?: string // İsteğe bağlı altta yer alacak ek not
}

/**
 * Standart Özler footer — sayfanın alt kısmında imza alanları + sayfa numarası çizer.
 * Imza alanlarının yatay konumu sayfa genişliğine göre dağıtılır.
 */
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

  doc.setFontSize(9)

  if (opts.imzaIki) {
    // İki imza alanı: gönderen sol, alıcı sağ
    const cellW = (pageWidth - 2 * margin - 20) / 2
    // Sol: Gönderen
    doc.line(margin, footerY + 10, margin + cellW, footerY + 10)
    doc.text('Gönderen (Kaşe + İmza)', margin + cellW / 2, footerY + 14, { align: 'center' })
    // Sağ: Alıcı
    doc.line(pageWidth - margin - cellW, footerY + 10, pageWidth - margin, footerY + 10)
    doc.text('Alıcı (Kaşe + İmza)', pageWidth - margin - cellW / 2, footerY + 14, { align: 'center' })
  } else {
    // Tek imza alanı: ortalı
    const cellW = 80
    const startX = (pageWidth - cellW) / 2
    doc.line(startX, footerY + 10, startX + cellW, footerY + 10)
    doc.text('Düzenleyen (İmza)', pageWidth / 2, footerY + 14, { align: 'center' })
  }

  // Sayfa numarası
  doc.setFontSize(7)
  const pageNo = doc.getNumberOfPages()
  doc.text(`Sayfa ${pageNo}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  doc.text('UYS v3 — Üretim Yönetim Sistemi', margin, pageHeight - 8)
}

/**
 * Yardımcı: long string'i belirli karaktere kadar kes + "..." ekle.
 */
export function kisaltma(s: string | undefined | null, max = 50): string {
  if (!s) return ''
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/**
 * Yardımcı: tarih formatı (DB'de text olabilir, '2026-04-30' veya ISO formatlarını kabul et)
 */
export function trTarih(d: string | Date | undefined | null): string {
  if (!d) return ''
  try {
    const date = typeof d === 'string' ? new Date(d) : d
    if (isNaN(date.getTime())) return String(d)
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return String(d) }
}

/**
 * Yardımcı: sayı formatı (1.234,56 gibi)
 */
export function trSayi(n: number | string | undefined | null, ondalik = 0): string {
  if (n === null || n === undefined || n === '') return ''
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return String(n)
  return num.toLocaleString('tr-TR', { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik })
}
