/**
 * v15.53 Adım 1 — Yedekleme servisi
 * ─────────────────────────────────────────────────────────────────────────
 * UYS v3'ün ana iş tablolarının snapshot'ını uys_yedekler'e yazar / okur.
 *
 * Faz 1 kapsamı (bu dosya):
 *   - takeBackup     — manuel veya otomatik yedek al
 *   - listBackups    — yedek listesini hafif olarak getir (veri alanı boş)
 *   - getBackup      — tek yedek detayı (veri alanı dolu)
 *   - deleteBackup   — yedek sil
 *
 * Faz 3 kapsamı (sonraki):
 *   - restoreBackup  — geri yükleme (TEHLİKELİ — admin only + 2-adım onay)
 *
 * Faz 4 kapsamı (sonraki):
 *   - cleanOldBackups — 30 günden eski otomatik yedekleri sil
 *
 * NOT (§18.2 Tip D):
 *   uys_yedekler tablosu store mapper'da YOK. Bu dosya kendi fetch ediyor.
 *   Backup tablosunun kendisi BACKUP_TABLES listesinde DEĞİL — recursion önlenir.
 */

import { supabase } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────

export interface Backup {
  id: string
  alindiTarih: string  // YYYY-MM-DD
  alindiSaat: string   // ISO timestamp
  alanKisi: string
  tip: 'otomatik' | 'manuel'
  boyutKb: number | null
  veri: BackupSnapshot | null  // listBackups'ta null (1MB+ olabilir, gereksiz transfer)
  notlar: string | null
}

export interface BackupSnapshot {
  _version: 'v3'
  _takenAt: string         // ISO timestamp
  _takenBy: string         // alan kişi
  tables: Record<string, any[]>
}

export interface BackupResult {
  ok: boolean
  id?: string
  boyutKb?: number
  error?: string
}

// ─── Config ─────────────────────────────────────────────────────────────

/**
 * Yedeklenen tablo listesi.
 *
 * Hariç tutulanlar:
 *   - uys_yedekler              — kendisi (recursion)
 *   - uys_chat_*                — mesajlar (büyük veri, kalıcı değer taşımaz)
 *   - uys_test_runs             — test verisi (Tip C — yeniden hesaplanabilir)
 *   - uys_pending_flows         — geçici akış state (Tip C)
 *   - uys_v15_31_silinen_*      — silinmiş veri arşivi (ihtiyaç olursa eklenir)
 *   - uys_mrp_rezerve           — MRP run snapshot (yeniden hesaplanabilir, Tip C)
 *
 * NOT: Bu liste İş Emri #12 sonrası RLS aktifleşince çalışmayabilir
 * (sadece auth'lı kullanıcılar belirli tabloları okuyabilir). Backup işlemi
 * o zaman service-role key veya Edge Function üzerinden yapılmalı.
 */
const BACKUP_TABLES = [
  // Üretim akışı
  'uys_orders', 'uys_work_orders', 'uys_logs', 'uys_fire_logs',
  'uys_kesim_planlari', 'uys_acik_barlar',
  // Reçeteler ve malzeme
  'uys_recipes', 'uys_bom_trees', 'uys_malzemeler',
  'uys_stok_hareketler',
  // Tedarik
  'uys_tedarikler', 'uys_tedarikciler',
  // İş süreci
  'uys_customers', 'uys_operators', 'uys_kullanicilar',
  'uys_operations', 'uys_stations', 'uys_durus_kodlari', 'uys_hm_tipleri',
  // Yetki
  'uys_yetki_ayarlari',
  // Operatör paneli iş kayıtları
  'uys_active_work', 'uys_operator_notes', 'uys_izinler',
  // Sevkiyat + diğer
  'uys_sevkler', 'uys_checklist', 'uys_notes',
  // Snapshot tabloları (audit için tutulur)
  'uys_mrp_calculations',
  // Problem takip
  'pt_problemler',
] as const

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Manuel veya otomatik yedek al. Tüm BACKUP_TABLES'ı paralel okur, JSON
 * snapshot oluşturur, uys_yedekler'e INSERT eder.
 *
 * @param alanKisi Yedek alan kullanıcı (useAuth user.username || email || 'system')
 * @param tip 'manuel' (default) veya 'otomatik' (cron için)
 * @param notlar Manuel yedeklerde etiket (örn. "v15.18 deploy öncesi")
 */
export async function takeBackup(
  alanKisi: string,
  tip: 'otomatik' | 'manuel' = 'manuel',
  notlar?: string
): Promise<BackupResult> {
  if (!alanKisi || alanKisi.trim() === '') {
    return { ok: false, error: 'alanKisi boş olamaz' }
  }

  try {
    // 1) Tüm tabloları paralel oku
    const tableData: Record<string, any[]> = {}
    const fetches = BACKUP_TABLES.map(async (t) => {
      const { data, error } = await supabase.from(t).select('*')
      if (error) throw new Error(`${t}: ${error.message}`)
      tableData[t] = data || []
    })
    await Promise.all(fetches)

    // 2) Snapshot objesini kur
    const snapshot: BackupSnapshot = {
      _version: 'v3',
      _takenAt: new Date().toISOString(),
      _takenBy: alanKisi,
      tables: tableData,
    }

    // 3) Boyut hesapla (KB)
    const json = JSON.stringify(snapshot)
    const boyutKb = Math.ceil(json.length / 1024)

    // 4) DB'ye kaydet
    const { data: inserted, error } = await supabase
      .from('uys_yedekler')
      .insert({
        alindi_tarih: new Date().toISOString().slice(0, 10),
        alan_kisi: alanKisi,
        tip,
        boyut_kb: boyutKb,
        veri: snapshot,
        notlar: notlar || null,
      })
      .select('id')
      .single()

    if (error) return { ok: false, error: error.message }
    return { ok: true, id: inserted?.id, boyutKb }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Bilinmeyen hata' }
  }
}

/**
 * Yedek listesini getir (hafif — veri alanı null).
 * UI listesinde 1MB+ veri transferi gereksiz; getBackup ile teker teker çekilir.
 */
export async function listBackups(): Promise<Backup[]> {
  const { data, error } = await supabase
    .from('uys_yedekler')
    .select('id, alindi_tarih, alindi_saat, alan_kisi, tip, boyut_kb, notlar')
    .order('alindi_tarih', { ascending: false })
    .order('alindi_saat', { ascending: false })

  if (error || !data) return []
  return data.map((r: any) => ({
    id: r.id,
    alindiTarih: r.alindi_tarih,
    alindiSaat: r.alindi_saat,
    alanKisi: r.alan_kisi,
    tip: r.tip,
    boyutKb: r.boyut_kb,
    veri: null,
    notlar: r.notlar,
  }))
}

/**
 * Tek bir yedeğin detayını getir (veri alanı dolu).
 * Geri yükleme veya indirme için kullanılır.
 */
export async function getBackup(id: string): Promise<Backup | null> {
  if (!id) return null
  const { data, error } = await supabase
    .from('uys_yedekler')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return {
    id: data.id,
    alindiTarih: data.alindi_tarih,
    alindiSaat: data.alindi_saat,
    alanKisi: data.alan_kisi,
    tip: data.tip,
    boyutKb: data.boyut_kb,
    veri: data.veri,
    notlar: data.notlar,
  }
}

/**
 * Yedek sil. RBAC tarafından kontrol edilmeli (backup_delete permission).
 */
export async function deleteBackup(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: 'id boş' }
  const { error } = await supabase.from('uys_yedekler').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Faz 3+ için stub'lar (henüz implementasyon yok) ────────────────────

/**
 * STUB — Faz 3'te (sonraki oturum) implementasyon eklenecek.
 * TEHLİKELİ — Tüm verileri yedekteki haline geri çevirir.
 */
// export async function restoreBackup(...): Promise<RestoreResult> { ... }

/**
 * STUB — Faz 4'te (sonraki oturum) implementasyon eklenecek.
 * 30 günden eski otomatik yedekleri siler. Manuel yedekler etkilenmez.
 */
// export async function cleanOldBackups(keepDays = 30): Promise<number> { ... }
