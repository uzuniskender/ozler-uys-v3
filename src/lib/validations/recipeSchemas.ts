import { z } from 'zod'

export const newRecipeSchema = z.object({
  ad: z.string().min(1, 'Reçete adı zorunlu'),
  mamulKod: z.string().min(1, 'Mamul kodu zorunlu'),
})

export const recipeEditSchema = z.object({
  ad: z.string().min(1, 'Reçete adı zorunlu'),
})

export const recipeRowSchema = z.object({
  malkod: z.string().min(1, 'Malzeme kodu girilmemiş'),
  miktar: z.number().positive('Miktar sıfırdan büyük olmalı'),
})
