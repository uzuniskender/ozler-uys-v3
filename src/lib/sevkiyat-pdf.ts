import type { Sevk, Material } from '@/types'
import { newPdf, ozlerHeader, ozlerFooter } from '@/lib/pdf-utils'

const HEAD_DARK: [number, number, number] = [45, 45, 52]
const HEAD_SUB:  [number, number, number] = [65, 65, 78]
const WHITE:     [number, number, number] = [255, 255, 255]
const DARK:      [number, number, number] = [30, 30, 30]
const FOOT_BG:   [number, number, number] = [228, 228, 236]
const BASE = { font: 'DejaVuSans', fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' as const }

function birim(k: { malkod: string; birim?: string }, mats: Material[]): string {
  return k.birim || mats.find(m => m.kod === k.malkod)?.birim || 'Adet'
}

export async function generateSevkiyatPDF(sevkler: Sevk[], materials: Material[]): Promise<void> {
  const doc = await newPdf()
  const d = doc as any
  const margin = 15

  const toplamKalem  = sevkler.reduce((a, s) => a + (s.kalemler?.length || 0), 0)
  const toplamMiktar = sevkler.reduce((a, s) => a + (s.kalemler || []).reduce((b, k) => b + (k.miktar || 0), 0), 0)

  let y = ozlerHeader(doc, {
    baslik: 'SEVKİYAT LİSTESİ',
    altBaslik: `${sevkler.length} sevkiyat · ${toplamKalem} kalem · ${toplamMiktar} adet`,
  })

  for (let i = 0; i < sevkler.length; i++) {
    const s = sevkler[i]
    const kalemler = s.kalemler || []
    const topAdet = kalemler.reduce((a, k) => a + (k.miktar || 0), 0)

    // Başlık satırı
    d.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: BASE,
      headStyles: { fillColor: HEAD_DARK, textColor: WHITE, fontStyle: 'normal' },
      bodyStyles: { textColor: DARK },
      head: [[`${s.siparisNo || '—'}   ·   ${s.musteri || '—'}   ·   ${s.tarih || '—'}`]],
      body: s.not ? [[`Not: ${s.not}`]] : [],
      theme: 'grid',
    })
    y = d.lastAutoTable.finalY + 1

    // Kalemler tablosu
    d.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      styles: BASE,
      headStyles:  { fillColor: HEAD_SUB, textColor: WHITE, fontStyle: 'normal' },
      bodyStyles:  { textColor: DARK },
      footStyles:  { fillColor: FOOT_BG, textColor: DARK },
      head: [['Malzeme Kodu', 'Malzeme Adı', 'Miktar', 'Birim']],
      body: kalemler.map(k => [
        k.malkod || '—',
        k.malad  || '—',
        String(k.miktar || 0),
        birim(k, materials),
      ]),
      foot: [['', 'TOPLAM ADET', String(topAdet), '']],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 26, halign: 'right' as const },
        3: { cellWidth: 24, halign: 'center' as const },
      },
    })
    y = d.lastAutoTable.finalY + (i < sevkler.length - 1 ? 7 : 4)

    // Sonraki sevkiyat için yer yoksa yeni sayfa
    const pageH = d.internal.pageSize.getHeight()
    if (i < sevkler.length - 1 && y > pageH - 65) {
      d.addPage()
      y = 20
    }
  }

  ozlerFooter(doc, {
    imzaLabels: ['Gönderen (Kaşe + İmza)', 'Alıcı (Kaşe + İmza)'],
  })

  doc.save(`sevkiyat-${new Date().toISOString().slice(0, 10)}.pdf`)
}
