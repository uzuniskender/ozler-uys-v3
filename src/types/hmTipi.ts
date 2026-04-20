// src/types/hmTipi.ts
// Hammadde tipi — DB şeması karşılığı TS interface'leri

export type VarsayilanBirim = 'kg' | 'metre' | 'adet' | 'm2' | 'litre';

export const VARSAYILAN_BIRIM_SECENEKLERI: Array<{
  value: VarsayilanBirim;
  label: string;
}> = [
  { value: 'adet',  label: 'Adet' },
  { value: 'kg',    label: 'Kilogram (kg)' },
  { value: 'metre', label: 'Metre (m)' },
  { value: 'm2',    label: 'Metrekare (m²)' },
  { value: 'litre', label: 'Litre (L)' },
];

export const birimLabel = (b: VarsayilanBirim): string =>
  VARSAYILAN_BIRIM_SECENEKLERI.find((x) => x.value === b)?.label ?? b;

/** DB satırının tam hali */
export interface HmTipi {
  id: string;
  kod: string;
  ad: string;
  aciklama: string | null;
  varsayilan_birim: VarsayilanBirim;
  sira: number;
  aktif: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

/** Yeni kayıt oluştururken gönderilecek alanlar */
export interface HmTipiInsert {
  kod: string;
  ad: string;
  aciklama?: string | null;
  varsayilan_birim?: VarsayilanBirim;
  sira?: number;
  aktif?: boolean;
  created_by?: string | null;
}

/** Mevcut kaydı güncellerken gönderilecek alanlar (hepsi opsiyonel) */
export interface HmTipiUpdate {
  kod?: string;
  ad?: string;
  aciklama?: string | null;
  varsayilan_birim?: VarsayilanBirim;
  sira?: number;
  aktif?: boolean;
  updated_by?: string | null;
}

/** Form doğrulama kuralları (hem service hem component paylaşır) */
export const HM_TIPI_KURALLAR = {
  KOD_MIN: 2,
  KOD_MAX: 10,
  KOD_REGEX: /^[A-ZÇĞİÖŞÜ0-9_]+$/,
  AD_MIN: 1,
  AD_MAX: 80,
  ACIKLAMA_MAX: 240,
  SIRA_MIN: 0,
  SIRA_MAX: 9999,
} as const;
