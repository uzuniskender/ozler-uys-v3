// v15.92 — Madde 15 P2: Mamul Rezerv/Serbest Hesabi
// Saha modeli §25: Mamul stoga giren urun, eger bir siparise bagli IE'den
// uretildiyse REZERVDIR (sadece o siparis icin). Aksi halde SERBESTtir.
//
// Hesap mantigi:
//   stok_hareketler.tip='giris' + rezerv_order_id=order_id  -> REZERV (toplama gir, rezervMiktar)
//   stok_hareketler.tip='giris' + rezerv_order_id=NULL      -> SERBEST (toplama gir, serbestMiktar)
//   stok_hareketler.tip='cikis'                              -> Mevcut akıs: hangisinden cıkıldı? FIFO termin.
//                                                              Pratik yaklasim: cikis once REZERV'den, sonra SERBEST'ten.
//                                                              (mevcut sistem rezerv_order_id'yi cikis'ta yazmiyor)
//
// rezerv_order_id kolonu v15.90 P1 ile eklendi (yeni giris kayitlari).
// Eski kayıtlar (v15.90 oncesi) rezerv_order_id NULL -> serbest sayilir (geriye uyum).

import type { StokHareket } from '@/types'

export interface MamulRezervDurum {
  malkod: string
  toplamStok: number
  rezervToplam: number
  serbestMiktar: number
  rezervDetay: Array<{
    orderId: string
    siparisNo: string
    musteri: string
    termin: string
    miktar: number
  }>
}

interface OrderLite {
  id: string
  siparisNo: string
  musteri: string
  termin?: string
}

/**
 * Bir mamulun stok rezerv/serbest dagilimini hesaplar.
 * - Toplam stok = sum(giris) - sum(cikis)
 * - Rezerv toplam = giris kayitlarindan rezerv_order_id dolu olanlarin sumu
 * - Serbest = toplamStok - rezervToplam (cikis once rezerv'den dustugunden hesap dogru)
 *
 * NOT: Bu hesap iki yaklasim sunar:
 *   1) Naif: rezervToplam = sum(giris where rezerv_order_id IS NOT NULL)
 *      -> Cikis hangisinden gitti onu izlemiyor; serbest = toplamStok - rezervToplam
 *      -> Eger toplamStok < rezervToplam ise (cikislar rezervden gitti), serbest 0, rezerv ise eksik gozukur
 *
 * Implementasyon: SERBEST = max(0, toplamStok - rezervToplam) seklinde guvenli sinirla.
 * Detayli takip P3'te (FIFO tahsis) gelecek.
 */
export function hesaplaMamulRezervDurum(
  malkod: string,
  hareketler: StokHareket[],
  orders: OrderLite[]
): MamulRezervDurum {
  let girisToplam = 0
  let cikisToplam = 0
  const rezervMap = new Map<string, number>() // orderId -> miktar

  for (const h of hareketler) {
    if (h.malkod !== malkod) continue
    const m = Number(h.miktar) || 0
    if (h.tip === 'giris') {
      girisToplam += m
      const rezervId = (h as any).rezervOrderId || (h as any).rezerv_order_id
      if (rezervId) {
        rezervMap.set(rezervId, (rezervMap.get(rezervId) || 0) + m)
      }
    } else if (h.tip === 'cikis') {
      cikisToplam += m
    }
  }

  const toplamStok = girisToplam - cikisToplam

  // Rezerv toplam'i toplamStok ile sinirla (cikis rezerv'den gitti senaryosu)
  let rezervToplam = 0
  for (const v of rezervMap.values()) rezervToplam += v
  if (rezervToplam > toplamStok) rezervToplam = toplamStok

  const serbestMiktar = Math.max(0, toplamStok - rezervToplam)

  // Detay: rezerv kayitlarini termin sirasina gore listele (FIFO)
  const detay: MamulRezervDurum['rezervDetay'] = []
  for (const [orderId, miktar] of rezervMap.entries()) {
    if (miktar <= 0) continue
    const ord = orders.find(o => o.id === orderId)
    detay.push({
      orderId,
      siparisNo: ord?.siparisNo || orderId,
      musteri: ord?.musteri || '-',
      termin: ord?.termin || '',
      miktar,
    })
  }
  detay.sort((a, b) => (a.termin || '9999-12-31').localeCompare(b.termin || '9999-12-31'))

  return {
    malkod,
    toplamStok,
    rezervToplam,
    serbestMiktar,
    rezervDetay: detay,
  }
}
