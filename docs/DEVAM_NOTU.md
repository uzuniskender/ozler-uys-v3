# Yeni Oturum Devam Notu

**Tarih:** 27 Nisan 2026 (akşam — v16.0.0 Faz 1.1a sonrası)
**Son canlı sürüm:** v15.52a.1 (kod) + v16.0.0 Faz 1.1a (sadece DB altyapı)

---

## Hemen Yap (Yeni Oturumda İlk Adım)

```
UYS v3 devamı. docs/DEVAM_NOTU.md + docs/UYS_v3_Bilgi_Bankasi.md (özellikle §18 ailesi 5 kalıcı kural + §19 + §20) + docs/is_emri/00_BACKLOG_Master.md + docs/is_emri/12_GuvenlikRefactor.md (revize edildi 27 Nis akşam) oku.
Son durum: v15.52a.1 canlıda, İş Emri #1 + #3 KAPANDI. v16.0.0 Faz 1.1a (auth altyapı) DB'de hazır ama hiçbir RLS değişmedi.
İş Emri #12 (Güvenlik Refactoru) kapsamı revize edildi: Google OAuth DISABLED keşfedildi, Faz 1+2 birleştirildi (4 faz toplam).
Sıradaki adaylar:
  - Topbar KESİM uyarısı Orders.tsx'te (~30 dk, yarım kalan UX iş)
  - İş Emri #2 Yedekleme (production-blocker, büyük)
  - İş Emri #12 Faz 1 (büyük, mimari — 1 hafta)
  - UYS dışı işler (Mavvo, Libya, kalite, vb.)
Buket önceliği belirler.
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

## Bu Akşam Yapılan İşler (27 Nis akşam)

1. **İş Emri #12 başlangıç denemesi** — Yaklaşım A (Supabase Auth) ile Faz 1.1a yapıldı:
   - Migration: `sql/20260427_v16_0_0_faz1_1a_auth_alti.sql` (canlıda)
   - `uys_kullanicilar.auth_user_id` kolonu + index + `current_user_role()` helper
   - **Saha etki sıfır** (RLS henüz değişmedi)

2. **Sürpriz keşif (RLS audit denemesinde):** Google OAuth Supabase'de DISABLED. `auth.users` tablosu boş — kimse Google ile giriş yapmamış. Bu, İş Emri #12 spec'inin Faz 1'i (Admin Google OAuth pilot) **geçersiz** kılıyor.

3. **İş Emri #12 spec revize edildi:**
   - Eski Faz 1 (Admin Google OAuth) ve Faz 2 (AdminRole'ler) → birleştirildi
   - Yeni Faz 1 = "Tüm AdminRole'leri Supabase Auth'a sıfırdan migrate" (~5 gün)
   - Faz sayısı 5 → 4'e düştü, toplam süre değişmedi (~11 gün full-time, 3-4 hafta yayılmış)

4. **Karar:** Faz 1'in geri kalanı (1.2+) **şu an yapılmıyor**. Buket'in günlük iş yükü düşünüldüğünde 1-2 haftalık mimari refactor için doğru zamanlama değil. Backlog'da bekliyor.

---

## Sıradaki Adaylar

**Hızlı kazanım (~30 dk):**
- **Topbar KESİM uyarısı** — v15.50a.6'da Topbar düzeltildi ama Orders.tsx'teki uyarı eklenmemişti. Küçük UX iş, hemen biter.

**Production-blocker (büyük, ~1 hafta):**
- **İş Emri #2 Yedekleme** — `/backup` route, JSON snapshot/restore. `pt_yedekler` tablosu Tip D, önceden tip ataması yapıldı (§18.2 tablosu).
- **İş Emri #5 Sevkiyat Formu** — Mevcut sevk listesi var, oluşturma formu yok.

**Mimari büyük iş (1-2 hafta):**
- **İş Emri #12 Faz 1** — Tüm AdminRole'leri Supabase Auth'a migrate. Pre-requisite altyapı zaten kuruldu (Faz 1.1a). Buket vakit ayırınca yapılır.

**Küçük temizlikler:**
- **Plain `sifre` kolonu DROP** — v15.52a lazy migration tamamlanınca (1-2 hafta sonra). Kontrol: `SELECT count(*) FROM uys_operators WHERE sifre IS NOT NULL AND aktif IS NOT FALSE` → 0 olmalı, sonra `ALTER TABLE public.uys_operators DROP COLUMN sifre;`

**UYS dışı işler:** Mavvo BOM-to-recipe, Libya order documentation, TL-ISG-017, Compaco 8D, ERP demo karşılaştırması, vb.

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
