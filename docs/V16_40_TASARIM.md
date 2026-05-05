# UYS v3 — v16.40 Multi-Device Single-Session Tasarımı

**Tarih:** 5 May 2026  
**Bağlam:** 2 May fiyaskosu sonrası (v16.36–v16.39 sahaya çıktı, v16.35'e revert), §32.9'a uygun yeniden yaklaşım  
**Önkoşul:** Playwright multi-context yeşil **olmadan** sahaya gönderilmez

---

## 1. Problem Tanımı

Aynı kullanıcı/operatör, 2+ cihazdan **eş zamanlı** login olabiliyor (race + senkronsuzluk). 
Sonuçları:

- Tek kullanıcının iki cihazdan eş zamanlı işlem yapması (stok hareketi, iş emri kapatma) → çakışan veriler
- Test Modu cross-device sorunu (Memory: localStorage cihaz bazlı, DB paylaşılır → sidebar AKTİF rozeti tutarsız)
- Audit trail bulanık (kim hangi cihazdan ne yaptı belirsiz)

## 2. Mevcut Durum Tespiti (5 May 2026 PROD)

| Tablo | Toplam | aktif_oturum_id dolu | Sorun |
|---|---|---|---|
| `uys_kullanicilar` | 2 | 1 | Kısmen çalışıyor |
| `uys_operators` | 89 | **0** | Operatör login akışı oturum alanlarına HİÇ yazmıyor |

**Asıl tetikleyici:** Şema 5 alanı tutuyor (`auth_user_id`, `aktif_oturum_id`, `aktif_oturum_cihaz`, `aktif_oturum_son`) — kullanıcı login akışında yazılıyor (yarım), operatör login akışında yazılmıyor (hiç). v16.36–v16.39'da bu yarım yamalak duruma single-session enforcement eklemek race + RLS hatalarına yol açmış olmalı.

## 3. Kabul Modeli — Single-Session

**Tanım:** Bir kullanıcı/operatör, aynı anda yalnızca BİR cihazdan aktif olabilir. Yeni login eskiyi otomatik invalidate eder.

**Akış:**

```
T1: Cihaz A → login → DB.aktif_oturum_id = uuid_A
T2: Cihaz A → çalışıyor, kendi oturum_id'sini "aktif" sayıyor
T3: Cihaz B → login (aynı kullanıcı) → DB.aktif_oturum_id = uuid_B (uuid_A override edildi)
T4: Cihaz A → polling/realtime ile DB'yi sorar → aktif_oturum_id ≠ uuid_A → otomatik logout
T5: Cihaz B → çalışmaya devam eder
T6: Cihaz B logout → DB.aktif_oturum_id = NULL
```

## 4. DB Tarafı — Mevcut + Yeni

### 4.1 Mevcut alanlar (TUR2 sonrası TEST + PROD'da var)

```sql
-- uys_kullanicilar VE uys_operators'ta:
auth_user_id        uuid                       -- auth.users.id'ye bağ
aktif_oturum_id     uuid                       -- gen_random_uuid() her login
aktif_oturum_cihaz  text                       -- "Chrome/Windows" gibi
aktif_oturum_son    timestamp with time zone   -- NOW() her login
```

### 4.2 Yeni 3 helper function (5 May test_v16_40_session_check_function migration ile TEST'e eklendi)

```sql
session_start(p_table text, p_user_id text, p_cihaz text) RETURNS uuid
session_is_valid(p_table text, p_user_id text, p_session_id uuid) RETURNS boolean
session_end(p_table text, p_user_id text) RETURNS void
```

Tek arayüz hem `uys_kullanicilar` hem `uys_operators` için. SECURITY DEFINER ile RLS'i bypass eder (auth katmanı kendi kontrolünü yapıyor zaten).

### 4.3 PROD'a uygulanacak (v16.40 migration)

TEST'te `test_v16_40_session_check_function` olarak kabul edildikten sonra PROD'a aynı 3 fonksiyon olarak push.

## 5. Frontend Tarafı — useAuth.ts Refactor

### 5.1 Login

```typescript
// Mevcut (yarım): kullanıcı için var, operatör için yok
// Yeni: tek API, hem kullanıcı hem operatör

async function login(table: 'uys_kullanicilar' | 'uys_operators', userId: string) {
  const cihaz = `${navigator.userAgent.split(') ')[0]})`; // Chrome/Windows etc.
  const { data: sessionId } = await supabase.rpc('session_start', {
    p_table: table,
    p_user_id: userId,
    p_cihaz: cihaz,
  });
  
  // Frontend state'e + localStorage'a kaydet
  setSessionId(sessionId);
  localStorage.setItem('uys_session_id', sessionId);
  localStorage.setItem('uys_user_id', userId);
  localStorage.setItem('uys_user_table', table);
  
  return sessionId;
}
```

### 5.2 Periyodik geçerlilik kontrolü (15sn polling + Realtime fallback)

```typescript
useEffect(() => {
  const checkValid = async () => {
    const sessionId = localStorage.getItem('uys_session_id');
    const userId = localStorage.getItem('uys_user_id');
    const table = localStorage.getItem('uys_user_table');
    if (!sessionId || !userId || !table) return;
    
    const { data: isValid } = await supabase.rpc('session_is_valid', {
      p_table: table, p_user_id: userId, p_session_id: sessionId,
    });
    
    if (!isValid) {
      await forceLogout('Başka cihazdan giriş yapıldı');
    }
  };
  
  // Her 15 saniyede bir kontrol
  const interval = setInterval(checkValid, 15000);
  
  // Realtime: aynı satırda UPDATE olduğunda da check tetiklensin
  const channel = supabase.channel(`session_watch_${userId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: table,
      filter: `id=eq.${userId}`,
    }, checkValid)
    .subscribe();
  
  return () => {
    clearInterval(interval);
    channel.unsubscribe();
  };
}, []);
```

### 5.3 Logout

```typescript
async function logout(reason?: string) {
  const userId = localStorage.getItem('uys_user_id');
  const table = localStorage.getItem('uys_user_table');
  if (userId && table) {
    await supabase.rpc('session_end', { p_table: table, p_user_id: userId });
  }
  localStorage.clear();
  if (reason) toast.warn(reason);
  navigate('/login');
}
```

## 6. SQL Davranış Testleri — TEST'te Doğrulandı (5 May 2026)

| Test | Sonuç | Beklenen | Geçti |
|---|---|---|---|
| T2: A login sonrası A-self check | true | true | ✅ |
| T4: B login sonrası A-self check | false | false | ✅ (A doğru şekilde invalidate edildi) |
| T5: B-self check | true | true | ✅ |
| Senaryo 2: 2 kullanıcı 2 cihaz bağımsız | OK | OK | ✅ |

DB-side mantık çalışıyor. Bu **gerekli ama yeterli değil** — çünkü 2 May fiyaskosu Realtime + RLS + browser race condition kombinasyonundan kaynaklanmıştı, salt SQL davranışı bunu yakalamaz.

## 7. Playwright Multi-Context Test Planı (zorunlu önkoşul)

### 7.1 factory.ts seed (TEST projesinde 5 May'da kuruldu)

```
auth.users:        4 (admin, kullanici, op1, op2)
auth.identities:   4
uys_kullanicilar:  2 (test-admin-01, test-kullanici-01)
uys_operators:     2 (test-op-01, test-op-02)
```

Şifreler:  
- `Admin_Test_2026!` (test_admin@v16.test)  
- `Kullanici_Test_2026!` (test_kullanici@v16.test)  
- `Operator_Test_2026!` (test_operator1/2@v16.test)  
- Operatör sicil kodları: `9001`, `9002` (sicil_hash sha256)

### 7.2 Yazılacak test senaryoları

**tests/e2e/multi-device.spec.ts:**

```
Senaryo 1 — single-session enforcement
  - Browser context A login (test-op-01)
  - Page A bir sayfada işlem yapsın
  - Browser context B login (test-op-01)
  - Page B'de login başarılı görmek
  - 30sn içinde Page A'da otomatik logout görmek (bildirim + redirect)

Senaryo 2 — bağımsız kullanıcılar
  - Context A: test-op-01 login
  - Context B: test-op-02 login
  - Her iki context da 1 dakika boyunca aktif kalmalı
  - Hiçbiri logout olmamalı

Senaryo 3 — Realtime channel
  - Context A login + abone
  - Context B login (eş zamanlı)
  - Context A'nın DB'den UPDATE notification aldığını doğrula
  - Context A'nın 5sn içinde logout olduğunu doğrula

Senaryo 4 — network kesintisi
  - Context A login
  - Page A offline yap (route abort)
  - Context B login
  - Page A online ol
  - Page A poll yap → invalid → logout

Senaryo 5 — cross-rol (kullanıcı vs operatör)
  - Context A: test-admin-01 (kullanıcı)
  - Context B: test-op-01 (operatör)
  - İkisi de aktif kalmalı (ayrı tablo, ayrı satır)

Senaryo 6 — Test Modu cross-device
  - Context A: admin login + Test Modu aç
  - Context B: admin login (A invalidate)
  - Context A logout sonrası: Test Modu DB satırı ne durumda?
```

### 7.3 Kabul kriterleri (sahaya çıkış için)

- [ ] 6/6 senaryo green
- [ ] Hiçbir flaky test (3 ardışık run hepsi yeşil)
- [ ] PROD-aynısı şema (TEST'e migration uygulandı, sayım birebir)
- [ ] Toast bildirimi UX'i doğal (ani logout açıklaması)
- [ ] Test verileri prod'u kirletmiyor (test_xxx@v16.test pattern'i)

## 8. Risk + Rollback

### Riskler
- **R1.** 89 operatör eş zamanlı vardiya değişiminde tüm session_start çağrıları → DB load
- **R2.** Realtime channel max bağlantı limiti (Supabase plan)
- **R3.** Polling 15sn aralık fazla agresif olabilir (89 op × 4req/dk = 356 req/dk)
- **R4.** Network kesintisinde poll fail olursa kullanıcı yanlış logout

### Mitigation
- M1. session_start UPDATE WHERE id=... → indexli, hızlı (mevcut PK indexi yeter)
- M2. Realtime opsiyonel (poll fallback yeter), ihtiyaç halinde kapat
- M3. Polling 30sn'ye çek (89 × 2 = 178 req/dk, kabul edilebilir)
- M4. Polling fail → exponential backoff (3 fail sonra logout uyarısı, 5 fail sonra zorla logout)

### Rollback planı
v16.40 sahaya çıktıktan sonra ilk 24 saat içinde `useAuth.ts` `session_is_valid` çağrısı disable edilebilir bir feature flag ile gelmeli:

```typescript
const SESSION_ENFORCEMENT_ENABLED = 
  import.meta.env.VITE_SESSION_ENFORCEMENT !== 'false';
```

Sorun çıkarsa GitHub Actions'ta `VITE_SESSION_ENFORCEMENT=false` set edip yeniden deploy → eski davranış (her cihazdan giriş serbest).

## 9. Yapılacak İş Sırası

1. ✅ TEST seed (4 auth + 2 kullanıcı + 2 operatör) — 5 May tamamlandı
2. ✅ TEST 3 helper function migration — 5 May tamamlandı
3. ✅ TEST DB-side davranış testi (3/3 green) — 5 May tamamlandı
4. ⏳ useAuth.ts refactor (frontend kodu)
5. ⏳ tests/e2e/multi-device.spec.ts yazımı (6 senaryo)
6. ⏳ Sandbox build + Playwright run (TEST projesine karşı)
7. ⏳ Tüm senaryolar 3 ardışık run yeşil olunca → PROD'a 3 helper function migration
8. ⏳ Frontend deploy (v16.40 tag)
9. ⏳ Saha test (1 admin + 1 operatör 2 cihazdan deneme)
10. ⏳ İlk 24 saat monitoring (Sentry/log + Buket'in geri bildirimi)

## 10. Şimdi Bekleyen

- Buket'in v16.40 patch zip akışına onayı (Memory #25 kuralı: build doğrulaması olmadan zip teslim etme)
- Bu doküman repo'ya `docs/V16_40_TASARIM.md` olarak girer
- useAuth.ts kodu burada yazılır (claude.ai sandbox'ta), zip ile teslim edilir
- Buket Claude Code oturumunda Playwright spec'lerini yazar veya delegete eder
