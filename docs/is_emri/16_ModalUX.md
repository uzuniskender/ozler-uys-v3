# İE — "Yeni İş Emri" Modali UX İyileştirmeleri (TAMAMLANDI v16.44)

**Tip:** UI/UX — frontend-only
**Sürüm:** v16.44
**Migration:** YOK
**Şema değişikliği:** YOK
**Etkilenen dosya:** `src/pages/Orders.tsx` (inline `OrderFormModal`)

## Açık sorular — kararlar

| # | Soru | Karar |
|---|---|---|
| 1 | + Ürün kalemi ekle adet default | **Boş** (tutarlılık) |
| 2 | Modal konum kalıcılığı | **Her zaman merkez** (basit, beklenmedik konum yok) |
| 3 | Kapsam | **Sadece "Yeni İş Emri" modalı** (v16.44 scope'u) |

## Madde 1 — Adet input boş başlasın

`OrderFormModal` içinde:

- `LocalKalem = Omit<OrderItem, 'adet'> & { adet: number | '' }` local type
- İlk kalem ve `addKalem()` ile yeni kalem `adet: ''` ile başlar (initial varsa orijinal değer korunur)
- `<input value={k.adet === '' ? '' : k.adet} placeholder="örn. 100">` — boş gösterim
- `onChange`: empty string → `''`, sayı → `number`
- `canSubmit = useMemo(...)` — kalem boş veya adet < 1 ise Oluştur disabled
- `save()` validation: `k.adet === ''` durumu ayrı uyarı ("kalem adedi boş — bir adet yazın")
- `toplamAdet` hesabı `typeof k.adet === 'number'` koruması ekledi

## Madde 2 — Draggable modal

Pointer Events API (mouse + touch tek kod):

- `modalRef`, `dragRef`, `pos: { x, y } | null` state
- `onPointerDown` header'da → `setPointerCapture` + baz pozisyon kaydı
- `onPointerMove` → delta hesabı + viewport `clamp` (modal viewport dışına atılamaz, header daima görünür)
- `onPointerUp` / `onPointerCancel` → cleanup + `releasePointerCapture`
- Modal style: `pos === null` ise `transform: translate(-50%,-50%)` ile merkez; `pos` dolu ise `left/top`
- Header: `cursor-grab active:cursor-grabbing select-none touch-none`
- `<h2 pointer-events-none>` — başlık tıklamayı header'a iletsin
- Kapat (×) butonu: `onPointerDown={e => e.stopPropagation()}` — drag tetiklemesin

## Test (Playwright)

Yeni: `tests/e2e/specs/05-modal-ux.spec.ts` (3 senaryo):

1. **modal-default-adet** — adet input boş, placeholder görünür, Oluştur disabled, "5" yazılınca value=5
2. **modal-drag** — header drag ile modal x+y değişir (≥50px sağa, ≥20px aşağı)
3. **modal-drag-input-not-affected** — body input üzerinde drag → modal kaymıyor (sadece header sürüklenir)

## Build / Risk

- Sandbox build PASS (3.16s)
- TS hata yok
- Saha etkisi: SADECE bu modal — diğer modallar (Materials, Recipes, vb.) etkilenmez
- Backend dokunulmadı, migration yok
- Rollback: tek commit revert
