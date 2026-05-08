# DEVAM_NOTU — UYS v3 Tek Takip Dosyası

**Repo:** uzuniskender/ozler-uys-v3
**PROD:** lmhcobrgrnvtprvmcito (Frankfurt)
**TEST:** cowgxwmhlogmswatbltz (Frankfurt)
**Versiyon:** v16.52 (8 Mayıs 2026)

---

## ✅ Bu Oturumda Tamamlananlar (8 Mayıs 2026)

### Reçete / BOM
- Sort butonları: Recipes, BomTrees, Materials (Kod/Ad/Mamul/Bileşen ↑↓)
- Density butonları: ━/═/≡ — `localStorage`'a kaydedilir, `src/index.css`'e `.density-X td` CSS eklendi
- Eksik operasyon filtresi + badge (⚙ 7 eksik op)
- Süre durumu: `every()` → tüm YM satırlarında süre olmalı (Eksik/Var/Yok)
- Alt reçeteden süre miras (`onMalkodChange` → kirno='1' kök satırdan cascade)
- DB cascade trigger: `trg_recete_sure_cascade` (TEST+PROD)
- `sureBirim` default → `'sn'`

### Audit Log Sistemi (v16.51)
- DB tablo `uys_audit_log` (TEST+PROD aktif, RLS açık)
- `src/lib/audit.ts` → `auditLog`, `auditWoDurum`, `auditUretimLog`, `auditStokHareket`, `auditSilme`
- `sql/migration_audit_log.sql` → `public.uys_audit_log` (audit-columns.cjs uyumlu)
- `scripts/audit-schema.cjs` → STORE+DATA_MGMT whitelist'e `uys_audit_log` eklendi
- Entegre: WorkOrders (durum), ProductionEntry (üretim), Orders (kapat/aç, sil), tedarikHelpers (geldi), useAuth (login/logout)

### WO Mantık
- Tamamlandı engeli: log olmadan `tamamlandi` **imkansız** (toast.error, return)
- `kismi_tamam` durumu: filtre + dropdown + toplu buton + renk
- `wDurum` hesabına `kismi_tamam` dahil edildi

### Sipariş / Orders
- Filtre default: Üretimde + Gecikmeli (`new Set(['active', 'late'])`)
- `state` alanına göre filtre (`state='tamamlandi'` → Tamamlandı kategorisine girer)

### Order State Trigger Zinciri
- `trg_mrp_state_refresh_order`: MRP hesabı → order state anında güncellenir
- `trg_stok_hareket_refresh_order`: Stok hareketi (wo_id'li) → order state güncellenir
- Tüm tetikleyiciler: WO durum, tedarik geldi, MRP hesabı, stok hareketi

### MRP
- PLY/levha WO'ları için "2b" bloğu: `hm` alanından ek HM hesabı (reçete dışı WO'lar)
- Çift sayım önleme: reçetesi olan WO'lar `hm`'den hesaplanmaz
- Plywood MRP fix: S26A_03151 + S26A_03150 test edildi

### Levha Kesim Planlayıcısı (v16.52)
- `src/features/production/levhaKesim.ts` → Guillotine Cut (2D bin-packing)
  - Best-Fit Decreasing + rotation + artık alan takibi
  - Tolerans: 4mm (testere kalınlığı)
- `CuttingPlans.tsx` → "🪵 Levha Planı" butonu + WO bazlı idempotency
- `cutting.ts` → `hammaddeTipi='LEVHA'` olan HM'ler `kesimPlanOlustur`'dan çıkarıldı
- Tip sütunu: 📏 Boy / ⬜ Yüzey / 🪵 Levha
- Test: ✅ olumlu

---

## 🔄 Aktif DB Trigger'lar (TEST+PROD)

| Trigger | Tablo | İşlev |
|---|---|---|
| `trg_recete_sure_cascade` | `uys_recipes` | Alt reçete → üst reçeteye süre cascade |
| `trg_mrp_state_refresh_order` | `uys_mrp_state_order` | MRP hesabı → order state güncelle |
| `trg_stok_hareket_refresh_order` | `uys_stok_hareketler` | Stok (wo_id) → order state güncelle |
| `trg_refresh_state_wo` | `uys_work_orders` | WO durum → order state güncelle |
| `trg_refresh_state_tedarik` | `uys_tedarikler` | Tedarik geldi → order state güncelle |
| `trg_malkod_cascade_update` | `uys_malzemeler` | Malkod değişince cascade |
| `trg_stok_hareket_dup_guard` | `uys_stok_hareketler` | Duplicate önleme |
| `trg_recipe_op_sync` | `uys_recipes` | Reçete UPDATE → açık WO senkron |

---

## ⏳ Sıradaki Görevler

### Küçük
- Audit log görüntüleme sayfası (kim ne zaman ne yaptı)
- WorkOrders "Durumları Güncelle" butonuna audit log
- Levha kesim artık → stok yönetimi (kesim sonrası kalan levha stoka)
- Levha kesim görselleştirme (hangi parça levhanın neresinde)

### Orta
- İstek #18: fire → sipariş dışı İE
- İstek #19: MRP stoktan ver

### Büyük
- Sevkiyat (#5)
- Excel (#7)

---

## 🔑 Kritik Kurallar (Yeni Claude'a)

- **Buket oturum kapatır** — Claude önerme
- **Supabase değişiklikleri MCP tools ile** — PowerShell SQL talimatı verme
- **Şifreler konuşmada gösterilmez**
- **TEST önce, PROD sonra (onay alarak)**
- **DEVAM_NOTU.md her oturum sonunda güncelle**
- **Sandbox build doğrulama** — zip/dosya teslim öncesi şart
- **Memory limit 30/30** — bu dosya context'tir

## Ortam

- Repo: `C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3`
- Node v22.22.1 portable
- GitHub Actions → GitHub Pages (otomatik deploy)
- Playwright: 18/18 green

## Rollback Referansı

```sql
-- audit log kaldır
DROP TABLE IF EXISTS uys_audit_log;

-- levha trigger kaldır
DROP TRIGGER IF EXISTS trg_mrp_state_refresh_order ON uys_mrp_state_order;
DROP TRIGGER IF EXISTS trg_stok_hareket_refresh_order ON uys_stok_hareketler;

-- recete cascade kaldır
DROP TRIGGER IF EXISTS trg_recete_sure_cascade ON uys_recipes;
```

---

## 📚 Geçmiş Büyük Dönüm Noktaları (Referans)

| Versiyon | Konu |
|---|---|
| v15.52a | Operatör güvenlik (sicil hash + RBAC) |
| v15.53 | Yedekleme sistemi |
| v15.81 | MRP `uretilen=0` hardcode fix |
| v15.90-96 | Madde 15 (rezerv, mamul tahsis, FIFO) |
| v16.0 | Supabase Auth migration |
| v16.31 | MRP cache (`uys_mrp_state_order`) |
| v16.45 | `trg_recipe_op_sync` |
| v16.47 | StokDupGuard |
| v16.51 | Audit log sistemi |
| v16.52 | 2D Levha kesim planlayıcısı |
