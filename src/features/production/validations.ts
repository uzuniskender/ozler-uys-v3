// ═══ YASAK KONTROLLERİ — v15.38 ═══
// Parça 5: Saf validation fonksiyonları.
// Hem UI (OperatorPanel.save, WorkOrders.deleteWO) hem testRunner (Senaryo 6) kullanır.
// Sistem dışında hiçbir yol stok/duruş/silme kısıtını bypass etmemeli.
//
// Yasak 1: Stok olmadan üretim engeli (canProduceWO)
// Yasak 2: Duruş süresi > iş süresi engeli (canDurus)
// Yasak 3: Akış dışı silme engeli (canDeleteWO)

export interface ValidationResult {
  ok: boolean
  reason?: string
  meta?: Record<string, unknown>
}

// ═══ YASAK 1: Üretim — Stok Kontrolü ═══
// q+f (sağlam + fire) toplamı, HM stoğundan karşılanabilecek max üretime (maxYapilabilir) göre
// sınırlanır. maxYapilabilir hesabı OperatorPanel.maxYapilabilir() veya stokKontrolWO'dan gelir.
// Kural: admin bile bypass edemez. Önce malzeme gelmeli.
export function canProduceWO(params: {
  q: number
  f: number
  maxYapilabilir: number
}): ValidationResult {
  const { q, f, maxYapilabilir } = params
  const toplam = (q || 0) + (f || 0)
  if (toplam <= 0) return { ok: true }

  if (maxYapilabilir <= 0) {
    return {
      ok: false,
      reason:
        'Hammadde stoğu yetersiz — bu İE için hiç üretim yapılamaz. Tedarik gelmeden üretim girilemez.',
      meta: { q, f, toplam, maxYapilabilir: 0 },
    }
  }
  if (toplam > maxYapilabilir) {
    return {
      ok: false,
      reason:
        `Hammadde stoğu yetersiz — girilen ${toplam} adet (${q} sağlam + ${f} fire), ` +
        `mevcut HM ile max ${maxYapilabilir} adet yapılabilir. ` +
        `Eksik malzeme için tedarik bekleyin veya daha az girin.`,
      meta: { q, f, toplam, maxYapilabilir },
    }
  }
  return { ok: true }
}

// ═══ YASAK 2: Duruş — İş Süresi Kontrolü ═══
// Toplam duruş dakikası toplam çalışma dakikasını aşamaz.
// Duruş var ama çalışma saatleri boşsa da engel — mantıksız kayıt.
export function canDurus(params: {
  toplamDurusDk: number
  toplamCalismaDk: number
  hasDurus: boolean
}): ValidationResult {
  const { toplamDurusDk, toplamCalismaDk, hasDurus } = params
  if (!hasDurus) return { ok: true }

  if (toplamCalismaDk <= 0) {
    return {
      ok: false,
      reason:
        'Duruş girmek için önce operatör çalışma saatleri (başlangıç/bitiş) girilmeli. ' +
        'Çalışma olmadan duruş kaydı olamaz.',
      meta: { toplamDurusDk, toplamCalismaDk: 0 },
    }
  }
  if (toplamDurusDk > toplamCalismaDk) {
    return {
      ok: false,
      reason:
        `Duruş süresi (${toplamDurusDk} dk) çalışma süresini (${toplamCalismaDk} dk) aşamaz.`,
      meta: { toplamDurusDk, toplamCalismaDk },
    }
  }
  return { ok: true }
}

// ═══ YASAK 3: İE Silme — Bağlı Kayıt Kontrolü ═══
// Üretim logu, stok hareketi veya fire logu varsa İE silinemez.
// Silme yerine "iptal" seçeneği yönlendirilir.
export function canDeleteWO(params: {
  woId: string
  logs: Array<{ woId: string; qty?: number; fire?: number }>
  stokHareketler?: Array<{ woId?: string | null; wo_id?: string | null }>
  fireLogs?: Array<{ woId?: string | null; wo_id?: string | null }>
}): ValidationResult {
  const { woId, logs, stokHareketler = [], fireLogs = [] } = params

  const myLogs = logs.filter((l) => l.woId === woId)
  if (myLogs.length > 0) {
    const toplamUretim = myLogs.reduce((a, l) => a + (l.qty || 0), 0)
    const toplamFire = myLogs.reduce((a, l) => a + (l.fire || 0), 0)
    return {
      ok: false,
      reason:
        `İE silinemez — ${myLogs.length} üretim kaydı var ` +
        `(${toplamUretim} sağlam + ${toplamFire} fire). ` +
        `Silme yerine "İptal Et" kullanın.`,
      meta: { logSayisi: myLogs.length, toplamUretim, toplamFire },
    }
  }

  const myStok = stokHareketler.filter((h) => {
    const wid = (h as any).woId ?? (h as any).wo_id
    return wid === woId
  })
  if (myStok.length > 0) {
    return {
      ok: false,
      reason:
        `İE silinemez — ${myStok.length} stok hareketi bağlı. ` +
        `Silme yerine "İptal Et" kullanın.`,
      meta: { stokHareketSayisi: myStok.length },
    }
  }

  const myFire = fireLogs.filter((fr) => {
    const wid = (fr as any).woId ?? (fr as any).wo_id
    return wid === woId
  })
  if (myFire.length > 0) {
    return {
      ok: false,
      reason:
        `İE silinemez — ${myFire.length} fire kaydı bağlı. ` +
        `Silme yerine "İptal Et" kullanın.`,
      meta: { fireLogSayisi: myFire.length },
    }
  }

  return { ok: true }
}
