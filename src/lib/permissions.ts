// ═══ RBAC YETKİ SİSTEMİ ═══
export type AdminRole = 'admin' | 'uretim_sor' | 'planlama' | 'depocu'
export type UserRole = AdminRole | 'guest' | 'operator'

// Modül seviyesinde override — store loadAll'dan set edilir
let _overrides: Record<string, AdminRole[]> | null = null
export function setYetkiOverrides(o: Record<string, AdminRole[]> | null) { _overrides = o }
export function getYetkiOverrides() { return _overrides }

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
    { key: 'tedarik_auto', label: 'Otomatik tedarik (autoZincir)' },
    { key: 'auto_chain_run', label: 'autoZincir başlatma' },
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
    { key: 'acikbar_hurda', label: 'Açık bar hurdaya gönderme' },
    { key: 'acikbar_hurda_geri_al', label: 'Hurda barı geri alma (admin)' },
    { key: 'acikbar_havuz_geri_al', label: 'Tüketilmiş barı geri alma (admin)' },
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
    { key: 'sevk_print', label: 'İrsaliye yazdırma (PDF)' },
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
  { group: 'Problem Takip', actions: [
    { key: 'pt_add', label: 'Ekleme' },
    { key: 'pt_edit', label: 'Düzenleme' },
    { key: 'pt_delete', label: 'Silme' },
  ]},
  { group: 'Hammadde Tipleri', actions: [
    { key: 'hmt_add', label: 'Ekleme' },
    { key: 'hmt_edit', label: 'Düzenleme' },
    { key: 'hmt_delete', label: 'Silme' },
  ]},
  // v15.53 Adım 1 — Yedekleme yetki grubu
  { group: 'Yedekleme', actions: [
    { key: 'backup_view', label: 'Yedek listesi görme' },
    { key: 'backup_create', label: 'Manuel yedek alma' },
    { key: 'backup_restore', label: 'Geri yükleme (TEHLİKELİ)' },
    { key: 'backup_delete', label: 'Yedek silme' },
  ]},
]

export const DEFAULTS: Record<string, AdminRole[]> = {
  orders_add:['planlama'], orders_edit:['planlama'], orders_delete:[], orders_detail:['planlama'], orders_mrp:['planlama'],
  wo_add:['uretim_sor','planlama'], wo_edit:['uretim_sor','planlama'], wo_delete:[], wo_copy:['planlama'], wo_entry:[], wo_status:[],
  prod_entry:['uretim_sor','planlama'], prod_bulk:[], prod_fire:['uretim_sor','planlama'], prod_opr:['uretim_sor','planlama'], prod_durus:['uretim_sor','planlama'],
  cutting_add:['planlama'], cutting_edit:['planlama'], cutting_delete:['planlama'], cutting_artik:['planlama'], cutting_done:['planlama'],
  mrp_calc:['planlama'], mrp_supply:['planlama'], mrp_template:['planlama'],
  tedarik_auto:['planlama'],   // v15.47 — autoZincir tetiklediğinde otomatik tedarik
  auto_chain_run:['planlama'], // v15.47 — autoZincir başlatma yetkisi
  recipe_add:['planlama'], recipe_edit:['planlama'], recipe_delete:['planlama'], recipe_excel:['planlama'],
  bom_add:['planlama'], bom_edit:['planlama'], bom_delete:['planlama'], bom_excel:['planlama'],
  mat_add:['planlama','depocu'], mat_edit:['planlama','depocu'], mat_delete:['planlama'], mat_excel:['planlama','depocu'],
  op_add:[], op_edit:[], op_delete:[],
  st_add:[], st_edit:[], st_delete:[],
  opr_add:['uretim_sor','planlama','depocu'], opr_edit:['uretim_sor','planlama','depocu'], opr_delete:[], opr_izin:['uretim_sor','planlama','depocu'], opr_mesaj:['uretim_sor','planlama','depocu'],
  stok_giris:['planlama','depocu'], stok_cikis:['planlama','depocu'], stok_sayim:['planlama','depocu'], stok_onarim:['planlama','depocu'], stok_hareket:['planlama','depocu'],
  acikbar_hurda:['planlama','depocu'],
  acikbar_hurda_geri_al:[],   // v15.44 — admin only (geri alma yetkisi)
  acikbar_havuz_geri_al:[],   // v15.44 — admin only (geri alma yetkisi)
  ted_add:['planlama','depocu'], ted_edit:['planlama','depocu'], ted_delete:['planlama','depocu'], ted_geldi:['planlama','depocu'],
  tedci_add:['planlama'], tedci_edit:['planlama'], tedci_delete:['planlama'],
  must_add:['planlama'], must_edit:['planlama'], must_delete:['planlama'],
  sevk_add:['planlama','depocu'], sevk_edit:['planlama','depocu'], sevk_delete:['planlama','depocu'],
  sevk_print:['planlama','depocu'],   // v15.54 — irsaliye PDF yazdırma (Faz 2'de UI eklenir)
  durus_add:[], durus_edit:[], durus_delete:[],
  rapor_view:['uretim_sor','planlama'], rapor_excel:['uretim_sor','planlama','depocu'],
  check_add:[], check_edit:[], check_delete:[],
  data_backup:['planlama'], data_import:[], data_export:[], data_test:['planlama'], data_syscheck:[], data_reset:[], data_pass:[],
  pt_add:['uretim_sor','planlama','depocu'], pt_edit:['uretim_sor','planlama','depocu'], pt_delete:[],
  hmt_add:['uretim_sor'], hmt_edit:['uretim_sor'], hmt_delete:[],
  // v15.53 Adım 1 — Yedekleme yetkileri
  backup_view:['planlama'],     // planlama yedek listesini görebilir
  backup_create:['planlama'],   // planlama manuel yedek alabilir
  backup_restore:[],            // sadece admin (TEHLİKELİ — Faz 3'te kullanılacak)
  backup_delete:[],             // sadece admin
}

export const ROLE_LIST: { key: AdminRole; label: string }[] = [
  { key: 'uretim_sor', label: 'Üretim Sor.' },
  { key: 'planlama', label: 'Planlama' },
  { key: 'depocu', label: 'Depocu' },
]

// v15.52a — Operatör panel action listesi.
// Operatör admin değil; ayrı bir izin domeni. DEFAULTS yapısı (AdminRole[] tutuyor)
// operator için uygun değil — bu sebeple ayrı bir Set olarak tanımlandı.
// can() fonksiyonu role === 'operator' için bu set'e bakar.
//
// Mevcut OperatorPanel.tsx şu an `can()` çağırmıyor — sadece `isOperator` flag'iyle
// çalışıyor. Bu set ileride OperatorPanel içine yetki kontrolü eklemek için hazır
// (örn. üretim sorumlusu operator'a fire kaydı yetkisini kapatmak isterse).
export const OPERATOR_ACTIONS = new Set<string>([
  'op_view_workorders',     // bölümüne ait WO'ları görür
  'op_log_production',      // üretim kaydı (logs INSERT)
  'op_log_fire',            // fire kaydı (fireLogs INSERT)
  'op_log_durus',           // duruş kaydı
  'op_start_work',          // İşe Başla (activeWork INSERT)
  'op_stop_work',           // İşi Bitir (activeWork DELETE)
  'op_send_message',        // yöneticiye mesaj (operatorNotes INSERT)
  'op_view_stok',           // sadece kendi malzemeleri için stok görür
  'op_request_izin',        // izin talep (IzinTalepForm — bonus, OperatorPanel.tsx'te mevcut)
])

export function can(role: UserRole, action: string): boolean {
  if (role === 'admin') return true
  // v15.52a — Operatör için ayrı izin domeni
  if (role === 'operator') return OPERATOR_ACTIONS.has(action)
  if (role === 'guest') return false
  const map = _overrides && Object.keys(_overrides).length > 0 ? _overrides : DEFAULTS
  const allowed = map[action]
  if (!allowed) return false
  return allowed.includes(role as AdminRole)
}

export function canViewPage(role: UserRole, _page: string): boolean {
  if (role === 'admin') return true
  if (role === 'guest' || role === 'operator') return false
  return true
}
