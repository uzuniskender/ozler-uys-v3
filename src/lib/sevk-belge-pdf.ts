/**
 * Sevk Belgesi PDF — v16.30 (Faz 3, profesyonel iç belge yaklaşımı)
 *
 * Bu belge YASAL DEĞİLDİR — yasal e-İrsaliye DİA üzerinden GİB'e gönderilir.
 * Bu PDF iç saha kullanım, ISO audit kanıt, şoföre verilen yardımcı belge amaçlıdır.
 * Bu mimari karar separation of concerns ilkesine dayanır:
 *   - DİA + MAVVO = ticari yasal evraklar (e-Fatura, e-İrsaliye)
 *   - UYS v3      = üretim/saha yönetimi (iş emri, kesim, MRP, iç sevk takip)
 *
 * İçerik:
 *  - Header: Özler bilgileri + "SEVK BELGESİ" + sevk_no
 *  - Sipariş bilgisi (sipariş no, müşteri, sevk tarihi)
 *  - Taşıma bilgisi (taşıyıcı, plaka)
 *  - Kalemler tablosu (sıra, malkod, malad, miktar, birim)
 *  - Notlar (varsa)
 *  - 3 İmza alanı (Gönderen / Şoför / Teslim Eden)
 *  - Disclaimer footer (yasal evrak değildir)
 */

import type { jsPDF } from 'jspdf'
import 'jspdf-autotable'
import type { Sevk, Order } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter, trTarih, trSayi, kisaltma } from './pdf-utils'

interface JsPDFWithAutoTable extends jsPDF {
  autoTable: (opts: any) => any
  lastAutoTable: { finalY: number }
}

export interface SevkBelgePDFInput {
  sevk: Sevk
  order?: Order // varsa sipariş başlık bilgisi (musteri, siparisNo, vb için ekstra zenginleştirme)
  // Sevk üzerinde extra alanlar (DB'de var ama TS tipinde olmayabilir): sevkNo, tasiyici, plaka, musteriKod
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
  // Tip dışı alanları sevkin kendisinden de okuyalım (legacy + extras desteği)
  const sevkAny = s as any
  const sevkNo = ekstraAlanlar.sevkNo || sevkAny.sevkNo || sevkAny.sevk_no || s.id
  const tasiyici = ekstraAlanlar.tasiyici || sevkAny.tasiyici || ''
  const plaka = ekstraAlanlar.plaka || sevkAny.plaka || ''
  const musteriKod = ekstraAlanlar.musteriKod || sevkAny.musteriKod || sevkAny.musteri_kod || ''
  const olusturan = ekstraAlanlar.olusturan || sevkAny.olusturan || ''

  const doc = (await newPdf()) as JsPDFWithAutoTable

  // ═══ 1) HEADER ═══
  let y = ozlerHeader(doc, {
    baslik: 'SEVK BELGESİ',
    altBaslik: sevkNo,
  })

  // ═══ 2) SİPARİŞ + MÜŞTERİ + TARİH KARTI (sol blok) + TAŞIMA (sağ blok) — yan yana 2 sütun ═══
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

  // İki tabloyu yan yana: pageWidth'i ikiye böl
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

  // ═══ 3) KALEMLER TABLOSU ═══
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

  // ═══ 4) NOTLAR ═══
  if (s.not) {
    doc.setFontSize(10)
    doc.text('Notlar', margin, y)
    y += 4
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(s.not, pageWidth - 2 * margin)
    doc.text(lines, margin, y)
    y += lines.length * 4 + 4
  }

  // ═══ 5) FOOTER (3 imza + disclaimer) ═══
  ozlerFooter(doc, {
    imzaLabels: ['Gönderen (Kaşe + İmza)', 'Şoför (İmza)', 'Teslim Eden (İmza)'],
    disclaimer: 'Resmi sevk irsaliyesi e-İrsaliye sisteminden basılır. Bu belge iç takip, saha kullanımı ve ISO audit kanıt amaçlıdır.',
  })

  // ═══ 6) İNDİR ═══
  const dosyaAd = `Sevk-${(sevkNo || s.id).replace(/[^a-zA-Z0-9-_]/g, '_')}.pdf`
  doc.save(dosyaAd)
}
