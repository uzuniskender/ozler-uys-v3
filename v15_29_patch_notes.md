# UYS v3 — v15.29 Patch Notları (ÜYSREV2)

**Tarih:** 22 Nisan 2026 gece ikinci oturum
**Kapsam:** revize-cut + audit-ins
**Onay bekleyen:** Bilgi Bankası §6, §8, §13, §14'e yansıtma

---

## 1. revize-cut — Sipariş Revize Akışına cuttingPlanTemizle Entegrasyonu

### Sorun (v15.28 öncesi)

Sipariş revize akışı (`OrderFormModal.save`, `initial?.id` true dalı):
- Eski İE'ler siliniyordu
- Rezerveler siliniyordu
- **Ama kesim planlarındaki orphan woId'ler temizlenmiyordu** → Sağlık Raporu #3 tekrar tekrar aynı orphan'ları gösteriyordu
- §14 Öncelik 1 açık maddesi

### Düzeltme

`src/pages/Orders.tsx`:

1. Import satırına `cuttingPlanTemizle` eklendi (satır 5)
2. `OrderFormModal.save` içinde:
   - `useStore.getState()` destructuring genişletildi → `workOrders: allWos`, `cuttingPlans: allPlans`
   - `initial?.id` dalında delete ÖNCESİ `eskiWoIds` yakalanıyor
   - Delete SONRASI `await cuttingPlanTemizle(eskiWoIds, allPlans as any)` çağrılıyor
   - Toast mesajına temizlenen kesim + silinen plan sayıları ekleniyor

### Davranış

- Revize sonrası kesim planlarında orphan woId kalmaz
- Plan tamamen boşaldıysa otomatik silinir
- Kullanıcı "X iş emri güncellendi · Y kesim temizlendi · Z plan silindi" mesajı görür

### §14 Öncelik 1 durumu

- ~~Sipariş revize akışına cuttingPlanTemizle entegrasyonu~~ ✅ v15.29'da kapandı

---

## 2. audit-ins — audit-columns.cjs Kapsam Genişletme

### Sorun (v15.28 öncesi)

`scripts/audit-columns.cjs` sadece **inline object literal** geçirilmiş insert/update/upsert'leri kontrol ediyordu (179 çağrı). Kapsam dışı kalan:
- `.insert([{...}, {...}])` array literal
- `.insert(rows)` değişken geçirilmiş çağrılar (12 insert + 28 update + 3 upsert = **43 görünmez çağrı**)
- Bunlar deploy edilirse silent reject riski doğuruyordu (17 Nisan bug'ıyla aynı kategori)

### Düzeltme — Kapsam Genişlemesi

`scripts/audit-columns.cjs` (358 → 636 satır):

**Yeni helper'lar:**
- `findMatchingBracket(src, openIdx)` — balanced `[...]` bulucu
- `extractKeysFromArrayBody(body)` — array içinde depth=0 tüm `{...}` object'lerinden key union
- `findExprEnd(src, startIdx)` — expression boundary (noktalı virgül, standalone newline, paren close)
- `traceVariableKeys(content, varName, beforePos)` — SCOPE-AWARE aynı-dosya değişken trace

**Desteklenen değişken pattern'leri:**
- `(const|let|var) <n>: Type = { ... }` (TypeScript type annotation dahil)
- `(const|let|var) <n> = [{ ... }, { ... }]`
- `(const|let|var) <n> = xxx.map(... => ({ ... }))`
- `<n> = { ... } / [ ... ]` (reassignment)
- `<n>.push({ ... })` (decl ile insert arasında)
- `<n>.<prop> = value` (property-by-property atama, örn: `updates.malad = ad`)

**Scope-aware mantık:**
- `beforePos` parametresi ile verilen insert pozisyonundan ÖNCE gelen EN YAKIN assignment alınır
- Aynı dosyada iki farklı fonksiyonda aynı isimli değişken olsa karışmaz
- (Test case: chatService.ts'te iki ayrı `rows` — uys_chat_members ve uys_chat_mentions için — artık doğru eşleşiyor)

**Untraced warning sistemi:**
- Değişken tanımı bulunamayan veya karmaşık expression olan çağrılar WARNING olarak raporlanır
- WARNING → fail etmez, elle gözden geçirme çağrısıdır
- Şu an 3 untraced var (fonksiyon parametresi — statik analizle çözülemez)

### Metrikler

| Metrik | v15.28 | v15.29 | Değişim |
|---|---|---|---|
| Analiz edilen çağrı | 179 | 216 | +37 |
| Inline object | 179 | 179 | — |
| Array literal | 0 | 1 | +1 |
| Değişken trace | 0 | 36 | +36 |
| Untraced warning | n/a | 3 | (legit) |
| Bulunan sorun | 0 | 0 | — |

### §14 Öncelik 2 durumu

- ~~audit-columns.cjs insert payload kontrolü~~ ✅ v15.29'da kapandı

---

## 3. Bilgi Bankası Güncelleme Noktaları

### §6 Son Sürüm Geçmişi — yeni satır:

```
| v15.29 | ÜYSREV2 (revize-cut + audit-ins) |
```

### §8 Sistem Sağlık Raporu — #3 notu eklensin:

Kontrol #3 (cutting plan orphan woId) artık revize akışında da doğal olarak temizleniyor. Orphan üretmeyen yeni zincir:
- Sipariş revize → `cuttingPlanTemizle` otomatik çağrılır (v15.29)
- Sipariş silme → `siparisSilKapsamli` içinde çağrılır (v15.25'ten beri)

### §13 Audit altyapısı — bilinen eksiklik maddesi güncellensin:

**Eski:**
> audit-columns.cjs insert payload kontrolü eksik — Sadece update objelerini kontrol ediyor, insert objelerini ETMİYOR.

**Yeni:**
> audit-columns.cjs artık insert/update/upsert için inline object, array literal, ve aynı-dosya değişken trace'i destekler. 3 untraced warning var (fonksiyon parametresi — `Operators.tsx:206 data`, `Procurement.tsx:106 data`, `autoChain.ts:64 .slice()`). Bunlar elle doğrulandı, temiz.

### §14 Bilinen Buglar — iki madde kapansın:

```
⚠ Öncelik 1 — Yeni sorun üretmeyelim
- ~~Sipariş revize akışına cuttingPlanTemizle entegrasyonu~~ ✅ v15.29

⚠ Öncelik 2 — Altyapı
- ~~audit-columns.cjs insert payload kontrolü~~ ✅ v15.29
```

### §2 BİR SONRAKİ OTURUMA NOTLAR — güncelleme:

ÜYSREV2 kapsamı çıkartılsın; kalan Orta Öncelik listesine:

| **#** | **İş** | **Süre** | **Dosya** |
| --- | --- | --- | --- |
| F | Dashboard redesign — açık tema, IFS benzeri widget'lar | 2-3 saat | Dashboard.tsx |
| G | Supabase RLS + Auth (güvenlik) | 1-2 gün | Büyük iş |
| Parça 3 | Manuel İE Seçim UI — Buket'in asıl isteği | 2-3 saat | Çok dosya |
| Parça 2B | Kalem bazlı termin FIFO rafine | 2 saat | mrp.ts |

---

## 4. Git Commit Mesajı Önerisi

```
v15.29 — ÜYSREV2: revize-cut + audit-ins

- OrderFormModal revize akışı artık cuttingPlanTemizle çağırıyor
  → orphan woId kesimleri otomatik temizleniyor (§14 Öncelik 1 kapandı)

- audit-columns.cjs kapsamı genişledi:
  - Array literal support (.insert([{...}]))
  - Scope-aware değişken trace (const/let/var + TS type annotations)
  - Property assignment pattern (obj.key = value)
  - Untraced warning sistemi (fonksiyon parametreleri için)
  → 179 → 216 çağrı analiz, 36 yeni trace, 0 sorun (§14 Öncelik 2 kapandı)
```

---

## 5. Test Sonuçları

- `npm run audit:columns` → ✅ TEMİZ (216 çağrı, 0 sorun, 3 untraced warning)
- `npx tsc --noEmit` → ✅ 0 hata
- `npm run lint` → pre-existing 28 hata (my değişikliğim mevcut konvansiyonla uyumlu, lint build pipeline'ında değil)

*— Son —*
