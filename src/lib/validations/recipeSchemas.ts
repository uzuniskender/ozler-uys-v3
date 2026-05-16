import { z } from 'zod'

export const newRecipeSchema = z.object({
  ad: z.string().min(1, 'Reçete adı zorunlu'),
  mamulKod: z.string().min(1, 'Mamul kodu zorunlu'),
})

export const recipeEditSchema = z.object({
  ad: z.string().trim().min(1, 'Reçete adı zorunlu'),
  rcKod: z.string().trim().max(50, 'Reçete kodu en fazla 50 karakter').optional(),
})

export const rcKodSchema = z.string().trim()
  .min(1, 'Reçete kodu zorunlu')
  .max(50, 'Reçete kodu en fazla 50 karakter')

export const mamulKodSchema = z.string().trim()
  .min(1, 'Mamul kodu zorunlu')
  .max(100, 'Mamul kodu en fazla 100 karakter')
  .refine(s => !/\s/.test(s), 'Mamul kodu boşluk içeremez')

export const recipeRowSchema = z.object({
  malkod: z.string().min(1, 'Malzeme kodu girilmemiş'),
  miktar: z.number().positive('Miktar sıfırdan büyük olmalı'),
})
