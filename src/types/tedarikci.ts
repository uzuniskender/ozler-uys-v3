// src/types/tedarikci.ts
// uys_tedarikciler için insert/update tipleri.
//
// Okuma tipi: mevcut `Tedarikci` (@/types/index.ts) kullanılır — store mapper ile uyumlu.
// Yazma tipleri burada: JS `not` alanı servis içinde DB `not_` kolonuna dönüştürülür.

/** Yeni tedarikçi oluştururken. id boşsa servis uid() ile üretir. */
export interface TedarikciInsert {
  id?: string
  kod?: string | null
  ad: string
  adres?: string | null
  tel?: string | null
  email?: string | null
  not?: string | null
}

/** Mevcut tedarikçiyi güncellerken (hepsi opsiyonel). */
export interface TedarikciUpdate {
  kod?: string | null
  ad?: string
  adres?: string | null
  tel?: string | null
  email?: string | null
  not?: string | null
}
