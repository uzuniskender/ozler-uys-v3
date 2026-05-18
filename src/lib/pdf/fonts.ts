import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

let fontCache: { regular: string | null } = { regular: null }

async function loadFontBase64(): Promise<string> {
  if (fontCache.regular) return fontCache.regular

  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  const url = `${baseUrl}/fonts/DejaVuSans.ttf`

  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`PDF font yuklenemedi: ${url} → ${resp.status}`)
  }
  const buf = await resp.arrayBuffer()

  // arrayBuffer → base64 (chunked, big buffer için)
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

/** Yeni jsPDF — DejaVu Sans yüklü, A4 portrait, Türkçe karakter destekli. */
export async function newPdf(): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const b64 = await loadFontBase64()
  doc.addFileToVFS('DejaVuSans.ttf', b64)
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal')
  doc.setFont('DejaVuSans', 'normal')

  return doc
}
