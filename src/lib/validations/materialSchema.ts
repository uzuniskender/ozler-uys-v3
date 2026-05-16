import { z } from 'zod'

export const materialFormSchema = z.object({
  kod: z.string().trim().min(1, 'Malzeme kodu zorunlu').max(50, 'Malzeme kodu en fazla 50 karakter'),
  ad: z.string().trim().min(1, 'Malzeme adı zorunlu').max(200, 'Malzeme adı en fazla 200 karakter'),
  tip: z.string().trim().min(1, 'Malzeme tipi zorunlu').max(50, 'Malzeme tipi en fazla 50 karakter'),
  birim: z.string().trim().min(1, 'Birim zorunlu').max(20, 'Birim en fazla 20 karakter'),
  hammaddeTipi: z.string().trim().max(50, 'HM tipi en fazla 50 karakter').optional().default(''),
  boy: z.number().min(0, 'Boy negatif olamaz'),
  en: z.number().min(0, 'En negatif olamaz'),
  kalinlik: z.number().min(0, 'Kalınlık negatif olamaz'),
  uzunluk: z.number().min(0, 'Uzunluk negatif olamaz'),
  cap: z.number().min(0, 'Çap negatif olamaz'),
  minStok: z.number().min(0, 'Min stok negatif olamaz'),
}).refine(
  d => !(d.tip === 'Hammadde' || d.tip === 'YarıMamul') || (d.hammaddeTipi?.trim().length ?? 0) > 0,
  { message: 'Hammadde ve Yarı Mamul için HM tipi zorunlu', path: ['hammaddeTipi'] },
)

export type MaterialFormData = z.infer<typeof materialFormSchema>
