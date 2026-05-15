import { z } from 'zod'

export const materialFormSchema = z.object({
  kod: z.string().min(1, 'Malzeme kodu zorunlu'),
  ad: z.string().min(1, 'Malzeme adı zorunlu'),
  boy: z.number().min(0, 'Boy negatif olamaz'),
  en: z.number().min(0, 'En negatif olamaz'),
  kalinlik: z.number().min(0, 'Kalınlık negatif olamaz'),
  uzunluk: z.number().min(0, 'Uzunluk negatif olamaz'),
  cap: z.number().min(0, 'Çap negatif olamaz'),
  minStok: z.number().min(0, 'Min stok negatif olamaz'),
})

export type MaterialFormData = z.infer<typeof materialFormSchema>
