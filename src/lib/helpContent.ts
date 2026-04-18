// Her sayfa için yardım içeriği
// Sayfa yolu (hash route) → içerik objesi

export interface HelpContent {
  title: string
  ozet: string
  bolumler: { baslik: string; icerik: string }[]
  ipuclari?: string[]
}

export const HELP_CONTENT: Record<string, HelpContent> = {
  '/': {
    title: 'Dashboard',
    ozet: 'Üretim, sipariş, stok ve fire durumunun genel özeti. Gerçek zamanlı güncellenir.',
    bolumler: [
      { baslik: 'Üst Kartlar', icerik: 'Bugünkü üretim, açık İE, aktif operatör, telafi onayı bekleyen fire adedi.' },
      { baslik: 'Üretim Trendi', icerik: 'Son 30 günün üretim/fire eğrisi. Aşağıdaki listelerden birine tıklayarak detaya inebilirsiniz.' },
      { baslik: 'Aktif Çalışmalar', icerik: 'Şu an aktif olan operatörler, hangi işi yapıyor, kaç dakikadır çalışıyor. "Giriş yok X saat+" durgunluk uyarısıdır.' },
      { baslik: 'Son Hareketler', icerik: 'Operatör mesajları, son stok hareketleri, son duruş kodları.' },
    ],
    ipuclari: [
      'Telafi onay bekleyen fire > 0 ise Raporlar → Fire sekmesinden telafi İE açabilirsiniz.',
      'Dashboard yenilemek için sayfayı değiştirip geri dönün — genelde gerçek zamanlı güncellenir.',
    ],
  },
  '/orders': {
    title: 'Siparişler',
    ozet: 'Müşteri siparişlerinin yönetildiği yer. Her sipariş kabul edildikten sonra MRP çalıştırılır, iş emirleri (İE) otomatik açılır.',
    bolumler: [
      { baslik: 'Yeni Sipariş', icerik: '+ butonuyla sipariş oluşturun. Reçete seçince mamul kodu/adı otomatik gelir. Kaydettiğinizde reçete ağacına göre İE\'ler otomatik oluşur.' },
      { baslik: 'Toplu Excel İçe Aktarma', icerik: 'Excel → "Toplu Ekle" butonu. Şablon örnek satır içerir, Sipariş No / Müşteri / Termin / Mamul Kod / Adet sütunları zorunlu.' },
      { baslik: 'MRP Hesabı', icerik: 'Her sipariş için MRP hesaplanır: Stok + açık tedarik ≥ ihtiyaç mı kontrol edilir. Eksikler için "Tedarik Oluştur" butonu tedarik kayıtları açar.' },
      { baslik: 'Durum Sütunları', icerik: 'İlerleme = iş emirlerinin ortalama üretim yüzdesi. MRP = tedarik planlama durumu (📊 bekliyor / ⚡ çalıştırıldı / ✓ tamam). Sevk = sevkiyat durumu (— / Kısmi / ✓ Tamam).' },
      { baslik: 'Kapatma', icerik: 'Kilit ikonu ile sipariş kapatılabilir. Tamamen sevk edildiyse sistem önerir ama otomatik kapatmaz.' },
    ],
    ipuclari: [
      'Filtreler üstte: Aktif / Geciken / Kapalı',
      'Müşteri adına tıklayınca arama filtresi kısayolu.',
      'Sipariş no tıklayınca detay modali açılır, orada kırılımı görebilirsiniz.',
    ],
  },
  '/work-orders': {
    title: 'İş Emirleri',
    ozet: 'Siparişlerden türetilen veya manuel açılan üretim emirleri. Operatörler buradan çalışır.',
    bolumler: [
      { baslik: 'Yeni İE (Manuel)', icerik: '+ Yeni İE — reçete dışı veya sipariş dışı üretim için (bağımsız). Fire telafi İE\'leri de otomatik burada görünür.' },
      { baslik: 'Durum Geçişleri', icerik: 'bekliyor (Başlamadı) → uretimde → tamamlandi. Fire+sağlam toplamı hedefe ulaşınca otomatik tamamlanır. Beklet/İptal opsiyonu mevcut.' },
      { baslik: 'Filtreler', icerik: 'Çoklu seçimli (checkbox): Durum, Tip (Sipariş/YM bağımsız). Arama her alanda (İE no, malzeme, operasyon, sipariş no).' },
      { baslik: 'Detay Modal', icerik: 'Göz ikonu → hammadde bileşenleri, kesim planı, hareket geçmişi (tarih+saat+operatör+duruş), not. Admin "Kayıt Ekle" ile manuel log atabilir.' },
      { baslik: 'Rozetler', icerik: '🔁 Fire Telafisi kırmızı — başka İE\'den kaynaklı. Sipariş Dışı amber — bağımsız İE.' },
    ],
    ipuclari: [
      'Kayıt silmek istediğinizde bağlı stok hareketleri ve fire kayıtları da silinir (cascade).',
      'URL\'ye ?ie=XXX&log=YYY eklerseniz o İE\'nin detayı açılır, log highlight olur.',
      'Reports → Detay Rapor\'dan bir log satırına tıklayınca aynı şey otomatik olur.',
    ],
  },
  '/production': {
    title: 'Üretim Girişi (Admin)',
    ozet: 'Operatörün yerine admin tarafından üretim kaydı girilen sayfa. Geçmişe tarih atabilir, toplu giriş yapabilir.',
    bolumler: [
      { baslik: 'Tekli Giriş', icerik: 'Bölüm + operatör seç → açık İE\'ler listelenir → İE seçip adet/fire/duruş/tarih gir.' },
      { baslik: 'Toplu Giriş', icerik: 'Birden fazla İE\'ye aynı anda giriş. Tablo halinde adet/fire doldur, tek tıkla kaydet.' },
      { baslik: 'Kurallar', icerik: 'q + f ≤ hedef (hard constraint). Fire-only giriş (q=0, f=1) kabul edilir. HM tüketimi sağlam + fire toplam üzerinden hesaplanır.' },
    ],
  },
  '/operator': {
    title: 'Operatör Paneli',
    ozet: 'Sahada operatörlerin kendi üretim kaydını attığı ekran. Login ekranında üretim sorumlusu/operatör seçilir.',
    bolumler: [
      { baslik: 'İş Seçme', icerik: 'Bölümüne göre açık İE\'ler listelenir. İE\'ye tıklayınca üretim modal\'ı açılır.' },
      { baslik: 'Adet + Fire + Duruş', icerik: 'Adet ve fire birlikte girilebilir. Duruş kodu ekleyince dakika bazlı duruş kaydolur. Başlangıç/bitiş saati otomatik gelir.' },
      { baslik: 'Mesajlaşma', icerik: 'Sağdaki ⌨ ikon ile yöneticiyle mesajlaşabilir — soru, sorun bildirimi, izin talebi.' },
      { baslik: 'Kapanış', icerik: 'İE tamamlandığında aktif çalışma otomatik kapatılır, operatör serbestlenir.' },
    ],
  },
  '/materials': {
    title: 'Malzemeler',
    ozet: 'Hammadde, yarı mamul, mamul ve sarf malzeme kataloğu. Stok kartlarının kaynağı.',
    bolumler: [
      { baslik: 'Malzeme Ekle', icerik: '+ butonu ile manuel veya Excel\'den toplu. Kod, ad, tip (HM/YM/Mamul/Sarf), birim, ölçüler.' },
      { baslik: 'Cascade Güncelleme', icerik: 'Malzeme adı/kodu değişince bağlı BOM/Reçete/İE satırları da otomatik güncellenir. Toplu değişiklik geri alınamaz, dikkatli.' },
      { baslik: 'Tipe Göre', icerik: 'HM: Profil/Boru/Sac alt tip seçilir. YM: reçetesi vardır. Mamul: bitmiş ürün. Sarf: tüketilir, reçete satırında çarpılır.' },
    ],
  },
  '/recipes': {
    title: 'Reçeteler',
    ozet: 'Ürün ağacı tabanlı operasyon ve malzeme listesi. Bir sipariş geldiğinde bu reçeteden İE\'ler patlatılır.',
    bolumler: [
      { baslik: 'Reçete Oluştur', icerik: 'Mamul seç, kırılım ağacı oluştur (1 / 1.1 / 1.1.1 hiyerarşi). Her satıra operasyon + istasyon + süre + miktar.' },
      { baslik: 'Excel İçe/Dışa', icerik: 'Mevcut reçeteleri Excel olarak dışa aktar, doldur, geri yükle. Sütun adları tutarlı olmalı.' },
      { baslik: 'İşlem Süresi Analizi', icerik: 'Log\'lardan gerçek üretim süreleri analiz edilir, reçetedeki plan süreyle fark gösterilir.' },
    ],
  },
  '/bom': {
    title: 'Ürün Ağaçları (BOM)',
    ozet: 'Reçeteden bağımsız, sadece malzeme hiyerarşisi. MRP için kullanılır.',
    bolumler: [
      { baslik: 'BOM vs Reçete', icerik: 'BOM sadece "ne üretmek için ne gerekir" bilgisini tutar. Reçete BOM + operasyon + istasyon + süre içerir. BOM daha sade, değişiklik pratik.' },
    ],
  },
  '/cutting': {
    title: 'Kesim Planları',
    ozet: 'Uzun hammadde barlarının hangi ölçüye nasıl kesileceği planı. MRP\'de kesim planı varsa BOM\'u override eder.',
    bolumler: [
      { baslik: 'Plan Oluştur', icerik: 'YM için mevcut İE\'leri topla, en az fire verecek bar sayısını hesapla. Algoritma en çok parça + en az fire stratejisini kullanır.' },
      { baslik: 'Kilitli Satır Birleştirme', icerik: 'Yeni siparişler geldiğinde, aynı HM için bekleyen eski plan ile birleştirilebilir. Kilitli (başlamış) satırlar korunur.' },
    ],
  },
  '/mrp': {
    title: 'MRP — Malzeme İhtiyaç Planlaması',
    ozet: 'Sipariş + açık İE\'ler → gerekli hammadde. Stok + açık tedarikten düşer, eksiği gösterir.',
    bolumler: [
      { baslik: 'Hesap Mantığı', icerik: 'Her sipariş için BOM patlatılır → hammadde brüt ihtiyaç. Stok düşülür, açık tedarikler düşülür. Net > 0 olanlar eksik.' },
      { baslik: 'Tedarik Aç', icerik: 'Eksik satırlar için tek tıkla toplu tedarik kaydı açılır. Tedarikler → Bekliyor listesinde görünür.' },
      { baslik: 'YM Özel', icerik: 'YM\'ler tedarik edilmez, üretilir. MRP\'de görünmez — onun için Bağımsız YM İE\'si açılır.' },
    ],
  },
  '/shipment': {
    title: 'Sevkiyat',
    ozet: 'Bitmiş mamulün müşteriye gönderilmesi. Sevkiyat fişi kesildiğinde mamul stok çıkışı yazılır, sipariş sevk_durum güncellenir.',
    bolumler: [
      { baslik: 'Yeni Sevkiyat', icerik: 'Sipariş seç → kalemler otomatik gelir → miktar doğrula → kaydet. Sipariş seçmeden de kesilebilir (siparişsiz).' },
      { baslik: 'Stok Çıkışı', icerik: '"Stok çıkışı yap" işaretliyse her kalem için cikis stok hareketi yazılır. İptal edilirse sadece fiş oluşur.' },
      { baslik: 'Sevk Durumu', icerik: 'Otomatik: sevk_yok → kismi_sevk → tamamen_sevk. Tamamen sevk edilince kullanıcıya kapatma önerisi çıkar.' },
      { baslik: 'Silme', icerik: 'Sevkiyat silindiğinde bağlı stok çıkışları da silinir, sipariş sevk_durum yeniden hesaplanır.' },
    ],
  },
  '/warehouse': {
    title: 'Depo / Stok',
    ozet: 'Malzeme kartlarının güncel stok durumu. Mamul + YM + HM tümü.',
    bolumler: [
      { baslik: 'Net Stok', icerik: 'Tüm giriş hareketleri - tüm çıkış hareketleri. Minus olursa satış/sevk/tüketim yapılmış ama giriş yazılmamış demek.' },
      { baslik: 'Tedarik Girişi', icerik: 'Tedarikler → "Geldi" butonuna basınca otomatik stok giriş hareketi oluşur. Burada da manuel giriş yapılabilir.' },
    ],
  },
  '/reports': {
    title: 'Raporlar',
    ozet: 'Üretim, fire, operatör performansı, OEE, süre analizleri.',
    bolumler: [
      { baslik: 'Özet', icerik: 'Günlük/haftalık/aylık toplamlar, trend grafikleri.' },
      { baslik: 'Detay Rapor', icerik: 'Her üretim log\'u ayrı satır — tarih, saat, operatör, adet, fire, duruş. Satıra tıklayınca İE detayına gider.' },
      { baslik: 'Fire Sekmesi', icerik: 'Telafi edilmemiş fire kayıtları. 🔁 Aç butonu ile yönetici onayı gerektiren telafi İE\'si açılır.' },
      { baslik: 'Operatör / Makine', icerik: 'Kim ne kadar üretmiş, hangi makine ne kadar durmuş.' },
    ],
  },
  '/data': {
    title: 'Veri Yönetimi',
    ozet: 'Yedekleme, içe aktarma, sistem bakım araçları.',
    bolumler: [
      { baslik: 'JSON Yedek', icerik: 'Tüm tabloların snapshot\'ı. İndirip güvende tut, gerektiğinde yükle (üzerine yazar).' },
      { baslik: 'Orphan Temizle', icerik: 'Silinmiş ana kaydın (İE/log/fire) bağlıları (log, fire log, stok hareketi, telafi İE) temizlenir. Batch 50 kayıt, özet modalı gösterir.' },
      { baslik: 'Duplicate Malzeme Birleştir', icerik: 'Case-insensitive aynı koda sahip malzemeler tek kayıtta birleştirilir, referanslar cascade güncellenir.' },
      { baslik: 'Sistem Testi', icerik: 'Malzeme reçete tutarsızlığı, orphan kesim, eksik tedarik-stok gibi sorunları tarar.' },
      { baslik: 'Kullanıcı ve Yetki', icerik: 'RBAC — 4 rol, 80+ aksiyon, checkbox matris editörü.' },
    ],
    ipuclari: ['Test modunu açıp kapatarak izole veri ile deneme yapabilirsiniz.'],
  },
  '/test': {
    title: 'Smoke Test',
    ozet: '12 adımlı otomatik akış testi. Fire → telafi → üretim → stok → cascade. TEST-SMOKE-* öneki ile izole, sonunda temizlik.',
    bolumler: [
      { baslik: 'Ne Zaman Çalıştırılır', icerik: 'Deploy sonrası büyük değişikliklerde. Canlı veriye dokunmaz.' },
    ],
  },
  '/problem-takip': {
    title: 'Problem Takip',
    ozet: 'Fabrika genelindeki problemleri, hedef tarihleri ve kim ne yaptı tarihçesini tek yerden takip etmek için basit bir not defteri.',
    bolumler: [
      { baslik: 'Yeni Problem', icerik: '+ Yeni Problem butonu ile kayıt açın. Problem tanımı zorunlu, diğerleri opsiyonel.' },
      { baslik: 'Durum Mantığı', icerik: 'Açık = henüz çalışılmaya başlanmadı · Devam = çalışılıyor · Kapandı = çözüldü. Kapandı işaretlenince kapatma tarihi otomatik bugün olur.' },
      { baslik: 'Termin ve Gecikme', icerik: 'Termin geçmiş ve durum "Kapandı" değilse satır kırmızı görünür ve KPI "Geciken" sayısına eklenir.' },
      { baslik: '+ Yeni Aksiyon Ekle', icerik: 'Modal içindeki bu buton "Yapılanlar" kutusuna otomatik olarak tarih-saat ve isim damgası yapıştırır. Damganın yanına yazdığınız metin tarihçeye birikir. Silmeyin, üstüne yazın.' },
      { baslik: 'Son Değişiklik Barı', icerik: 'Sayfanın üstünde kimin en son hangi kaydı değiştirdiği görünür — ekip koordinasyonu için.' },
      { baslik: 'Sıralama', icerik: 'Geciken kayıtlar üstte, sonra Açık > Devam > Kapandı, her grup içinde termin yakın olan önce.' },
    ],
    ipuclari: [
      '"Yapılanlar" alanını silmeyin, üstüne yeni aksiyon ekleyin — tam tarihçe burada tutulur.',
      'Terminiyle birlikte sorumluyu da yazarsanız kim takipçi netleşir.',
      'Kapandı olan kayıtlar silinmez, sadece altta görünür — raporlama ve öğrenme için.',
    ],
  },
}

export function getHelpFor(pathname: string): HelpContent | null {
  // Hash route'u normalize et
  const normalized = pathname.split('?')[0].split('#')[0] || '/'
  return HELP_CONTENT[normalized] || null
}
