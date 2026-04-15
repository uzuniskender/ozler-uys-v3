// ═══ RBAC YETKİ SİSTEMİ ═══
// Roller: admin her zaman ✏️, operator sadece OperatorPanel, guest salt okunur
// Bu dosya sadece admin dışı 3 rolün hangi aksiyonlarda ✏️ olduğunu tanımlar

export type AdminRole = 'admin' | 'uretim_sor' | 'planlama' | 'depocu'
export type UserRole = AdminRole | 'guest' | 'operator'

// Hangi roller bu aksiyonu yapabilir? (admin her zaman yapabilir, listeye eklenmez)
const E: Record<string, AdminRole[]> = {
  // ═══ Dashboard ═══
  // Tüm roller sadece görüntüler — admin dashboard'u düzenleyebilir
  // (Dashboard'da düzenleme aksiyonu şu an yok)

  // ═══ Siparişler ═══
  orders_add:    ['planlama'],
  orders_edit:   ['planlama'],
  orders_delete: [],              // sadece admin
  orders_detail: ['planlama'],
  orders_mrp:    ['planlama'],

  // ═══ İş Emirleri ═══
  wo_add:        ['uretim_sor', 'planlama'],
  wo_edit:       ['uretim_sor', 'planlama'],
  wo_delete:     [],              // sadece admin
  wo_copy:       ['planlama'],
  wo_entry:      [],              // admin kayıt ekleme (OprEntryModal)
  wo_status:     [],              // durum değiştirme — sadece admin

  // ═══ Üretim Girişi ═══
  prod_entry:    ['uretim_sor', 'planlama'],
  prod_bulk:     [],              // toplu — sadece admin
  prod_fire:     ['uretim_sor', 'planlama'],
  prod_opr:      ['uretim_sor', 'planlama'],
  prod_durus:    ['uretim_sor', 'planlama'],

  // ═══ Kesim Planları ═══
  cutting_add:    ['planlama'],
  cutting_edit:   ['planlama'],
  cutting_delete: ['planlama'],
  cutting_artik:  ['planlama'],
  cutting_done:   ['planlama'],

  // ═══ MRP ═══
  mrp_calc:      ['planlama'],
  mrp_supply:    ['planlama'],
  mrp_template:  ['planlama'],

  // ═══ Reçeteler ═══
  recipe_add:    ['planlama'],
  recipe_edit:   ['planlama'],
  recipe_delete: ['planlama'],
  recipe_excel:  ['planlama'],

  // ═══ Ürün Ağaçları (BOM) ═══
  bom_add:       ['planlama'],
  bom_edit:      ['planlama'],
  bom_delete:    ['planlama'],
  bom_excel:     ['planlama'],

  // ═══ Malzemeler ═══
  mat_add:       ['planlama', 'depocu'],
  mat_edit:      ['planlama', 'depocu'],
  mat_delete:    ['planlama'],
  mat_excel:     ['planlama', 'depocu'],

  // ═══ Operasyonlar ═══
  op_add:        [],
  op_edit:       [],
  op_delete:     [],

  // ═══ İstasyonlar ═══
  st_add:        [],
  st_edit:       [],
  st_delete:     [],

  // ═══ Operatörler ═══
  opr_add:       ['uretim_sor', 'planlama', 'depocu'],
  opr_edit:      ['uretim_sor', 'planlama', 'depocu'],
  opr_delete:    [],
  opr_izin:      ['uretim_sor', 'planlama', 'depocu'],
  opr_mesaj:     ['uretim_sor', 'planlama', 'depocu'],

  // ═══ Depo / Stok ═══
  stok_giris:    ['planlama', 'depocu'],
  stok_cikis:    ['planlama', 'depocu'],
  stok_sayim:    ['planlama', 'depocu'],
  stok_onarim:   ['planlama', 'depocu'],
  stok_hareket:  ['planlama', 'depocu'],

  // ═══ Tedarik ═══
  ted_add:       ['planlama', 'depocu'],
  ted_edit:      ['planlama', 'depocu'],
  ted_delete:    ['planlama', 'depocu'],
  ted_geldi:     ['planlama', 'depocu'],

  // ═══ Tedarikçiler ═══
  tedci_add:     ['planlama'],
  tedci_edit:    ['planlama'],
  tedci_delete:  ['planlama'],

  // ═══ Müşteriler ═══
  must_add:      ['planlama'],
  must_edit:     ['planlama'],
  must_delete:   ['planlama'],

  // ═══ Sevkiyat ═══
  sevk_add:      ['planlama', 'depocu'],
  sevk_edit:     ['planlama', 'depocu'],
  sevk_delete:   ['planlama', 'depocu'],

  // ═══ Duruş Kodları ═══
  durus_add:     [],
  durus_edit:    [],
  durus_delete:  [],

  // ═══ Raporlar ═══
  rapor_view:    ['uretim_sor', 'planlama'],
  rapor_excel:   ['uretim_sor', 'planlama', 'depocu'],

  // ═══ Checklist ═══
  check_add:     [],
  check_edit:    [],
  check_delete:  [],

  // ═══ Veri Yönetimi ═══
  data_backup:   ['planlama'],
  data_import:   [],
  data_export:   [],
  data_test:     ['planlama'],
  data_syscheck: [],
  data_reset:    [],
  data_pass:     [],
}

/**
 * Kullanıcının belirli bir aksiyonu yapıp yapamayacağını kontrol eder
 * @param role Kullanıcı rolü
 * @param action Aksiyon kodu (örn: 'orders_add')
 * @returns true = yapabilir (✏️), false = sadece görüntüleyebilir (👁)
 */
export function can(role: UserRole, action: string): boolean {
  if (role === 'admin') return true
  if (role === 'guest' || role === 'operator') return false
  const allowed = E[action]
  if (!allowed) return false // tanımsız aksiyon → sadece admin
  return allowed.includes(role as AdminRole)
}

/**
 * Sayfa erişim kontrolü — tüm roller tüm sayfaları görebilir
 * Veri Yönetimi hariç: sadece admin + planlama (kısıtlı)
 */
export function canViewPage(role: UserRole, page: string): boolean {
  if (role === 'admin') return true
  if (role === 'guest' || role === 'operator') return false
  // Tüm admin roller tüm sayfaları görebilir
  return true
}
