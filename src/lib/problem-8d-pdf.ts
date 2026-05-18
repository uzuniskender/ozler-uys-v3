import type { Problem } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter } from '@/lib/pdf-utils'

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const p = iso.slice(0, 10).split('-')
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : iso
}

function fmtDT(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return (
    String(d.getDate()).padStart(2, '0') + '.' +
    String(d.getMonth() + 1).padStart(2, '0') + '.' +
    d.getFullYear() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

const HEAD_FILL: [number, number, number] = [45, 45, 52]
const HEAD_TEXT: [number, number, number] = [255, 255, 255]
const BODY_TEXT: [number, number, number] = [30, 30, 30]
const BASE_STYLES = {
  font: 'DejaVuSans',
  fontSize: 9,
  cellPadding: { top: 2, right: 3, bottom: 2, left: 3 } as any,
  overflow: 'linebreak' as const,
}
const HEAD_STYLES = { fillColor: HEAD_FILL, textColor: HEAD_TEXT, fontStyle: 'normal' as const, fontSize: 9 }
const BODY_STYLES = { textColor: BODY_TEXT, fontSize: 9 }

function section(d: any, y: number, margin: number, label: string, content: string, minH = 14): number {
  d.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    styles: { ...BASE_STYLES, minCellHeight: minH },
    headStyles: HEAD_STYLES,
    bodyStyles: BODY_STYLES,
    head: [[label]],
    body: [[content || '—']],
    theme: 'grid',
  })
  return d.lastAutoTable.finalY + 3
}

export async function print8DPdf(p: Problem): Promise<void> {
  const doc = await newPdf()
  const d = doc as any
  const margin = 15
  const pageWidth = d.internal.pageSize.getWidth()
  const half = (pageWidth - margin * 2) / 2

  let y = ozlerHeader(doc, {
    baslik: '8D PROBLEM RAPORU',
    altBaslik: `Oluşturma: ${fmtDT(p.olusturma)}`,
  })

  // D1 — Ekip + Durum/Tarih meta satırı
  d.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    styles: BASE_STYLES,
    headStyles: HEAD_STYLES,
    bodyStyles: BODY_STYLES,
    head: [['D1 — Ekip / Sorumlu', 'Durum & Tarihler']],
    body: [[
      `Sorumlu: ${p.sorumlu || '—'}\nOluşturan: ${p.olusturan || '—'}\nSon Değiştiren: ${p.sonDegistiren || '—'}`,
      `Durum: ${p.durum}\nTermin: ${p.termin ? fmtDate(p.termin) : '—'}\nOluşturma: ${fmtDT(p.olusturma)}\nKapatma: ${p.kapatmaTarihi ? fmtDate(p.kapatmaTarihi) : '—'}`,
    ]],
    theme: 'grid',
    columnStyles: { 0: { cellWidth: half }, 1: { cellWidth: half } },
  })
  y = d.lastAutoTable.finalY + 3

  y = section(d, y, margin, 'D2 — Problem Tanımı', p.problem, 20)
  y = section(d, y, margin, 'D3 — Geçici Tedbirler & Aksiyon Tarihçesi', p.yapilanlar || '—', 28)
  y = section(d, y, margin, 'D4 — Kök Neden Analizi', p.kokNeden || '—', 20)
  y = section(d, y, margin, 'D5 — Kalıcı Düzeltici Aksiyon', p.kaliciCozum || '—', 20)

  // D6 — D7 yan yana
  d.autoTable({
    startY: y,
    margin: { left: margin, right: margin },
    styles: { ...BASE_STYLES, minCellHeight: 22 },
    headStyles: HEAD_STYLES,
    bodyStyles: BODY_STYLES,
    head: [['D6 — Çözüm Doğrulaması', 'D7 — Yayılımın Önlenmesi']],
    body: [[p.notlar || '—', '']],
    theme: 'grid',
    columnStyles: { 0: { cellWidth: half }, 1: { cellWidth: half } },
  })
  y = d.lastAutoTable.finalY + 3

  // D8 — Kapanış
  const d8 = p.durum === 'Kapandı'
    ? `Kapatma Tarihi: ${p.kapatmaTarihi ? fmtDate(p.kapatmaTarihi) : '—'} · Kapatan: ${p.sonDegistiren || '—'}\n\nProblem çözüldü ve kapatıldı.`
    : `Durum: ${p.durum} — Problem henüz kapatılmamış.\n`
  section(d, y, margin, 'D8 — Kapanış ve Tebrik', d8, 16)

  ozlerFooter(doc, { imzaLabels: ['Hazırlayan', 'Yönetici Onayı'] })

  doc.save(`8D-rapor-${new Date().toISOString().slice(0, 10)}.pdf`)
}
