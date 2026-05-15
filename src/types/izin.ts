// src/types/izin.ts
// uys_izinler için insert tipi.
//
// Okuma tipi: mevcut `Izin` (@/types/index.ts) kullanılır.
// not_ ↔ not, op_id ↔ opId vb. köprüsü servis içinde kurulur.

export type IzinTip = 'yıllık' | 'mazeret' | 'rapor' | 'ücretsiz'
export type IzinDurum = 'bekliyor' | 'onaylandi' | 'reddedildi'
export type IzinOlusturan = 'operator' | 'admin'

/** Yeni izin talebi oluştururken. */
export interface IzinInsert {
  /** Boşsa servis uid() ile üretir. */
  id?: string
  opId: string
  opAd: string
  baslangic: string
  /** Verilmezse baslangic ile aynı gün. */
  bitis?: string
  tip?: IzinTip
  /** Saatlik izin için HH:MM. */
  saatBaslangic?: string | null
  saatBitis?: string | null
  not?: string | null
  /** Kimin oluşturduğu. Varsayılan 'operator'. */
  olusturan?: IzinOlusturan
}
