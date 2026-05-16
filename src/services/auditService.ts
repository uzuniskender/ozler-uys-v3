/**
 * UYS Audit Log — v16.51
 *
 * Tüm kritik olayları uys_audit_log tablosuna kaydeder.
 * Kullanım: await auditLog({ olay: 'wo_durum', ... })
 *
 * Olay tipleri:
 *  wo_durum        — İE durum değişikliği (bekliyor→uretimde vs)
 *  wo_olustur      — İE açıldı
 *  wo_sil          — İE silindi
 *  uretim_log      — Üretim girişi yapıldı
 *  stok_hareket    — Stok giriş/çıkış
 *  siparis_durum   — Sipariş durum değişikliği
 *  siparis_kapat   — Sipariş kapatıldı
 *  tedarik_geldi   — Tedarik "geldi" işaretlendi
 *  mrp_calistir    — MRP hesaplandı
 *  malkod_degis    — Malzeme kodu değişti
 *  silme           — Herhangi bir kayıt silindi
 *  login           — Kullanıcı girişi
 *  logout          — Kullanıcı çıkışı
 */

import { supabase } from '@/lib/supabase'

export interface AuditParams {
  olay: string
  tablo?: string
  kayitId?: string
  alan?: string
  eskiDeger?: string | null
  yeniDeger?: string | null
  aciklama?: string
  ekVeri?: Record<string, unknown>
}

/** Mevcut kullanıcıyı localStorage'dan al */
function getKullanici(): { id: string; ad: string } {
  try {
    const raw = localStorage.getItem('uys_v3_auth')
    if (!raw) return { id: '', ad: 'Bilinmiyor' }
    const parsed = JSON.parse(raw)
    return {
      id: parsed.dbId || parsed.authUserId || '',
      ad: parsed.username || parsed.ad || 'Bilinmiyor',
    }
  } catch {
    return { id: '', ad: 'Bilinmiyor' }
  }
}

/** Ana audit log fonksiyonu — fire-and-forget, hata fırlatmaz */
export async function auditLog(params: AuditParams): Promise<void> {
  try {
    const { id: kullanici_id, ad: kullanici_ad } = getKullanici()
    await supabase.from('uys_audit_log').insert({
      kullanici_id: kullanici_id || null,
      kullanici_ad,
      olay_tipi:  params.olay,
      tablo:      params.tablo || null,
      kayit_id:   params.kayitId || null,
      alan:       params.alan || null,
      eski_deger: params.eskiDeger ?? null,
      yeni_deger: params.yeniDeger ?? null,
      aciklama:   params.aciklama || null,
      ek_veri:    params.ekVeri ? params.ekVeri : null,
    })
  } catch {
    // Audit log hatası uygulamayı durdurmamalı
    console.warn('[audit] Log yazılamadı:', params.olay)
  }
}

/** İE durum değişikliği için kısa yardımcı */
export function auditWoDurum(params: {
  woId: string
  ieNo: string
  eskiDurum: string
  yeniDurum: string
  siparisNo?: string
  malkod?: string
}) {
  return auditLog({
    olay: 'wo_durum',
    tablo: 'uys_work_orders',
    kayitId: params.woId,
    alan: 'durum',
    eskiDeger: params.eskiDurum,
    yeniDeger: params.yeniDurum,
    aciklama: `${params.ieNo}: ${params.eskiDurum} → ${params.yeniDurum}`,
    ekVeri: {
      ie_no: params.ieNo,
      siparis_no: params.siparisNo,
      malkod: params.malkod,
    },
  })
}

/** Üretim logu kaydı için kısa yardımcı */
export function auditUretimLog(params: {
  logId: string
  woId: string
  ieNo: string
  qty: number
  fire: number
  malkod?: string
  siparisNo?: string
}) {
  return auditLog({
    olay: 'uretim_log',
    tablo: 'uys_logs',
    kayitId: params.logId,
    yeniDeger: String(params.qty),
    aciklama: `${params.ieNo}: ${params.qty} adet üretim, ${params.fire} fire`,
    ekVeri: {
      wo_id: params.woId,
      ie_no: params.ieNo,
      qty: params.qty,
      fire: params.fire,
      malkod: params.malkod,
      siparis_no: params.siparisNo,
    },
  })
}

/** Stok hareketi için kısa yardımcı */
export function auditStokHareket(params: {
  shId: string
  malkod: string
  miktar: number
  tip: 'giris' | 'cikis'
  aciklama?: string
}) {
  return auditLog({
    olay: 'stok_hareket',
    tablo: 'uys_stok_hareketler',
    kayitId: params.shId,
    alan: 'miktar',
    yeniDeger: `${params.tip === 'giris' ? '+' : '-'}${params.miktar}`,
    aciklama: params.aciklama || `${params.malkod}: ${params.tip} ${params.miktar}`,
    ekVeri: { malkod: params.malkod, miktar: params.miktar, tip: params.tip },
  })
}

/** Silme işlemi için kısa yardımcı */
export function auditSilme(params: {
  tablo: string
  kayitId: string
  aciklama: string
  ekVeri?: Record<string, unknown>
}) {
  return auditLog({
    olay: 'silme',
    tablo: params.tablo,
    kayitId: params.kayitId,
    aciklama: params.aciklama,
    ekVeri: params.ekVeri,
  })
}
