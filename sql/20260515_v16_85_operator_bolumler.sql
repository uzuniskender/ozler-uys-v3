-- v16.85: Operatöre birden fazla bölüm atanabilmesi
-- Egemen gibi iki farklı bölümde çalışan operatörler için
ALTER TABLE public.uys_operators ADD COLUMN IF NOT EXISTS bolumler text[] DEFAULT NULL;
COMMENT ON COLUMN public.uys_operators.bolumler IS 'Ek bölüm atamaları. Dolu ise bolum alanının önüne geçer.';
