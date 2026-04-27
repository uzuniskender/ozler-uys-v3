# Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026 (v15.52a.1 sonrası — Operatör güvenlik patch'i + audit hotfix)
**Son canlı sürüm:** v15.52a.1

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18 ailesi 5 kalıcı kural + §19 MRP sözleşmesi + §20 tehdit modeli) + docs/is_emri/00_BACKLOG_Master.md oku.
Son iş: v15.52a + v15.52a.1 (Operatör güvenlik: sicil hash lazy migration + RBAC operator actions + SQL public. prefix hotfix).
İş Emri #1 (Operatör Paneli) KAPANDI — sahada zaten %95 yapılmıştı, eksik güvenlik gap'leri kapatıldı.
Sıradaki: İş Emri #2 (Yedekleme) veya İş Emri #12 (Güvenlik Refactoru — RLS) veya küçük UX patch'leri.
```

---

## v15.52a + v15.52a.1 Özeti — Operatör Güvenlik

**Sürpriz keşif #6 (en büyük):** İş Emri #1 spec'i 246 satır, 5 faz tasarlandı — ama gerçekte sahada **zaten %95 yapılmış**. `OperatorPanel.tsx` 1335 satır, 4 component (login + ana panel + entry modal + mesaj + izin formu), eski monolit operator.html'in 811 satırlık içeriğinin tamamı + bonus özellikler (izin talep formu) React'e port edilmiş. Login.tsx'te bölüm/operatör/şifre 3-adım dropdown akışı, App.tsx'te `/operator` route + geri-tuşu engelli `OperatorRoutes`, useAuth'ta `operatorLogin(oprId, oprAd)` sessionStorage ile kurulu, 5 yazma tablosu (`uys_logs`, `uys_fire_logs`, `uys_active_work`, `uys_operator_notes`, `uys_stok_hareketler`) DB'de mevcut + RLS aktif.

**Asıl boşluk: 3 güvenlik gap'i.** v15.52a bunlardan 2'sini kapattı (RLS hariç):

### v15.52a'da Kapatılan 2 Eksik

1. **Sicil hash (lazy migration)** — `uys_operators.sifre` plain text saklanıyordu. Yeni `sicil_hash` kolonu + `src/lib/sicilHash.ts` (cyrb53 helper, format `cyrb53:HEX`). Login.tsx ilk girişte plain karşılaştırma + arka planda hash + `sifre=null`. 1-2 hafta sonra (tüm aktif operatörler login olduktan sonra) `sifre` kolonu ayrı patch'le DROP edilir.

2. **RBAC operator action listesi** — `permissions.ts`'te `OPERATOR_ACTIONS` set (9 action: `op_view_workorders`, `op_log_production`, `op_log_fire`, `op_log_durus`, `op_start_work`, `op_stop_work`, `op_send_message`, `op_view_stok`, `op_request_izin`). `can()` operator için artık bu set'e bakıyor. Mevcut OperatorPanel `can()` çağırmıyor (sadece `isOperator` flag) — bu altyapı ileride yetki kontrolü eklemek isteyince hazır.

### v15.52a.1 Hotfix — SQL public. Prefix

Push sırasında GitHub Actions audit-columns FAIL: "Kolon yok: 'sicil_hash' — Login.tsx [update]". Sebep: `audit-columns.cjs:164` regex'i `ALTER TABLE public.xxx` formatı bekliyor, bizim migration `public.` öneki olmadan yazılmıştı. Tek karakter düzeltmesi:

```sql
-- ÖNCE: ALTER TABLE uys_operators ADD COLUMN ...
-- SONRA: ALTER TABLE public.uys_operators ADD COLUMN ...
```

`IF NOT EXISTS` idempotent → DB'de zaten kolon var, tekrar çalıştırma sorun yaratmaz. **Yeni operasyonel kural: §18.5** (Bilgi Bankası).

### RLS Gap'i — İş Emri #12'ye Taşındı

3. RLS — 8 tablo `allow_all` policy'siyle, gerçek koruma yok. Çözümü mimari refactor gerektiriyor (1-2 hafta). Yeni İş Emri #12 olarak backlog'a alındı.

### Sayılar

3 dosya değişiklik + 2 yeni dosya · 1 yeni kolon (Tip — yeni KOLON, yeni TABLO değil; §18.2 karar matrisi gerektirmedi) · 0 rollback · §19 sözleşmesi etkilenmedi · §18 ailesi 1 yeni kural kazandı (§18.5).

---

## §18 Hijyen — v15.52a Cleanup

```powershell
Remove-Item "$env:USERPROFILE\Downloads\v15.52a_operator_guvenlik.zip" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\v15.52a-extract" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-claude-dump" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:TEMP\uys-audit-scripts.rar" -Force -ErrorAction SilentlyContinue
```

**§18.2 yeni tablo kontrolü:** Yeni tablo yok. Yeni kolon (`sicil_hash`) — Login.tsx'in kendi fetch'ettiği için store mapper güncellemesi gerekmez.

**§18.5 (YENİ) — SQL Migration `public.` Prefix:** Tüm `ALTER TABLE` ifadelerinde `public.` öneki ZORUNLU. `audit-columns.cjs` regex'i bunu bekliyor; eksikse silent reject + Actions FAIL. Detay: Bilgi Bankası §18.5.

---

## Sıradaki Adaylar

**Adim B — İş Emri #2 (Yedekleme Yönetimi):**
- `/backup` route — production-blocker
- `pt_yedekler` tablosu Tip D, önceden tip ataması yapıldı (§18.2 tablosu)
- Mevcut `apply.ps1`'de "Bilgi bankası backup" mantığı var, repo bilinci var

**Adim D — Topbar KESİM badge'i Siparişler sayfasında uyarı:**
- v15.50a.6'da Topbar düzeltildi ama Orders.tsx'teki uyarı eklenmemişti
- Küçük UX patch — 30 dakikalık iş

**Adim E — Plain `sifre` kolonu DROP (1-2 hafta sonra):**
- v15.52a lazy migration tamamlanınca (tüm aktif operatörler login olduktan sonra)
- Kontrol: `SELECT count(*) FROM uys_operators WHERE sifre IS NOT NULL AND aktif IS NOT FALSE` → 0 olmalı
- Sonra: `ALTER TABLE public.uys_operators DROP COLUMN sifre;`

**Adim F — İş Emri #12 (Güvenlik Refactoru — RLS):**
- 1-2 haftalık büyük iş
- `docs/is_emri/12_GuvenlikRefactor.md` (bu patch'le birlikte oluşturuldu)
- Faz 1'le başlanır (Admin'leri Supabase Auth'a tam taşıma — düşük risk pilot)

Buket önceliği belirler.

---

## Kontrol Listesi (Bir sonraki SQL/migration patch öncesi)

**§18.5 SQL Prefix Kuralı:**
- [ ] Tüm `ALTER TABLE` ifadelerinde `public.` öneki var mı?
- [ ] Yeni tablo `CREATE TABLE` ise yine `public.` öneki kullanıldı mı?
- [ ] DO blokları içindeki SELECT'lerde de `public.` tutarlılık için var mı?

**§18.2 Yeni Tablo Konvansiyonu:**
- [ ] Yeni tablo eklendiyse karar matrisi (A/B/C/D) yapıldı mı?
- [ ] STORE_WHITELIST + DATA_MGMT_WHITELIST güncel mi?
- [ ] Migration başlığında `BACKUP: evet/hayır` + `STORE: vX.Y.Z` yorumu var mı?

**§19 MRP filtre sözleşmesi:**
- [ ] Filter kararı `hesaplaMRP` net>0 sonucuna mı bakıyor?
- [ ] mrp_durum filter'da kullanılmıyor mu?

**RBAC:**
- [ ] Yeni butonlar `can(...)` ile sarılı mı?
- [ ] Operator action'sa `OPERATOR_ACTIONS` set'inde mi?

---

İyi geceler Buket. v15.52a.1 ile İş Emri #1 KAPANDI — operatör panel sahada güvenli + hash'li.
