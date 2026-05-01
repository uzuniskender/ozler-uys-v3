# İş Emri #14 — Faz B (State Machine) — Slice 3 (v16.34)

**Tarih:** 1 Mayıs 2026 akşam
**Statü:** 🟢 **Sandbox build PASS, sahaya iniş hazır**
**Önceki:** Faz B Slice 1 (DB) + Slice 2 (TS altyapı) ✓ canlıda

---

## Slice 3 ne yapar

UI rozet refactor — `order.state` kolonu artık görünür hale geliyor. Saha kullanıcısı her sipariş için **otomatik hesaplanan state**'i rozet olarak görüyor.

**Minimal kapsam** kararı: eski `mrpDurum`, `sevkDurum`, `durum` rozetleri **silinmedi** — geçiş döneminde paralel çalışıyor. Saha kullanıcısı her iki bilgiyi de görsün, state'in yeni rozeti güvenilince eskiler kaldırılır (1-2 hafta gözlem).

### Değişen dosyalar (2)

| Dosya | Tip | Değişiklik |
|---|---|---|
| `src/components/layout/Sidebar.tsx` | patch | `orders` rozet count'u `o.durum !== 'kapalı'` → `isOrderActive(o.state)` (terminal'leri içermez, daha doğru) |
| `src/pages/Orders.tsx` | patch | (1) thead'e "Durum" sütunu (2) tbody'de state rozeti (3) detail panel başlığında state rozeti (4) stateMachine import |

**Build:** `npm run build` ✓ Exit 0 (2.73s, tsc + vite + audit hepsi PASS).

---

## Saha kullanıcısı ne görecek

### Sipariş listesi (Orders.tsx)

Mevcut sütunlar (Sipariş No, Müşteri, Ürün, Adet, Termin, İlerleme, İE, Kesim, MRP, Sevk) **+ yeni "Durum" sütunu**.

Durum sütunundaki state rozeti renk paleti:

| State | Renk | Anlam |
|---|---|---|
| Yeni | gri | Yeni eklenmiş |
| Reçete Yok | turuncu | Reçete bulunamadı |
| Plan Bekliyor | kehribar | Hammadde eksik, plan yapılamadı |
| Tedarik Bekliyor | sarı | Tedarik açıldı, gelişi bekleniyor |
| Üretilebilir | mavi | Hammadde tam, üretime hazır |
| Üretiliyor | indigo | En az 1 İE aktif |
| Tamamlandı | yeşil | Tüm İE done, sevk açılmamış |
| Kapanma Bekliyor | turkuaz | Kısmi sevk yapılmış |
| Kapalı | zinc (koyu gri) | Tamamen sevk edilmiş |
| İptal | kırmızı | İptal edilmiş |

### Detail panel başlığı

Sipariş No yanında state rozeti görünür: `OZD-26-001 [Üretiliyor] · Müşteri Adı · 2026-05-01`

### Sidebar count

"Siparişler" menü öğesinin yanındaki sayı artık `state ∈ {kapali, iptal}` olanları **dahil etmiyor**. Eski `o.durum !== 'kapalı'` kontrolü iptal edilen siparişleri sayıyordu (yanlış); şimdi doğru.

---

## Dokunulmayan yerler ve gerekçeleri

| Konum | Sebep |
|---|---|
| Filter dropdown (active/late/closed) | Eski `o.durum === 'kapalı'` kontrolü hâlâ çalışıyor (kapatma butonu durum'u yazıyor). Kullanıcı tanıdık deneyim. Slice 4+'da gözlem sonrası geçirilebilir. |
| Mevcut MRP/Sevk rozetleri | Paralel kalıyor, kullanıcı her iki bilgiyi de görsün. Eskiler 1-2 hafta sonra kaldırılır. |
| `WorkOrders.tsx` | İE durumları, sipariş state'i değil. Faz B kapsamı dışı. |
| `Materials.tsx`, `Dashboard.tsx`, `BomTrees.tsx` | `wo.durum` okuyor (İE), dokunulmadı. |
| `getEffectiveStatus` (statusUtils.ts) | İE seviyesi rozet, sipariş state'i değil. |
| Orders.tsx kapatma butonu (🔒) | DB'ye `durum='kapalı'` yazıyor, trigger zinciri devreye giriyor (state otomatik refresh). Davranış değişmedi. |

---

## Backward compatibility

- Caller'lar hâlâ `durum`, `mrpDurum`, `sevkDurum` kolonlarını okuyabilir/yazabilir
- `state` kolonu **sadece okunur** olarak kullanılıyor (UI'da rozet, Sidebar count)
- DB trigger'ları `state`'i otomatik günceller, manuel UPDATE yok

---

## Production deploy

```powershell
cd C:\Users\iskender.uzun\Documents\GitHub\ozler-uys-v3
git pull
Expand-Archive "$env:USERPROFILE\Downloads\uys_v16_34_slice3.zip" -DestinationPath . -Force
git status
git add -A
git commit -m "v16.34 - IE #14 Faz B Slice 3: UI rozet refactor (state sütunu + detail panel + sidebar count)"
git tag v16.34
git push --follow-tags
```

DB tarafında değişiklik yok (Slice 1'de uygulandı). GitHub Actions otomatik deploy.

---

## Faz B Sonuç (Slice 1+2+3)

| Katman | Durum |
|---|---|
| **DB:** order_state ENUM + state kolonu + auto-state trigger'ları | ✓ Production canlı |
| **TS:** OrderState type + Order.state field + stateMachine.ts | ✓ Production (v16.33) |
| **UI:** Orders rozet sütunu + detail panel + sidebar count | ✓ Bu patch (v16.34) |

**Sonuç:** Mimari Refactor #14 → Faz A (mrp_state cache) + Faz B (state machine) tamamlandı. 30 Nisan akşam Buket'in mimari sorusunun cevabı **sahada canlı**:

- Hesap tutarsızlığı çözüldü (mrp_state cache aynı kaynak)
- State tutarsızlığı çözüldü (compute_order_state tek kaynak)
- 17 sentinel'in bir kısmı gereksizleşti (sağlık raporu cache + state ile sadeleşti)
- Saha 1-2 hafta yeni state rozetlerini görüp eski `mrpDurum`/`sevkDurum`/`durum` UI elementlerine güvenini test edecek

**Faz C (orijinal plan: Realtime subscription kullanımı)** — tek başına az değer üretir; Slice 4 gibi atlamayı düşünüyorum, Buket onayı ile.

---

*Slice 3 build PASS. v16.34 deploy bekleniyor.*
