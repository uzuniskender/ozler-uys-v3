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

// ─── Faz 3 — Geri Yükleme ───────────────────────────────────────────────

export interface RestoreResult {
  ok: boolean
  mode: 'merge' | 'replace'
  guvenlikYedegiId?: string  // restore öncesi otomatik alınan güvenlik yedeği
  insertedRows?: number
  affectedTables?: number
  error?: string
  step?: string  // hata oluşursa hangi adımda
}

export type RestoreProgress = (step: string, detail?: string) => void

/**
 * Yedeği geri yükler. İki mod var:
 *
 * - **merge** (güvenli): Yedekteki kayıtları mevcutlara UPSERT eder. Mevcut yeni
 *   veriler korunur. Yedekte olan + DB'de olan: yedektekiyle güncellenir.
 *   Yedekte olmayan + DB'de olan: değişmez. Yedekte olan + DB'de olmayan: eklenir.
 *
 * - **replace** (TEHLİKELİ): Yedekteki tabloları önce DELETE, sonra INSERT eder.
 *   Yedekten sonra eklenen TÜM veri kaybolur. Sadece yedeği bire bir restore eder.
 *
 * Her iki modda da:
 *   1) Önce otomatik güvenlik yedeği alınır (geri yükleme öncesi snapshot)
 *   2) Yedek versiyonu kontrol edilir (v3 destekli, v22 kapsam dışı)
 *   3) Tablolar üzerinde DELETE/UPSERT yapılır (BACKUP_TABLES sırasıyla)
 *
 * @param backupId Geri yüklenecek yedek ID'si (uys_yedekler.id)
 * @param mode 'merge' veya 'replace'
 * @param alanKisi İşlemi yapan kullanıcı (audit + güvenlik yedeği için)
 * @param onProgress Adım adım UI feedback için callback
 */
export async function restoreBackup(
  backupId: string,
  mode: 'merge' | 'replace',
  alanKisi: string,
  onProgress?: RestoreProgress
): Promise<RestoreResult> {
  if (!backupId) return { ok: false, mode, error: 'backupId boş' }
  if (!alanKisi) return { ok: false, mode, error: 'alanKisi boş' }

  let currentStep = 'baslatiliyor'

  try {
    // ─── 1) Güvenlik yedeği al ───
    currentStep = 'guvenlik_yedegi'
    onProgress?.('Güvenlik yedeği alınıyor...', 'Geri yükleme öncesi mevcut durumun snapshot\'ı')
    const guvSonuc = await takeBackup(
      alanKisi,
      'manuel',
      `[GÜVENLİK] Geri yükleme öncesi (${mode}) — yedek ID: ${backupId.slice(0, 8)}...`
    )
    if (!guvSonuc.ok) {
      return { ok: false, mode, step: currentStep, error: 'Güvenlik yedeği alınamadı: ' + guvSonuc.error }
    }
    const guvenlikYedegiId = guvSonuc.id

    // ─── 2) Yedeği oku ───
    currentStep = 'yedek_okuma'
    onProgress?.('Yedek okunuyor...', 'Snapshot DB\'den çekiliyor')
    const backup = await getBackup(backupId)
    if (!backup || !backup.veri) {
      return { ok: false, mode, step: currentStep, error: 'Yedek bulunamadı veya boş' }
    }

    // ─── 3) Versiyon kontrolü ───
    const snapshot = backup.veri
    if (!snapshot._version || snapshot._version !== 'v3') {
      return {
        ok: false, mode, step: currentStep,
        error: `Bu yedek formatı henüz desteklenmiyor (versiyon: ${snapshot._version || 'bilinmiyor'}). Sadece v3 yedekler restore edilebilir.`,
      }
    }
    if (!snapshot.tables || typeof snapshot.tables !== 'object') {
      return { ok: false, mode, step: currentStep, error: 'Yedek tabloları okunamıyor (snapshot.tables eksik)' }
    }

    // ─── 4) Replace mode: önce DELETE ───
    if (mode === 'replace') {
      currentStep = 'temizleme'
      onProgress?.('Veriler temizleniyor...', 'Mevcut tablolar siliniyor (replace mode)')
      // Ters sırada sil — FK olabilir, child önce silinmeli
      // BACKUP_TABLES sırası zaten parent-child düzeninde (orders → work_orders)
      // Ters sırada sileceğiz: en sondan başla
      const reverseOrder = [...BACKUP_TABLES].reverse()
      for (const t of reverseOrder) {
        // .neq('id', '__non_existent__') hilesi: WHERE clause olmadan DELETE
        // Supabase RLS bunu istemez; gerçek bir filter koymalı.
        // Tüm satırları silmek için: filter('id', 'neq', '__no_id__') yerine
        // .gte('alindi_saat', '1900-01-01') gibi her zaman doğru bir filter kullan.
        // Pragmatik: id alanı tüm tabloda var, dolu — id IS NOT NULL filter
        const { error } = await supabase.from(t).delete().not('id', 'is', null)
        if (error) {
          return {
            ok: false, mode, step: currentStep, guvenlikYedegiId,
            error: `Tablo temizlenemedi (${t}): ${error.message}. Güvenlik yedeği: ${guvenlikYedegiId}`,
          }
        }
      }
    }

    // ─── 5) INSERT / UPSERT ───
    currentStep = mode === 'replace' ? 'yedekten_yukleme' : 'birlestirme'
    onProgress?.(
      mode === 'replace' ? 'Yedek geri yükleniyor...' : 'Yedek mevcut verilerle birleştiriliyor...',
      `${BACKUP_TABLES.length} tablo işleniyor`
    )

    let totalRows = 0
    let affectedTables = 0
    for (const t of BACKUP_TABLES) {
      const rows = snapshot.tables[t] || []
      if (rows.length === 0) continue
      affectedTables++
      // 500'lük chunk'lar halinde upsert (Supabase limit'i)
      for (let i = 0; i < rows.length; i += 500) {
        const chunk = rows.slice(i, i + 500)
        const { error } = await supabase.from(t).upsert(chunk, { onConflict: 'id' })
        if (error) {
          return {
            ok: false, mode, step: currentStep, guvenlikYedegiId,
            error: `Insert/upsert hatası (${t}): ${error.message}. Güvenlik yedeği: ${guvenlikYedegiId}`,
          }
        }
        totalRows += chunk.length
      }
    }

    // ─── 6) Tamamlandı ───
    currentStep = 'tamamlandi'
    onProgress?.('Tamamlandı ✓', `${totalRows} kayıt, ${affectedTables} tablo`)

    return {
      ok: true,
      mode,
      guvenlikYedegiId,
      insertedRows: totalRows,
      affectedTables,
    }
  } catch (e: any) {
    return {
      ok: false,
      mode,
      step: currentStep,
      error: e?.message || 'Beklenmeyen hata',
    }
  }
}

// ─── Faz 4+ için stub'lar ──────────────────────────────────────────────

/**
 * STUB — Faz 4'te implementasyon eklenecek.
 * 30 günden eski otomatik yedekleri siler. Manuel yedekler etkilenmez.
 */
// export async function cleanOldBackups(keepDays = 30): Promise<number> { ... }
