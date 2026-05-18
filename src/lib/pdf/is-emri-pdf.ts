import type { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import type { WorkOrder, Order, ProductionLog } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter, trTarih, trSayi, kisaltma } from '.'

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (opts: any) => any
  lastAutoTable: { finalY: number }
}

export interface IsEmriPDFInput {
  workOrder: WorkOrder
  order?: Order
  logs: ProductionLog[]
}

export async function generateIsEmriPDF(input: IsEmriPDFInput): Promise<void> {
  const { workOrder: w, order, logs } = input
  const doc = (await newPdf()) as JsPDFWithAutoTable

  let y = ozlerHeader(doc, {
    baslik: 'İŞ EMRİ',
    altBaslik: w.ieNo || w.id,
  })

  doc.setFontSize(10)
  doc.setFont('DejaVuSans', 'normal')

  const kartItems: [string, string][] = [
    ['Sipariş No', order?.siparisNo || (w.bagimsiz ? '(Bağımsız İE)' : (w.siparisDisi ? '(Sipariş Dışı)' : '-'))],
    ['Müşteri', order?.musteri || '-'],
    ['Sipariş Tarihi', order ? trTarih(order.tarih) : '-'],
    ['Termin', trTarih(w.termin)],
    ['Mamul Kod', w.mamulKod || '-'],
    ['Mamul Adı', kisaltma(w.mamulAd, 60) || '-'],
    ['Hedef Adet', trSayi(w.hedef, 0)],
    ['Durum', w.durum || '-'],
  ]

  doc.autoTable({
    startY: y,
    head: [['Bilgi', 'Değer']],
    body: kartItems,
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
    bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'normal', textColor: [60, 60, 60] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 15, right: 15 },
  })
  y = doc.lastAutoTable.finalY + 6

  doc.setFontSize(11)
  doc.text('Operasyon', 15, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Operasyon', 'İstasyon', 'Kırno', 'Hazırlık (dk)', 'İşlem (dk)']],
    body: [[
      `${w.opKod || ''} ${w.opAd || ''}`.trim() || '-',
      `${w.istKod || ''} ${w.istAd || ''}`.trim() || '-',
      w.kirno || '-',
      trSayi(w.hazirlikSure, 0),
      trSayi(w.islemSure, 1),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
    bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9, halign: 'center' },
    margin: { left: 15, right: 15 },
  })
  y = doc.lastAutoTable.finalY + 6

  doc.setFontSize(11)
  doc.text('Hammadde Reçetesi', 15, y)
  y += 4

  if (w.hm && w.hm.length > 0) {
    doc.autoTable({
      startY: y,
      head: [['#', 'Hammadde Kodu', 'Hammadde Adı', 'Miktar (Toplam)']],
      body: w.hm.map((h, i) => [
        String(i + 1),
        h.malkod || '-',
        kisaltma(h.malad, 50) || '-',
        trSayi(h.miktarTotal, 2),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
      bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: 15, right: 15 },
    })
    y = doc.lastAutoTable.finalY + 6
  } else {
    doc.setFontSize(9)
    doc.text('(Reçete kaydı yok)', 15, y)
    y += 8
  }

  const ueretilen = logs.reduce((s, l) => s + (Number(l.qty) || 0), 0)
  const fire = logs.reduce((s, l) => s + (Number(l.fire) || 0), 0)
  const kalan = Math.max(0, (w.hedef || 0) - ueretilen)

  doc.setFontSize(11)
  doc.text('Üretim Durumu', 15, y)
  y += 4

  doc.autoTable({
    startY: y,
    head: [['Hedef', 'Üretilen', 'Fire', 'Kalan']],
    body: [[
      trSayi(w.hedef, 0),
      trSayi(ueretilen, 0),
      trSayi(fire, 0),
      trSayi(kalan, 0),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [60, 60, 60], textColor: 255, font: 'DejaVuSans', fontStyle: 'normal' },
    bodyStyles: { font: 'DejaVuSans', fontStyle: 'normal', fontSize: 10, halign: 'center' },
    margin: { left: 15, right: 15 },
  })
  y = doc.lastAutoTable.finalY + 6

  if (w.not) {
    doc.setFontSize(10)
    doc.text('Notlar', 15, y)
    y += 4
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(w.not, 180)
    doc.text(lines, 15, y)
  }

  ozlerFooter(doc, {
    imzaIki: false,
    notlar: 'Bu belge UYS v3 üretim yönetim sistemi tarafından otomatik oluşturulmuştur. Saha kayıtları DB ile sürekli senkronize edilir.',
  })

  const dosyaAd = `IE-${(w.ieNo || w.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  doc.save(dosyaAd)
}
