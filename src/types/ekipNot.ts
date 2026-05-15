// src/types/ekipNot.ts
// uys_notes — Ekip Notları (HelpNotesButtons "Ekip Notları" modalı).
//
// Şema notları:
//   - id text PRIMARY KEY (uuid değil; uid() ile elle atanır)
//   - audit kolonu yoktur; yazar `yazan` alanında tutulur
//   - etiketler jsonb DEFAULT '[]'
//   - tarih: 'YYYY-MM-DD', saat: 'HH:MM' (text)

/** DB satırının tam hali. */
export interface EkipNot {
  id: string
  sayfa: string
  baslik: string | null
  icerik: string
  yazan: string | null
  etiketler: string[]
  tarih: string
  saat: string | null
  updated_at: string | null
}

/** Yeni kayıt oluştururken kullanılacak alanlar. */
export interface EkipNotInsert {
  /** Boşsa servis uid() ile üretir. */
  id?: string
  sayfa: string
  baslik?: string | null
  icerik: string
  yazan?: string | null
  etiketler?: string[]
  /** Boşsa servis today() ile doldurur. */
  tarih?: string
  /** Boşsa servis o anki HH:MM ile doldurur. */
  saat?: string | null
}

/** Mevcut kaydı güncellerken kullanılacak alanlar (hepsi opsiyonel). */
export interface EkipNotUpdate {
  sayfa?: string
  baslik?: string | null
  icerik?: string
  yazan?: string | null
  etiketler?: string[]
}
