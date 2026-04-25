/**
 * v15.48a — Kesim Artığı Helper'ları (saf fonksiyon, Supabase'siz)
 *
 * Bu dosya `cutting.ts`'ten ayrıldı çünkü cutting.ts Supabase client import
 * eder; bu da vitest birim testlerinde sorun yaratıyor (env değişkeni yok →
 * Supabase init patlar). artikMalzemelerOlustur zaten DB'ye dokunmuyor, saf
 * hesaplama. Onu burada test edilebilir bir modülde tutuyoruz.
 *
 * cutting.ts geriye uyumluluk için bu dosyadan re-export eder.
 *
 * Bilgi: docs/UYS_v3_Bilgi_Bankasi.md §18.4 (eklenecek) "Test edilebilir
 * saf fonksiyon ayrımı".
 */

// ─── Inline tipler — cutting.ts'teki interface'lerin minimal versiyonları ───
// (KesimPlanSonuc tam yapısı için cutting.ts referans alınır, burada sadece
//  artikMalzemelerOlustur'un ihtiyaç duyduğu alanlar)
//
// NOT: cutting.ts'teki tipler aynı şekildeyse, type aynılığını koruyoruz.
//      structural typing sayesinde hatasız çalışır.

interface CuttingPlanForArtik {
  hamMalkod: string
  hamMalad: string
  satirlar: Array<{
    durum: string
    fireMm: number
    hamAdet: number
  }>
}

export interface ArtikSuggest {
  hamMalkod: string         // orijinal hammadde kodu (referans)
  hamMalad: string          // orijinal hammadde adı
  uzunlukMm: number         // artık boyu (mm)
  adet: number              // kaç bar bu boyda artık verdi
  onerilenKod: string       // 'ARTIK-S275-1240'
  onerilenAd: string        // 'ARTIK S275 (1240mm)'
}

/**
 * Plan'ın tamamlanmış kesim satırlarındaki fire'lardan artık malzeme önerisi üretir.
 *
 * @param plan Kesim planı (genellikle durum=tamamlandi olmuş)
 * @param ESIK_MM Bu boyun ALTINDA fire varsa atılır (gerçekten kullanılmaz). Default 50mm.
 * @returns Önerilen artık malzemeler listesi (boş array dahil)
 */
export function artikMalzemelerOlustur(
  plan: CuttingPlanForArtik,
  ESIK_MM: number = 50
): ArtikSuggest[] {
  if (!plan || !plan.satirlar) return []

  // Sadece tamamlandi durumlu satırların fire'ı dikkate alınır
  // (bekliyor satırların fire'ı henüz kesilmedi, üretim sırasında değişebilir)
  const map = new Map<string, ArtikSuggest>()

  for (const satir of plan.satirlar) {
    if (satir.durum !== 'tamamlandi') continue
    const fire = satir.fireMm || 0
    if (fire < ESIK_MM) continue

    // Her bar bu fire'ı verir → hamAdet kez çoğalt
    const adet = satir.hamAdet || 1
    const yuvarlanan = Math.round(fire)
    const key = plan.hamMalkod + '|' + yuvarlanan
    const existing = map.get(key)
    if (existing) {
      existing.adet += adet
    } else {
      map.set(key, {
        hamMalkod: plan.hamMalkod,
        hamMalad: plan.hamMalad,
        uzunlukMm: yuvarlanan,
        adet,
        onerilenKod: 'ARTIK-' + plan.hamMalkod + '-' + yuvarlanan,
        onerilenAd: 'ARTIK ' + plan.hamMalad + ' (' + yuvarlanan + 'mm)',
      })
    }
  }

  // En çok adet → en az adet sıralı
  return Array.from(map.values()).sort((a, b) => b.adet - a.adet)
}
