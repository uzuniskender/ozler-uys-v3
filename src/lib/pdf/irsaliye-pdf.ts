import type { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import type { Sevk, Material } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter, trTarih, trSayi, kisaltma } from '.'

interface Doc extends jsPDF {
  autoTable: (opts: any) => any
  lastAutoTable: { finalY: number }
}

const HEAD:    [number, number, number] = [45, 45, 52]
const HEAD_2:  [number, number, number] = [65, 65, 78]
const WHITE:   [number, number, number] = [255, 255, 255]
const FOOT_BG: [number, number, number] = [228, 228, 236]
const DARK:    [number, number, number] = [30, 30, 30]
const BASE = { font: 'DejaVuSans', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' as const }

function resolvedBirim(k: { malkod: string; birim?: string }, mats: Material[]): string {
  return k.birim || mats.find(m => m.kod === k.malkod)?.birim || 'Adet'
}

export async function generateIrsaliyePDF(sevkler: Sevk[], materials: Material[]): Promise<void> {
  if (!sevkler.length) return
  const doc = await newPdf() as Doc
  const margin = 15
  const pageW = doc.internal.pageSize.getWidth()
  const sutunW = (pageW - 2 * margin - 5) / 2

  for (let i = 0; i < sevkler.length; i++) {
    if (i > 0) doc.addPage()
    const s = sevkler[i]
    const kalemler = s.kalemler || []
    const toplamAdet = kalemler.reduce((a, k) => a + (k.miktar || 0), 0)
    const irsaliyeNo = s.sevkNo || s.siparisNo || s.id.slice(0, 8).toUpperCase()

    let y = ozlerHeader(doc, { baslik: 'SEVKİYAT İRSALİYESİ', altBaslik: irsaliyeNo })

    const solBilgi: [string, string][] = [
      ['Sipariş No', s.siparisNo || '—'],
      ['Müşteri', kisaltma(s.musteri, 50) || '—'],
      ['Sevk Tarihi', trTarih(s.tarih)],
    ]
    if (s.musteriKod) solBilgi.push(['Müşteri Kod', s.musteriKod])

    const sagBilgi: [string, string][] = [
      ['İrsaliye No', irsaliyeNo],
      ['Toplam Kalem', String(kalemler.length)],
      ['Toplam Adet', trSayi(toplamAdet, 0)],
    ]
    if (s.not) sagBilgi.push(['Not', kisaltma(s.not, 40)])

    doc.autoTable({
      startY: y,
      head: [['Müşteri / Sipariş', '']],
      body: solBilgi,
      theme: 'grid',
      styles: BASE,
      headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'normal' },
      bodyStyles: { textColor: DARK },
      columnStyles: { 0: { cellWidth: 32, textColor: [80, 80, 80] as [number,number,number], fontStyle: 'normal' }, 1: { cellWidth: sutunW - 32 } },
      margin: { left: margin, right: pageW - margin - sutunW },
      tableWidth: sutunW,
    })
    const solBitis = doc.lastAutoTable.finalY

    doc.autoTable({
      startY: y,
      head: [['Belge Bilgisi', '']],
      body: sagBilgi,
      theme: 'grid',
      styles: BASE,
      headStyles: { fillColor: HEAD, textColor: WHITE, fontStyle: 'normal' },
      bodyStyles: { textColor: DARK },
      columnStyles: { 0: { cellWidth: 32, textColor: [80, 80, 80] as [number,number,number], fontStyle: 'normal' }, 1: { cellWidth: sutunW - 32 } },
      margin: { left: margin + sutunW + 5, right: margin },
      tableWidth: sutunW,
    })
    const sagBitis = doc.lastAutoTable.finalY
    y = Math.max(solBitis, sagBitis) + 6

    doc.setFont('DejaVuSans', 'normal')
    doc.setFontSize(10)
    doc.text('Kalemler', margin, y)
    y += 4

    doc.autoTable({
      startY: y,
      head: [['#', 'Malzeme Kodu', 'Malzeme Adı', 'Miktar', 'Birim']],
      body: kalemler.map((k, idx) => [
        String(idx + 1),
        k.malkod || '—',
        kisaltma(k.malad, 65) || '—',
        trSayi(k.miktar, 0),
        resolvedBirim(k, materials),
      ]),
      foot: [['', '', 'TOPLAM ADET', trSayi(toplamAdet, 0), '']],
      theme: 'grid',
      styles: BASE,
      headStyles: { fillColor: HEAD_2, textColor: WHITE, fontStyle: 'normal' },
      bodyStyles: { textColor: DARK },
      footStyles: { fillColor: FOOT_BG, textColor: DARK, fontStyle: 'normal' },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' as const },
        1: { cellWidth: 38 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 26, halign: 'right' as const },
        4: { cellWidth: 22, halign: 'center' as const },
      },
      margin: { left: margin, right: margin },
    })

    ozlerFooter(doc, {
      imzaLabels: ['Gönderen (Kaşe + İmza)', 'Alıcı (Kaşe + İmza)'],
      disclaimer: 'Bu belge iç takip ve saha kullanımı amaçlıdır. Resmi sevk irsaliyesi e-İrsaliye sistemi üzerinden düzenlenir.',
    })
  }

  doc.save(`irsaliye_${new Date().toISOString().slice(0, 10)}.pdf`)
}
