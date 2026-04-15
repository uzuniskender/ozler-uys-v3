// ═══ RBAC YETKİ SİSTEMİ ═══
export type AdminRole = 'admin' | 'uretim_sor' | 'planlama' | 'depocu'
export type UserRole = AdminRole | 'guest' | 'operator'

export const ACTION_GROUPS: { group: string; actions: { key: string; label: string }[] }[] = [
  { group: 'Siparişler', actions: [
    { key: 'orders_add', label: 'Sipariş ekleme' }, { key: 'orders_edit', label: 'Sipariş düzenleme' },
    { key: 'orders_delete', label: 'Sipariş silme' }, { key: 'orders_detail', label: 'Sipariş detay' },
    { key: 'orders_mrp', label: 'MRP çalıştırma' },
  ]},
  { group: 'İş Emirleri', actions: [
    { key: 'wo_add', label: 'İE oluşturma' }, { key: 'wo_edit', label: 'İE düzenleme' },
    { key: 'wo_delete', label: 'İE silme / iptal' }, { key: 'wo_copy', label: 'İE kopyalama' },
    { key: 'wo_entry', label: 'Üretim kaydı (admin)' }, { key: 'wo_status', label: 'İE durum değiştirme' },
  ]},
  { group: 'Üretim Girişi', actions: [
    { key: 'prod_entry', label: 'Üretim kaydı' }, { key: 'prod_bulk', label: 'Toplu üretim' },
    { key: 'prod_fire', label: 'Fire girişi' }, { key: 'prod_opr', label: 'Operatör/saat' },
    { key: 'prod_durus', label: 'Duruş girişi' },
  ]},
  { group: 'Kesim Planları', actions: [
    { key: 'cutting_add', label: 'Plan oluşturma' }, { key: 'cutting_edit', label: 'Plan düzenleme' },
    { key: 'cutting_delete', label: 'Plan silme' }, { key: 'cutting_artik', label: 'Artık yönetimi' },
    { key: 'cutting_done', label: 'Tamamlama' },
  ]},
  { group: 'MRP', actions: [
    { key: 'mrp_calc', label: 'MRP hesaplama' }, { key: 'mrp_supply', label: 'Tedarik oluşturma' },
    { key: 'mrp_template', label: 'Şablon indirme' },
  ]},
  { group: 'Reçeteler', actions: [
    { key: 'recipe_add', label: 'Ekleme' }, { key: 'recipe_edit', label: 'Düzenleme' },
    { key: 'recipe_delete', label: 'Silme' }, { key: 'recipe_excel', label: 'Excel import/export' },
  ]},
  { group: 'Ürün Ağaçları', actions: [
    { key: 'bom_add', label: 'Ekleme' }, { key: 'bom_edit', label: 'Düzenleme' },
    { key: 'bom_delete', label: 'Silme' }, { key: 'bom_excel', label: 'Excel import/export' },
  ]},
  { group: 'Malzemeler', actions: [
    { key: 'mat_add', label: 'Ekleme' }, { key: 'mat_edit', label: 'Düzenleme' },
    { key: 'mat_delete', label: 'Silme' }, { key: 'mat_excel', label: 'Excel import/export' },
  ]},
  { group: 'Operasyonlar', actions: [
    { key: 'op_add', label: 'Ekleme' }, { key: 'op_edit', label: 'Düzenleme' }, { key: 'op_delete', label: 'Silme' },
  ]},
  { group: 'İstasyonlar', actions: [
    { key: 'st_add', label: 'Ekleme' }, { key: 'st_edit', label: 'Düzenleme' }, { key: 'st_delete', label: 'Silme' },
  ]},
  { group: 'Operatörler', actions: [
    { key: 'opr_add', label: 'Ekleme' }, { key: 'opr_edit', label: 'Düzenleme' }, { key: 'opr_delete', label: 'Silme' },
    { key: 'opr_izin', label: 'İzin yönetimi' }, { key: 'opr_mesaj', label: 'Mesajlaşma' },
  ]},
  { group: 'Depo / Stok', actions: [
    { key: 'stok_giris', label: 'Stok girişi' }, { key: 'stok_cikis', label: 'Stok çıkışı' },
    { key: 'stok_sayim', label: 'Sayım' }, { key: 'stok_onarim', label: 'Onarım' },
    { key: 'stok_hareket', label: 'Hareket görüntüleme' },
  ]},
  { group: 'Tedarik', actions: [
    { key: 'ted_add', label: 'Ekleme' }, { key: 'ted_edit', label: 'Düzenleme' },
    { key: 'ted_delete', label: 'Silme' }, { key: 'ted_geldi', label: 'Geldi işaretleme' },
  ]},
  { group: 'Tedarikçiler', actions: [
    { key: 'tedci_add', label: 'Ekleme' }, { key: 'tedci_edit', label: 'Düzenleme' }, { key: 'tedci_delete', label: 'Silme' },
  ]},
  { group: 'Müşteriler', actions: [
    { key: 'must_add', label: 'Ekleme' }, { key: 'must_edit', label: 'Düzenleme' }, { key: 'must_delete', label: 'Silme' },
  ]},
  { group: 'Sevkiyat', actions: [
    { key: 'sevk_add', label: 'Oluşturma' }, { key: 'sevk_edit', label: 'Düzenleme' }, { key: 'sevk_delete', label: 'Silme' },
  ]},
  { group: 'Duruş Kodları', actions: [
    { key: 'durus_add', label: 'Ekleme' }, { key: 'durus_edit', label: 'Düzenleme' }, { key: 'durus_delete', label: 'Silme' },
  ]},
  { group: 'Raporlar', actions: [
    { key: 'rapor_view', label: 'Görüntüleme' }, { key: 'rapor_excel', label: 'Excel export' },
  ]},
  { group: 'Checklist', actions: [
    { key: 'check_add', label: 'Ekleme' }, { key: 'check_edit', label: 'Düzenleme' }, { key: 'check_delete', label: 'Silme' },
  ]},
  { group: 'Veri Yönetimi', actions: [
    { key: 'data_backup', label: 'JSON yedek' }, { key: 'data_import', label: 'JSON import' },
    { key: 'data_export', label: 'Excel export' }, { key: 'data_test', label: 'Test modu' },
    { key: 'data_syscheck', label: 'Sistem testi' }, { key: 'data_reset', label: 'Sıfırlama' },
    { key: 'data_pass', label: 'Şifre / kullanıcı yönetimi' },
  ]},
]

export const DEFAULTS: Record<string, AdminRole[]> = {
  orders_add:['planlama'], orders_edit:['planlama'], orders_delete:[], orders_detail:['planlama'], orders_mrp:['planlama'],
  wo_add:['uretim_sor','planlama'], wo_edit:['uretim_sor','planlama'], wo_delete:[], wo_copy:['planlama'], wo_entry:[], wo_status:[],
  prod_entry:['uretim_sor','planlama'], prod_bulk:[], prod_fire:['uretim_sor','planlama'], prod_opr:['uretim_sor','planlama'], prod_durus:['uretim_sor','planlama'],
  cutting_add:['planlama'], cutting_edit:['planlama'], cutting_delete:['planlama'], cutting_artik:['planlama'], cutting_done:['planlama'],
  mrp_calc:['planlama'], mrp_supply:['planlama'], mrp_template:['planlama'],
  recipe_add:['planlama'], recipe_edit:['planlama'], recipe_delete:['planlama'], recipe_excel:['planlama'],
  bom_add:['planlama'], bom_edit:['planlama'], bom_delete:['planlama'], bom_excel:['planlama'],
  mat_add:['planlama','depocu'], mat_edit:['planlama','depocu'], mat_delete:['planlama'], mat_excel:['planlama','depocu'],
  op_add:[], op_edit:[], op_delete:[],
  st_add:[], st_edit:[], st_delete:[],
  opr_add:['uretim_sor','planlama','depocu'], opr_edit:['uretim_sor','planlama','depocu'], opr_delete:[], opr_izin:['uretim_sor','planlama','depocu'], opr_mesaj:['uretim_sor','planlama','depocu'],
  stok_giris:['planlama','depocu'], stok_cikis:['planlama','depocu'], stok_sayim:['planlama','depocu'], stok_onarim:['planlama','depocu'], stok_hareket:['planlama','depocu'],
  ted_add:['planlama','depocu'], ted_edit:['planlama','depocu'], ted_delete:['planlama','depocu'], ted_geldi:['planlama','depocu'],
  tedci_add:['planlama'], tedci_edit:['planlama'], tedci_delete:['planlama'],
  must_add:['planlama'], must_edit:['planlama'], must_delete:['planlama'],
  sevk_add:['planlama','depocu'], sevk_edit:['planlama','depocu'], sevk_delete:['planlama','depocu'],
  durus_add:[], durus_edit:[], durus_delete:[],
  rapor_view:['uretim_sor','planlama'], rapor_excel:['uretim_sor','planlama','depocu'],
  check_add:[], check_edit:[], check_delete:[],
  data_backup:['planlama'], data_import:[], data_export:[], data_test:['planlama'], data_syscheck:[], data_reset:[], data_pass:[],
}

export const ROLE_LIST: { key: AdminRole; label: string }[] = [
  { key: 'uretim_sor', label: 'Üretim Sor.' },
  { key: 'planlama', label: 'Planlama' },
  { key: 'depocu', label: 'Depocu' },
]

export function can(role: UserRole, action: string, overrides?: Record<string, AdminRole[]> | null): boolean {
  if (role === 'admin') return true
  if (role === 'guest' || role === 'operator') return false
  const map = overrides && Object.keys(overrides).length > 0 ? overrides : DEFAULTS
  const allowed = map[action]
  if (!allowed) return false
  return allowed.includes(role as AdminRole)
}

export function canViewPage(role: UserRole, _page: string): boolean {
  if (role === 'admin') return true
  if (role === 'guest' || role === 'operator') return false
  return true
}
