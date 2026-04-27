// v15.52a — Operatör sicil/şifre hash helper'ı.
// cyrb53 client-side hızlı hash. Brute-force'a karşı bcrypt kadar dayanıklı değil
// ama operatör paneli için yeterli: DB dump senaryosunda plain text okumayı engeller.
// Format: 'cyrb53:HEX' — version prefix sayesinde gelecekte bcrypt/SHA-256'ya geçiş kolay
// (verifySicil hash'in formatına bakıp ona göre verify yapar).
//
// Lazy migration stratejisi: Login.tsx ilk girişte plain text → hash dönüşümü yapar
// ve uys_operators.sifre kolonunu null'lar. 1-2 hafta sonra (tüm aktif operatörler
// login olduktan sonra) sifre kolonu ayrı bir patch'le drop edilebilir.

const PREFIX = 'cyrb53:'

function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

/**
 * Plain text sicil/şifreyi hash'ler. Format: 'cyrb53:14hex'.
 */
export function hashSicil(plain: string): string {
  return PREFIX + cyrb53(plain)
}

/**
 * Plain text girdi ile DB'deki saklı değeri karşılaştırır.
 * - Eğer DB değeri 'cyrb53:' ile başlıyorsa: hash karşılaştırması.
 * - Aksi halde (lazy migration: hash henüz set edilmemiş): plain text karşılaştırması.
 *
 * Kullanıcı doğru plain text girerse, çağıran kod (Login.tsx) hash'i set edip
 * DB'deki sifre kolonunu null'lamalı (transition tamamlanır).
 */
export function verifySicil(plain: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain) return false
  if (storedHashOrPlain.startsWith(PREFIX)) {
    return storedHashOrPlain === hashSicil(plain)
  }
  // Lazy migration: hash henüz yok, plain text karşılaştırması (transition period)
  return storedHashOrPlain === plain
}

/**
 * Verilen değer hash mi yoksa hala plain text mi olduğunu döner.
 * Login.tsx lazy migration kararı için kullanır.
 */
export function isHashed(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX)
}
