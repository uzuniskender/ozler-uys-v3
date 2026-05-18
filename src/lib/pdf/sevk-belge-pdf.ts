import type { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import type { Sevk, Order } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter, trTarih, trSayi, kisaltma } from '.'

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (opts: any) => any
  lastAutoTable: { finalY: number }
}

export interface SevkBelgePDFInput {
  sevk: Sevk
  order?: Order
  ekstraAlanlar?: {
    sevkNo?: string
    tasiyici?: string
    plaka?: string
    musteriKod?: string
    olusturan?: string
  }
}

export async function generateSevkBelgePDF(input: SevkBelgePDFInput): Promise<void> {
  const { sevk: s, order, ekstraAlanlar = {} } = input
  const sevkAny = s as any
  const sevkNo = ekstraAlanlar.sevkNo || sevkAny.sevkNo || sevkAny.sevk_no || s.id
  const tasiyici = ekstraAlanlar.tasiyici || sevkAny.tasiyici || ''
  const plaka = ekstraAlanlar.plaka || sevkAny.plaka || ''
  const musteriKod = ekstraAlanlar.musteriKod || sevkAny.musteriKod || sevkAny.musteri_kod || ''
  const olusturan = ekstraAlanlar.olusturan || sevkAny.olusturan || ''

  const doc = (await newPdf()) as JsPDFWithAutoTable

  let y = ozlerHeader(doc, {
    baslik: 'SEVK BELGESİ',
    altBaslik: sevkNo,
  })

  doc.setFontSize(10)
  doc.setFont('DejaVuSans', 'normal')

  const solKart: [string, string][] = [
    ['Sipariş No', s.siparisNo || order?.siparisNo || '—'],
    ['Müşteri Kod', musteriKod || '—'],
    ['Müşteri', kisaltma(s.musteri || order?.musteri, 50) || '—'],
    ['Sevk Tarihi', trTarih(s.tarih)],
    ['Düzenleyen', olusturan || '—'],
  ]

  const sagKart: [string, string][] = [
    ['Taşıyıcı', kisaltma(tasiyici, 35) || '—'],
    ['Plaka', plaka || '—'],
    ['Toplam Kalem', String((s.kalemler || []).length)],
    ['Toplam Miktar', trSayi((s.kalemler || []).reduce((a, k) => a + (Number(k.miktar) || 0), 0), 0)],
    ['Belge Türü', 'İç Sevk Belgesi'],
  ]

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const sutunGenis = (pageWidth - 2 * margin - 5) / 2

  doc.autoTable({
    startY: y,
    head: [['Sipariş / Müşteri', '']],
    body: solKart,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
    bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'normal', textColor: [60, 60, 60] },
      1: { cellWidth: sutunGenis - 30 },
    },
    margin: { left: margin, right: pageWidth - margin - sutunGenis },
    tableWidth: sutunGenis,
  })
  const solBitis = doc.lastAutoTable.finalY

  doc.autoTable({
    startY: y,
    head: [['Taşıma / Belge', '']],
    body: sagKart,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
    bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'normal', textColor: [60, 60, 60] },
      1: { cellWidth: sutunGenis - 30 },
    },
    margin: { left: margin + sutunGenis + 5, right: margin },
    tableWidth: sutunGenis,
  })
  const sagBitis = doc.lastAutoTable.finalY

  y = Math.max(solBitis, sagBitis) + 6

  doc.setFontSize(11)
  doc.text('Kalemler', margin, y)
  y += 4

  const kalemler = s.kalemler || []
  if (kalemler.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Sıra', 'Kod', 'Açıklama', 'Miktar', 'Birim']],
      body: kalemler.map((k, i) => {
        const ka = k as any
        return [
          String(i + 1),
          k.malkod || '—',
          kisaltma(k.malad, 60) || '—',
          trSayi(k.miktar, 0),
          ka.birim || 'adet',
        ]
      }),
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
      bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    })
    y = doc.lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9)
    doc.text('(Kalem yok)', margin, y)
    y += 8
  }

  if (s.not) {
    doc.setFontSize(10)
    doc.text('Notlar', margin, y)
    y += 4
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(s.not, pageWidth - 2 * margin)
    doc.text(lines, margin, y)
  }

  ozlerFooter(doc, {
    imzaLabels: ['Gönderen (Kaşe + İmza)', 'Şoför (İmza)', 'Teslim Eden (İmza)'],
    disclaimer: 'Resmi sevk irsaliyesi e-İrsaliye sisteminden basılır. Bu belge iç takip, saha kullanımı ve ISO audit kanıt amaçlıdır.',
  })

  const dosyaAd = `Sevk-${(sevkNo || s.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  doc.save(dosyaAd)
}
