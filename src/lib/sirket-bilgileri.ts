/**
 * Özler Kalıp ve İskele Sistemleri A.Ş. — resmi şirket bilgileri.
 *
 * v16.29 (PDF altyapı) ile eklendi. Yasal evraklarda (sevk irsaliyesi, e-İrsaliye matbu sureti)
 * ve audit dökümanlarında (iş emri) bu bilgiler header'a yazılır.
 *
 * NOT: Buket gerçek değerleri onayladığında bu dosya güncellenir. Şu anki değerler
 * placeholder + Buket'in memory bilgilerinden çıkarılan en doğru tahmin.
 *
 * E-İrsaliye matbu sureti için zorunlu alanlar (VUK 213 madde 230):
 * - Düzenleyenin unvanı, adresi, VKN, vergi dairesi
 * - Müşterinin unvanı, adresi, VKN/TCKN
 * - Belge no, tarih, sevk tarihi
 * - Mal/hizmet bilgileri (cins, miktar, birim)
 * - Taşıyıcı bilgileri (varsa)
 * - "İrsaliye yerine geçer" ibaresi (e-İrsaliye matbu sureti ise)
 */

export interface SirketBilgileri {
  unvan: string
  kisaUnvan: string
  adres: string
  ilce: string
  il: string
  posta: string
  vkn: string
  vergiDairesi: string
  telefon: string
  faks?: string
  email: string
  web: string
  ticaretSicilNo?: string
  mersis?: string
  // Logo: public/logo.png varsa true (PDF'te görsel olarak gömülür)
  // Yoksa text fallback ("ÖZLER" büyük başlık).
  logoVarMi: boolean
}

export const OZLER: SirketBilgileri = {
  unvan: 'Özler Kalıp ve İskele Sistemleri Anonim Şirketi',
  kisaUnvan: 'Özler Kalıp ve İskele Sistemleri A.Ş.',
  adres: 'Makine İhtisas OSB, [SOKAK NO PLACEHOLDER]',
  ilce: 'Dilovası',
  il: 'Kocaeli',
  posta: '[POSTA KODU PLACEHOLDER]',
  vkn: '[VKN 10 HANELI PLACEHOLDER]',
  vergiDairesi: '[VERGI DAIRESI PLACEHOLDER]',
  telefon: '[+90 ... PLACEHOLDER]',
  email: '[INFO@OZLERKALIP.COM.TR PLACEHOLDER]',
  web: 'www.ozlerkalip.com.tr',
  logoVarMi: false, // public/logo.png eklendiğinde true yapılacak
}

/**
 * E-İrsaliye matbu sureti için tek satır şirket başlık metni.
 * Header'da iki sütun: sol = logo/unvan, sağ = adres + VKN.
 */
export function sirketAdresMetni(s: SirketBilgileri = OZLER): string {
  return `${s.adres}\n${s.ilce} / ${s.il}${s.posta ? ' ' + s.posta : ''}\nTel: ${s.telefon}${s.email ? ' • ' + s.email : ''}`
}

export function sirketVergiMetni(s: SirketBilgileri = OZLER): string {
  return `VKN: ${s.vkn}\nVergi Dairesi: ${s.vergiDairesi}`
}
