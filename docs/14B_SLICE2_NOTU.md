# İş Emri #14 — Faz B (State Machine) — Slice 2 (v16.33)

**Tarih:** 1 Mayıs 2026 akşam
**Statü:** 🟢 **DB tarafı + TS altyapı hazır, sahaya iniş bekleniyor**
**Önceki:** Faz B Slice 1 ✓ (DB enum + state kolonu + auto-state trigger'ları, production'da canlı)

---

## Faz B Slice 1 (DB) — TAMAMLANDI

| Adım | Durum |
|---|---|
| `order_state` ENUM (10 değer) | ✓ Production |
| `uys_orders.state` kolonu (DEFAULT 'yeni') + index | ✓ Production |
| Faz A smart invalidation güncellendi (state IRRELEVANT) | ✓ Production |
| `compute_order_state(order_id)` fonksiyonu (8 senaryo PASS) | ✓ Production |
| `refresh_order_state(order_id)` (sonsuz döngü korumalı) | ✓ Production |
| 3 auto-state trigger (work_orders, tedarikler, orders/durum,sevk_durum,recete_id) | ✓ Production |
| Veri migration: 27 sipariş → 18 kapali + 6 uretilebilir + 2 uretiliyor + 1 tamamlandi | ✓ |

DB tarafı **otomatik** state güncellemesi yapıyor. WO/tedarik/orders.durum değişiminde `orders.state` anında doğru değere geçiyor. Sonsuz döngü yok (state kolonu UPDATE'te trigger atesemez, `UPDATE OF` syntax'ı sadece izlenen kolonları takip ediyor).

---

## Faz B Slice 2 (TS altyapı) — Bu patch

### Hedef

`Order.state` field'ını TS tarafına getir, UI rozet helper'larını tek noktaya topla. Slice 3 (UI refactor) bunu kullanacak.

### Değişen dosyalar (3)

| Dosya | Tip | İçerik |
|---|---|---|
| `src/types/index.ts` | patch | `OrderState` union type + `Order.state` field |
| `src/store/index.ts` | patch | `M.order` mapper'a `state` okuma eklendi |
| `src/features/order/stateMachine.ts` | **yeni** | Transition tablosu + canTransition + UI metadata helper'ları |

### Backward compatibility

- `Order.state` zorunlu field — tüm caller'lar `Order` tipi kullanıyorsa typecheck zorunlu kıldı
- DB'den gelen kayıtlarda `state` her zaman dolu (DEFAULT 'yeni'), null kontrolü gerekmez
- Caller'lar henüz `state`'i kullanmıyor — eski `durum`, `sevkDurum`, `mrpDurum` aynı şekilde mevcut
- Slice 3'te aşamalı geçiş

### stateMachine.ts içeriği

**Transition tablosu** (validation amaçlı, gerçek geçişi DB yapıyor):

```
yeni             → recete_yok | plan_bekliyor | uretilebilir | iptal
recete_yok       → plan_bekliyor | uretilebilir | yeni | iptal
plan_bekliyor    → tedarik_bekliyor | uretilebilir | iptal
tedarik_bekliyor → uretilebilir | plan_bekliyor | iptal
uretilebilir     → uretiliyor | plan_bekliyor | tedarik_bekliyor | iptal
uretiliyor       → tamamlandi | iptal
tamamlandi       → kapanma_bekliyor | kapali | iptal
kapanma_bekliyor → kapali | iptal
kapali           → (terminal)
iptal            → (terminal)
```

**Helper'lar:**
- `canTransition(from, to)` — geçiş izni
- `isTerminal(state)`, `isActive(state)` — sahanın "aktif siparişler" filtresi için
- `stateLabel(state)` — Türkçe etiket
- `stateColor(state)` — Tailwind renk paleti (bg/text/border)
- `stateBadgeClass(state)` — tek-string rozet sınıfı
- `ALL_STATES`, `ACTIVE_STATES`, `TERMINAL_STATES` — sabit listeler

### Build doğrulaması

```
npm run build                    ✓ Exit 0 (4.77s)
  ├─ audit-schema.cjs            ✓
  ├─ audit-columns.cjs           ✓
  ├─ tsc --noEmit                ✓
  └─ vite build                  ✓
```

Pre-existing 2 warning (Slice 2 değil): autoChain dynamic import, chunk size > 1MB.

---

## Mimari karar — TS state machine vs DB state machine

İki state machine var:
- **DB:** `compute_order_state()` — gerçek kaynak. Her DB değişiminde otomatik koşar.
- **TS:** `canTransition()` — validation ve UI metadata. Tek başına state değiştirmez.

**Caller kuralı:** ASLA `orders.state` doğrudan UPDATE etmeyin. DB trigger zincirini atlayan manuel state yazımı tutarsızlık riski oluşturur. Eğer state'i etkileyen şey değişiyorsa (durum, sevk_durum, recete_id, work_orders, tedarikler), **o değişikliği yap**, state otomatik güncellenir.

`canTransition()` fonksiyonu sadece validation amaçlı — örn. test runner'da invariant kontrolü, sağlık raporunda anomali tespiti.

---

## Slice 3 ön hazırlığı (sonraki adım)

Slice 3'te **UI rozet refactor** yapılacak (1 gün):

1. `Orders.tsx` rozet sütunu → `stateBadgeClass(order.state)` + `stateLabel(order.state)`
2. Detail panel başlığı → state göster
3. `Topbar.tsx` "Plan Bekleyen" rozeti → `state === 'plan_bekliyor'` filtresi
4. Filtreleme dropdown'ı → `ALL_STATES` veya `ACTIVE_STATES`
5. `getEffectiveStatus` (statusUtils.ts) **dokunulmuyor** — o İE seviyesi (work_order durumu), bu sipariş seviyesi
6. Eski `durum`, `sevkDurum`, `mrpDurum` kolonları **kalır** (geçiş süresi 1-2 hafta gözlem)

Mevcut sayfalardaki `getEffectiveStatus` çağrıları çoğunlukla İE rozetleri için, sipariş için değil — Slice 3 kapsamı dar.

---

## Production deploy

```powershell
cd C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3
git pull
Expand-Archive "$env:USERPROFILE\Downloads\uys_v16_33_slice2.zip" -DestinationPath . -Force
git status
git add -A
git commit -m "v16.33 - IE #14 Faz B Slice 2: state field + stateMachine.ts (TS altyapi)"
git tag v16.33
git push --follow-tags
```

DB tarafı zaten Slice 1'de uygulandı; bu commit sadece TS altyapı.

---

*Slice 2 build PASS. Slice 3 UI refactor sırada (1 gün).*
