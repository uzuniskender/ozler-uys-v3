export type RezervasyonDurumu = 'aktif' | 'kullanildi' | 'iptal';

export interface StokRezervasyonu {
  id: string;
  malkod: string;
  miktar: number;
  isEmriId: string;        // hangi iş emri için rezerve edildi
  siparisId?: string;      // opsiyonel: hangi sipariş
  durum: RezervasyonDurumu;
  olusturmaTarihi: string;
  kullanimTarihi?: string;
  iptalTarihi?: string;
  aciklama?: string;
}

export interface RezervasyonOzet {
  malkod: string;
  toplamStok: number;
  rezervEdilen: number;
  musaitStok: number;      // toplamStok - rezervEdilen
}
