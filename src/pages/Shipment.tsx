import { useAuth } from '@/hooks/useAuth'
import { useState, useMemo } from 'react'
import { useProductionStore, useOrderStore, useWarehouseStore, loadAllStores } from '@/store'
import { today } from '@/lib/utils'
import { toast } from 'sonner'
import { createSevk as createSevkService, updateSevk as updateSevkService, deleteSevk as deleteSevkService } from '@/services/sevkService'
import { showConfirm } from '@/lib/prompt'
import { Plus, Truck, Download, Eye, Search, FileText, Edit2, Archive, ChevronRight, ChevronDown, Printer } from 'lucide-react'
import { MaterialSearchModal } from '@/components/MaterialSearchModal'
import { OZLER } from '@/lib/sirket-bilgileri'
import { z } from 'zod'

const _sevkKalemSchema = z.object({
  malkod: z.string().trim().min(1, 'Malzeme kodu zorunlu'),
  malad: z.string().trim().min(1, 'Malzeme adı zorunlu'),
  miktar: z.number().int('Tam sayı girin').positive('Miktar pozitif olmalı'),
})

const _sevkSubmitSchema = z.object({
  kalemler: z.array(_sevkKalemSchema).min(1, 'En az bir kalem ekleyin'),
  not_: z.string().max(500, 'Not en fazla 500 karakter olabilir'),
  tarih: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih YYYY-MM-DD formatında olmalı'),
})

const _sevkEditSchema = _sevkSubmitSchema.pick({ kalemler: true, not_: true })

export function Shipment() {
  const sevkler = useOrderStore(s => s.sevkler)
  const orders = useOrderStore(s => s.orders)
  const workOrders = useProductionStore(s => s.workOrders)
  const logs = useProductionStore(s => s.logs)
  const materials = useWarehouseStore(s => s.materials)
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const { can } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')   // S6 — liste araması
  const [showArsiv, setShowArsiv] = useState(false)  // S3 — arşiv toggle
  const [expandedMusteriler, setExpandedMusteriler] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggleMusteri(musteri: string) {
    setExpandedMusteriler(prev => {
      const next = new Set(prev)
      if (next.has(musteri)) next.delete(musteri)
      else next.add(musteri)
      return next
    })
  }

  function toggleSevk(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  function toggleGrup(sevkList: typeof filtered) {
    const ids = sevkList.map(s => s.id)
    const allSel = ids.every(id => selected.has(id))
    setSelected(prev => {
      const s = new Set(prev)
      if (allSel) ids.forEach(id => s.delete(id))
      else ids.forEach(id => s.add(id))
      return s
    })
  }

  function printPaketlemeListesi() {
    const seciliSevkler = filtered.filter(s => selected.has(s.id))
    if (!seciliSevkler.length) return

    function getBirim(k: any): string {
      return k.birim || materials.find(m => m.kod === k.malkod)?.birim || 'Adet'
    }

    const sections = seciliSevkler.map(s => {
      const kalemRows = (s.kalemler || []).map((k: any) => `
        <tr>
          <td class="malkod">${k.malkod || '—'}</td>
          <td>${k.malad || '—'}</td>
          <td class="right">${k.miktar}</td>
          <td>${getBirim(k)}</td>
        </tr>`).join('')
      const toplam = (s.kalemler || []).reduce((a: number, k: any) => a + (k.miktar || 0), 0)
      return `
        <div class="sevkiyat">
          <div class="sevk-header">
            <div class="sevk-title">
              <span class="siparis-no">${s.siparisNo || '—'}</span>
              <span class="musteri">${s.musteri || ''}</span>
              <span class="tarih">Tarih: ${s.tarih || ''}</span>
            </div>
            ${s.not ? `<div class="not">Not: ${s.not}</div>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:110px">Malzeme Kodu</th>
                <th>Malzeme Adı</th>
                <th style="width:65px;text-align:right">Miktar</th>
                <th style="width:60px">Birim</th>
              </tr>
            </thead>
            <tbody>
              ${kalemRows}
              <tr class="toplam-row">
                <td colspan="2" style="text-align:right;padding-right:12px">Toplam</td>
                <td style="text-align:right;font-weight:700">${toplam}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>`
    }).join('')

    const toplamKalem = seciliSevkler.reduce((a, s) => a + (s.kalemler?.length || 0), 0)
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Paketleme Listesi — ${today()}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;background:#fff;padding:20px 25px}
    .doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:18px}
    .doc-header h1{font-size:18px;font-weight:700;letter-spacing:.5px;margin-top:4px}
    .sirket{font-size:13px;font-weight:600}
    .meta{font-size:10px;color:#666;margin-top:3px}
    .date{font-size:11px;color:#555;text-align:right}
    .sevkiyat{margin-bottom:22px;page-break-inside:avoid}
    .sevk-header{background:#f2f2f2;border:1px solid #ccc;border-bottom:none;padding:7px 10px}
    .sevk-title{display:flex;align-items:baseline;gap:10px}
    .siparis-no{font-weight:700;font-size:13px}
    .musteri{font-size:12px;color:#444}
    .tarih{font-size:11px;color:#666;margin-left:auto}
    .not{font-size:10px;color:#666;margin-top:3px}
    table{width:100%;border-collapse:collapse}
    th{background:#e2e2e2;text-align:left;padding:5px 8px;border:1px solid #ccc;font-size:11px;font-weight:600}
    td{padding:5px 8px;border:1px solid #ddd;font-size:12px}
    .malkod{font-family:monospace;font-size:11px;color:#333}
    .right{text-align:right}
    .toplam-row td{background:#f5f5f5;border-top:1px solid #aaa}
    .footer{margin-top:16px;font-size:10px;color:#aaa;border-top:1px solid #ddd;padding-top:6px;text-align:right}
    @media print{body{padding:8mm 12mm}.no-print{display:none!important}}
  </style>
</head>
<body>
  <div class="doc-header">
    <div>
      <div class="sirket">${OZLER.kisaUnvan}</div>
      <h1>PAKETLEMELİSTESİ</h1>
      <div class="meta">${seciliSevkler.length} sevkiyat · ${toplamKalem} kalem</div>
    </div>
    <div><div class="date">Çıktı Tarihi: ${today()}</div></div>
  </div>
  ${sections}
  <div class="footer">UYS v3 · ${OZLER.kisaUnvan}</div>
  <script>window.onload=function(){window.print()}<\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=820,height=700')
    if (!win) { toast.error('Popup engelleyici açık. Tarayıcı ayarlarından popup iznini verin.'); return }
    win.document.write(html)
    win.document.close()
  }

  // Sipariş tamamen sevk edilmiş mi? → arşiv kriteri
  function isTamamSevk(orderId: string | undefined): boolean {
    if (!orderId) return false
    const ord = orders.find(o => o.id === orderId)
    return (ord as any)?.sevkDurum === 'tamamen_sevk'
  }

  const sorted = useMemo(() => [...sevkler].sort((a, b) => (b.tarih || '').localeCompare(a.tarih || '')), [sevkler])

  // S3 + S6 — arşiv ve arama filtresi birlikte
  const filtered = useMemo(() => {
    const q = listSearch.toLowerCase()
    return sorted.filter(s => {
      const arsiv = isTamamSevk(s.orderId)
      if (showArsiv ? !arsiv : arsiv) return false
      if (!q) return true
      return (s.siparisNo || '').toLowerCase().includes(q) ||
             (s.musteri || '').toLowerCase().includes(q) ||
             (s.not || '').toLowerCase().includes(q)
    })
  }, [sorted, listSearch, showArsiv, orders])

  const arsivSayisi = useMemo(() => sorted.filter(s => isTamamSevk(s.orderId)).length, [sorted, orders])

  // Müşteri bazlı gruplama
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const s of filtered) {
      const key = s.musteri || '—'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return Array.from(map.entries()).map(([musteri, sevkList]) => ({
      musteri,
      sevkList,
      toplamSevk: sevkList.length,
      toplamMiktar: sevkList.reduce((a, s) => a + (s.kalemler || []).reduce((b: number, k: any) => b + (k.miktar || 0), 0), 0),
      toplamKalem: sevkList.reduce((a, s) => a + (s.kalemler?.length || 0), 0),
    }))
  }, [filtered])

  const genelToplamMiktar = useMemo(() => grouped.reduce((a, g) => a + g.toplamMiktar, 0), [grouped])

  async function deleteSevk(id: string) {
    if (!await showConfirm('Bu sevkiyatı silmek istediğinize emin misiniz?')) return
    const silinenSevk = sevkler.find(s => s.id === id)
    const ord = silinenSevk?.orderId ? orders.find(o => o.id === silinenSevk.orderId) : null
    try {
      await deleteSevkService(id, silinenSevk?.orderId || null, (ord as any)?.adet || 0, (ord as any)?.mamulKod || '')
      loadAllStores(); toast.success('Sevkiyat silindi')
    } catch (e: any) {
      toast.error('Silme hatası: ' + (e?.message || e))
    }
  }

  function exportExcel() {
    import('xlsx').then(XLSX => {
      const rows = sevkler.flatMap(s => (s.kalemler || []).map(k => ({
        'Sipariş': s.siparisNo, 'Müşteri': s.musteri, 'Tarih': s.tarih,
        'Malzeme Kodu': k.malkod, 'Malzeme': k.malad, 'Miktar': k.miktar, 'Not': s.not,
      })))
      const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sevkiyat'); XLSX.writeFile(wb, `sevkiyat_${today()}.xlsx`)
    })
  }

  async function indirSevkiyatPDF() {
    const seciliSevkler = filtered.filter(s => selected.has(s.id))
    if (!seciliSevkler.length) return
    try {
      const { generateSevkiyatPDF } = await import('@/lib/pdf/sevkiyat-pdf')
      await generateSevkiyatPDF(seciliSevkler, materials)
    } catch (e: any) {
      toast.error('Sevkiyat PDF oluşturulamadı: ' + (e?.message || 'bilinmeyen hata'))
    }
  }

  async function indirIrsaliyePDF() {
    const seciliSevkler = filtered.filter(s => selected.has(s.id))
    if (!seciliSevkler.length) return
    try {
      const { generateIrsaliyePDF } = await import('@/lib/pdf/irsaliye-pdf')
      await generateIrsaliyePDF(seciliSevkler, materials)
    } catch (e: any) {
      toast.error('İrsaliye PDF oluşturulamadı: ' + (e?.message || 'bilinmeyen hata'))
    }
  }

  async function indirSevkBelgePDF(s: typeof sevkler[number]) {
    try {
      const ord = orders.find(o => o.id === s.orderId)
      const { generateSevkBelgePDF } = await import('@/lib/pdf/sevk-belge-pdf')
      await generateSevkBelgePDF({ sevk: s, order: ord })
      const sevkNo = (s as any).sevkNo || (s as any).sevk_no || s.id
      toast.success(sevkNo + ' Sevk Belgesi indirildi')
    } catch (e: any) {
      toast.error('Sevk Belgesi PDF oluşturulamadı: ' + (e?.message || 'bilinmeyen hata'))
    }
  }

  const detail = detailId ? sevkler.find(s => s.id === detailId) : null
  const editSevk = editId ? sevkler.find(s => s.id === editId) : null

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Sevkiyat</h1>
          <p className="text-xs text-zinc-500">
            {filtered.length} sevkiyat · {grouped.length} müşteri · {genelToplamMiktar} adet
            {arsivSayisi > 0 && ` · ${arsivSayisi} arşivde`}
          </p>
        </div>
        <div className="flex gap-2">
          {arsivSayisi > 0 && (
            <button onClick={() => setShowArsiv(!showArsiv)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${showArsiv ? 'bg-amber/10 border-amber/25 text-amber' : 'bg-bg-2 border-border text-zinc-400 hover:text-white'}`}>
              <Archive size={13} /> {showArsiv ? 'Aktif Göster' : `+ Arşiv (${arsivSayisi})`}
            </button>
          )}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
            <Download size={13} /> Excel
          </button>
          {can('sevk_add') && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">
              <Plus size={13} /> Yeni Sevkiyat
            </button>
          )}
        </div>
      </div>

      {/* S6 — Liste araması */}
      <div className="relative mb-3">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          placeholder="Sipariş no, müşteri veya not ara..."
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
        />
      </div>

      {/* Seçim çubuğu */}
      {selected.size > 0 && (
        <div className="mb-3 p-2 bg-accent/5 border border-accent/20 rounded-lg flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-accent">{selected.size} sevkiyat seçili</span>
          <button
            onClick={printPaketlemeListesi}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-semibold hover:bg-accent-hover"
          >
            <Printer size={13} /> Paketleme Listesi Yazdır
          </button>
          <button
            onClick={indirSevkiyatPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border text-zinc-300 hover:text-white rounded-lg text-xs font-semibold"
          >
            <FileText size={13} /> Sevkiyat PDF
          </button>
          <button
            onClick={indirIrsaliyePDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border text-zinc-300 hover:text-white rounded-lg text-xs font-semibold"
          >
            <FileText size={13} /> İrsaliye PDF
          </button>
          <span className="flex-1" />
          <button onClick={() => setSelected(new Set())} className="text-[10px] text-zinc-500 hover:text-white">Seçimi Kaldır</button>
        </div>
      )}

      {/* Liste — müşteri bazlı gruplu */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        {filtered.length ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500">
                <th className="px-3 py-2.5 w-8"></th>
                <th className="text-left px-4 py-2.5">Sipariş No</th>
                <th className="text-left px-4 py-2.5">Tarih</th>
                <th className="text-right px-4 py-2.5">Kalem</th>
                <th className="text-right px-4 py-2.5">Toplam Adet</th>
                <th className="text-left px-4 py-2.5">Not</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ musteri, sevkList, toplamSevk, toplamMiktar, toplamKalem }) => {
                const expanded = expandedMusteriler.has(musteri)
                return (
                  <>
                    {/* Grup başlığı */}
                    <tr
                      key={`g-${musteri}`}
                      className="border-b border-border/50 bg-bg-3/40 hover:bg-bg-3/70 cursor-pointer select-none"
                      onClick={() => toggleMusteri(musteri)}
                    >
                      <td colSpan={7} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sevkList.length > 0 && sevkList.every(s => selected.has(s.id))}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleGrup(sevkList)}
                            className="accent-accent shrink-0"
                          />
                          {expanded
                            ? <ChevronDown size={13} className="text-zinc-400 shrink-0" />
                            : <ChevronRight size={13} className="text-zinc-400 shrink-0" />}
                          <span className="font-semibold text-zinc-200">{musteri}</span>
                          <span className="text-zinc-500 ml-1 text-[11px]">{toplamSevk} sevkiyat · {toplamKalem} kalem</span>
                          <span className="ml-auto font-mono font-semibold text-green">{toplamMiktar} adet</span>
                        </div>
                      </td>
                    </tr>

                    {/* Grup satırları */}
                    {expanded && sevkList.map(s => {
                      const topMiktar = (s.kalemler || []).reduce((a, k) => a + (k.miktar || 0), 0)
                      return (
                        <tr key={s.id} className="border-b border-border/20 hover:bg-bg-3/20">
                          <td className="px-3 py-2"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSevk(s.id)} className="accent-accent" /></td>
                          <td className="pl-4 pr-4 py-2 font-mono text-accent">{s.siparisNo || '—'}</td>
                          <td className="px-4 py-2 font-mono text-zinc-500">{s.tarih}</td>
                          <td className="px-4 py-2 text-right font-mono text-zinc-400">{s.kalemler?.length || 0}</td>
                          <td className="px-4 py-2 text-right font-mono text-green">{topMiktar}</td>
                          <td className="px-4 py-2 text-zinc-500 max-w-[200px] truncate">{s.not || '—'}</td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => indirSevkBelgePDF(s)} className="p-1 text-zinc-500 hover:text-accent" title="Sevk Belgesi PDF"><FileText size={12} /></button>
                              <button onClick={() => setDetailId(s.id)} className="p-1 text-zinc-500 hover:text-accent" title="Detay"><Eye size={12} /></button>
                              {can('sevk_edit') && (
                                <button onClick={() => setEditId(s.id)} className="p-1 text-zinc-500 hover:text-accent" title="Düzenle"><Edit2 size={12} /></button>
                              )}
                              {can('sevk_delete') && (
                                <button onClick={() => deleteSevk(s.id)} className="px-2 py-0.5 bg-bg-3 text-zinc-500 rounded text-[10px] hover:text-red">Sil</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Özet satırı — sadece açık ve birden fazla sevkiyat varsa */}
                    {expanded && toplamSevk > 1 && (
                      <tr key={`sum-${musteri}`} className="border-b border-border/50 bg-bg-3/10">
                        <td colSpan={4} className="pl-9 pr-4 py-1.5 text-zinc-600 text-[11px]">Grup toplamı</td>
                        <td className="px-4 py-1.5 text-right font-mono font-semibold text-green text-[11px]">{toplamMiktar}</td>
                        <td colSpan={2}></td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>

            {/* Genel özet — birden fazla müşteri varsa */}
            {grouped.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-border bg-bg-3/30">
                  <td colSpan={4} className="px-4 py-2 text-zinc-400 text-[11px] font-semibold">Genel Toplam</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-green">{genelToplamMiktar}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          <div className="p-8 text-center text-zinc-600 text-sm">
            {showArsiv ? 'Arşivde sevkiyat yok' : listSearch ? 'Aramayla eşleşen sevkiyat yok' : 'Henüz sevkiyat yok'}
          </div>
        )}
      </div>

      {/* Detay Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">{detail.siparisNo || 'Sevkiyat'}</h2>
                <p className="text-xs text-zinc-500">{detail.musteri} · {detail.tarih}</p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-zinc-500 hover:text-white text-lg">✕</button>
            </div>
            <table className="w-full text-xs mb-4">
              <thead><tr className="border-b border-border text-zinc-500">
                <th className="text-left px-3 py-2">Malzeme</th>
                <th className="text-right px-3 py-2">Miktar</th>
              </tr></thead>
              <tbody>
                {(detail.kalemler || []).map((k, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-3 py-1.5"><span className="font-mono text-accent text-[11px]">{k.malkod}</span> {k.malad}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{k.miktar}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.not && <div className="text-xs text-zinc-500 mb-3">Not: {detail.not}</div>}
            <div className="flex gap-2">
              <button onClick={() => setDetailId(null)} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">Kapat</button>
              {can('sevk_edit') && (
                <button onClick={() => { setDetailId(null); setEditId(detail.id) }} className="px-4 py-2 bg-accent text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Edit2 size={12} /> Düzenle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* S7 — Düzenleme Modali */}
      {editSevk && (
        <SevkEditModal
          sevk={editSevk}
          orders={orders}
          materials={materials}
          onClose={() => setEditId(null)}
          onSaved={() => { setEditId(null); loadAllStores(); toast.success('Sevkiyat güncellendi') }}
        />
      )}

      {/* Yeni Sevkiyat Modali */}
      {showForm && (
        <SevkFormModal
          orders={orders}
          sevkler={sevkler}
          workOrders={workOrders}
          logs={logs}
          materials={materials}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); loadAllStores(); toast.success('Sevkiyat oluşturuldu') }}
        />
      )}
    </div>
  )
}

// ═══ S7 — DÜZENLEME MODALI ═══
function SevkEditModal({ sevk, orders, materials, onClose, onSaved }: {
  sevk: any
  orders: { id: string; siparisNo: string; musteri: string; mamulKod: string; adet: number }[]
  materials: import('@/types').Material[]
  onClose: () => void
  onSaved: () => void
}) {
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const [kalemler, setKalemler] = useState<{ malkod: string; malad: string; miktar: number }[]>(
    (sevk.kalemler || []).map((k: any) => ({ malkod: k.malkod || '', malad: k.malad || '', miktar: k.miktar || 0 }))
  )
  const [not_, setNot] = useState(sevk.not || '')
  const [searchIdx, setSearchIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  function addKalem() { setKalemler([...kalemler, { malkod: '', malad: '', miktar: 1 }]) }
  function removeKalem(i: number) { setKalemler(prev => prev.filter((_, idx) => idx !== i)) }
  function updateKalem(i: number, field: string, value: string | number) {
    setKalemler(prev => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k))
  }

  async function save() {
    const validKalemler = kalemler.filter(k => k.malad && k.miktar > 0)
    const _r = _sevkEditSchema.safeParse({ kalemler: validKalemler, not_: not_ })
    if (!_r.success) { toast.error(_r.error.issues[0].message); return }
    setSaving(true)
    const ord = sevk.orderId ? orders.find(o => o.id === sevk.orderId) : null
    try {
      await updateSevkService({
        sevkId: sevk.id,
        orderId: sevk.orderId || null,
        kalemler: validKalemler,
        not_,
        doStokCikis: true,
        stokHareketler,
        tarih: sevk.tarih,
        ordAdet: ord?.adet,
        mamulKod: ord?.mamulKod,
      })
      setSaving(false)
      onSaved()
    } catch (e: any) {
      toast.error('Güncelleme hatası: ' + (e?.message || e))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2"><Edit2 size={16} className="text-accent" /> Sevkiyat Düzenle</h2>
        <p className="text-xs text-zinc-500 mb-4">{sevk.siparisNo || '—'} · {sevk.musteri} · {sevk.tarih}</p>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kalemler</label>
            {kalemler.map((k, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input value={k.malkod} onChange={e => updateKalem(i, 'malkod', e.target.value)}
                  placeholder="Malzeme kodu" className="w-28 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
                <button type="button" onClick={() => setSearchIdx(i)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent shrink-0">
                  <Search size={12} />
                </button>
                <input value={k.malad} onChange={e => updateKalem(i, 'malad', e.target.value)}
                  placeholder="Malzeme adı" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input type="number" min={1} value={k.miktar} onChange={e => updateKalem(i, 'miktar', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
                {kalemler.length > 1 && <button onClick={() => removeKalem(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>}
              </div>
            ))}
            <button onClick={addKalem} className="text-[11px] text-accent hover:underline mt-1">+ Kalem Ekle</button>
          </div>

          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
            <input value={not_} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-50">
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {searchIdx !== null && (
        <MaterialSearchModal
          materials={materials}
          title="Malzeme Ara"
          allowedTypes={['Mamul', 'YarıMamul']}
          onSelect={(mat) => {
            setKalemler(prev => prev.map((k, idx) => idx === searchIdx ? { ...k, malkod: mat.kod, malad: mat.ad } : k))
            setSearchIdx(null)
          }}
          onClose={() => setSearchIdx(null)}
        />
      )}
    </div>
  )
}

// ═══ YENİ SEVKİYAT MODALI (S1 sipariş arama, S2 duplicate, S5 bakiye) ═══
function SevkFormModal({ orders, sevkler, workOrders, logs, materials, onClose, onSaved }: {
  orders: { id: string; siparisNo: string; musteri: string; mamulKod: string; mamulAd: string; adet: number }[]
  sevkler: any[]
  workOrders: { id: string; orderId: string; malkod: string; malad: string; hedef: number }[]
  logs: { woId: string; qty: number }[]
  materials: import('@/types').Material[]
  onClose: () => void
  onSaved: () => void
}) {
  const stokHareketler = useWarehouseStore(s => s.stokHareketler)
  const [orderId, setOrderId] = useState('')
  const [orderSearch, setOrderSearch] = useState('')  // S1 — sipariş arama
  const [showOrderList, setShowOrderList] = useState(false)
  const [tarih, setTarih] = useState(today())  // tarih — default bugün
  const [not_, setNot] = useState('')
  const [kalemler, setKalemler] = useState<{ malkod: string; malad: string; miktar: number }[]>([{ malkod: '', malad: '', miktar: 1 }])
  const [stokCikis, setStokCikis] = useState(true)
  const [searchIdx, setSearchIdx] = useState<number | null>(null)

  const ord = orders.find(o => o.id === orderId)

  // S5 — Bakiye: daha önce bu siparişe ait kaç adet sevk edilmiş
  const mevcutSevkAdet = useMemo(() => {
    if (!orderId || !ord) return 0
    return sevkler
      .filter(s => s.orderId === orderId)
      .flatMap((s: any) => s.kalemler || [])
      .filter((k: any) => k.malkod === ord.mamulKod)
      .reduce((a: number, k: any) => a + (k.miktar || 0), 0)
  }, [orderId, ord, sevkler])

  const kalanAdet = ord ? Math.max(0, ord.adet - mevcutSevkAdet) : 0

  // S1 — Sipariş arama filtresi
  const filteredOrders = useMemo(() => {
    const q = orderSearch.toLowerCase()
    return orders.filter(o => {
      if ((o as any).sevkDurum === 'tamamen_sevk') return false  // arşivde olsun
      if (!q) return true
      return (o.siparisNo || '').toLowerCase().includes(q) ||
             (o.musteri || '').toLowerCase().includes(q) ||
             (o.mamulAd || '').toLowerCase().includes(q)
    })
  }, [orders, orderSearch])

  function selectOrder(o: typeof orders[number]) {
    // S2 — Tamamen sevk edilmiş siparişi engelle
    const mevcutSevk = sevkler
      .filter((s: any) => s.orderId === o.id)
      .flatMap((s: any) => s.kalemler || [])
      .filter((k: any) => k.malkod === o.mamulKod)
      .reduce((a: number, k: any) => a + (k.miktar || 0), 0)
    if (mevcutSevk >= o.adet) {
      toast.error(`${o.siparisNo} zaten tamamen sevk edilmiş (${mevcutSevk}/${o.adet}). Yeni sevkiyat oluşturulamaz.`)
      return
    }
    setOrderId(o.id)
    setOrderSearch(o.siparisNo + ' — ' + o.musteri)
    setShowOrderList(false)

    // Otomatik kalem doldur — daha önce sevk edilen miktarlar düşülür
    const sipWOs = workOrders.filter(w => w.orderId === o.id)
    const mamulWOs = sipWOs.filter(w => !w.malkod?.includes('.') || w.malkod === o.mamulKod)
    // Bu siparişe ait daha önce sevk edilen malkod miktarları
    const dahaOnceSevk: Record<string, number> = {}
    sevkler
      .filter((s: any) => s.orderId === o.id)
      .flatMap((s: any) => s.kalemler || [])
      .forEach((k: any) => { dahaOnceSevk[k.malkod] = (dahaOnceSevk[k.malkod] || 0) + (k.miktar || 0) })
    if (mamulWOs.length) {
      const auto = mamulWOs.map(w => {
        const prod = logs.filter(l => l.woId === w.id).reduce((a, l) => a + l.qty, 0)
        const kalan = Math.max(0, Math.min(prod, w.hedef) - (dahaOnceSevk[w.malkod] || 0))
        return { malkod: w.malkod, malad: w.malad, miktar: kalan }
      }).filter(k => k.miktar > 0)
      if (auto.length) setKalemler(auto)
      else setKalemler([{ malkod: o.mamulKod, malad: o.mamulAd || o.mamulKod, miktar: Math.max(0, o.adet - (dahaOnceSevk[o.mamulKod] || 0)) }])
    } else if (o.mamulKod) {
      setKalemler([{ malkod: o.mamulKod, malad: o.mamulAd || o.mamulKod, miktar: Math.max(0, o.adet - (dahaOnceSevk[o.mamulKod] || 0)) }])
    }
  }

  function addKalem() { setKalemler([...kalemler, { malkod: '', malad: '', miktar: 1 }]) }
  function removeKalem(i: number) { setKalemler(prev => prev.filter((_, idx) => idx !== i)) }
  function updateKalem(i: number, field: string, value: string | number) {
    setKalemler(prev => prev.map((k, idx) => idx === i ? { ...k, [field]: value } : k))
  }

  async function save() {
    const validKalemler = kalemler.filter(k => k.malad && k.miktar > 0)
    const _r = _sevkSubmitSchema.safeParse({ kalemler: validKalemler, not_: not_, tarih })
    if (!_r.success) { toast.error(_r.error.issues[0].message); return }
    // S2 — Son kalkan: kayıt sırasında tekrar kontrol
    if (orderId && ord && mevcutSevkAdet >= ord.adet) {
      toast.error(`${ord.siparisNo} zaten tamamen sevk edilmiş. Kaydedilemez.`); return
    }
    try {
      const { sevkDurum } = await createSevkService({
        orderId: orderId || null,
        siparisNo: ord?.siparisNo || '',
        musteri: ord?.musteri || '',
        kalemler: validKalemler,
        tarih,
        not_,
        doStokCikis: stokCikis,
        stokHareketler,
        ordAdet: ord?.adet,
        mamulKod: ord?.mamulKod,
      })
      if (sevkDurum === 'tamamen_sevk' && ord && (ord as any).durum !== 'kapalı') {
        toast.success('🎯 Sipariş tamamen sevk edildi.', { duration: 6000 })
      }
      onSaved()
    } catch (e: any) {
      toast.error('Sevkiyat kaydedilemedi: ' + (e?.message || e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Truck size={18} className="text-accent" /> Yeni Sevkiyat</h2>
        <div className="space-y-3">

          {/* S1 — Sipariş arama */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Sipariş</label>
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={orderSearch}
                onChange={e => { setOrderSearch(e.target.value); setOrderId(''); setShowOrderList(true) }}
                onFocus={() => setShowOrderList(true)}
                placeholder="Sipariş no veya müşteri ara..."
                className="w-full pl-8 pr-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
              {showOrderList && filteredOrders.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filteredOrders.slice(0, 30).map(o => (
                    <button key={o.id} onMouseDown={() => selectOrder(o)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-bg-3 border-b border-border/30 last:border-0">
                      <span className="font-mono text-accent">{o.siparisNo}</span>
                      <span className="text-zinc-400 ml-2">{o.musteri}</span>
                      <span className="text-zinc-600 ml-2 truncate">{o.mamulAd}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* S5 — Bakiye */}
            {ord && (
              <div className="mt-1.5 flex gap-3 text-[11px]">
                <span className="text-zinc-500">Sipariş: <span className="text-zinc-300 font-mono">{ord.adet}</span></span>
                <span className="text-zinc-500">Daha önce sevk: <span className="text-zinc-300 font-mono">{mevcutSevkAdet}</span></span>
                <span className={`font-semibold ${kalanAdet <= 0 ? 'text-red' : 'text-green'}`}>
                  {kalanAdet <= 0 ? '⚠ Tamamen sevk edilmiş' : `Kalan: ${kalanAdet} adet`}
                </span>
              </div>
            )}
          </div>

          {/* Kalemler */}
          <div>
            <label className="text-[11px] text-zinc-500 mb-1 block">Kalemler</label>
            {kalemler.map((k, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <input value={k.malkod} onChange={e => updateKalem(i, 'malkod', e.target.value)}
                  placeholder="Malzeme kodu" className="w-28 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 font-mono focus:outline-none focus:border-accent" />
                <button type="button" onClick={() => setSearchIdx(i)}
                  className="w-8 h-8 flex items-center justify-center rounded bg-bg-3 border border-border/50 text-zinc-400 hover:text-accent shrink-0">
                  <Search size={12} />
                </button>
                <input value={k.malad} onChange={e => updateKalem(i, 'malad', e.target.value)}
                  placeholder="Malzeme adı" className="flex-1 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
                <input type="number" min={1} value={k.miktar} onChange={e => updateKalem(i, 'miktar', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 bg-bg-2 border border-border rounded text-xs text-zinc-200 text-right focus:outline-none" />
                {kalemler.length > 1 && <button onClick={() => removeKalem(i)} className="text-zinc-500 hover:text-red text-xs">✕</button>}
              </div>
            ))}
            <button onClick={addKalem} className="text-[11px] text-accent hover:underline mt-1">+ Kalem Ekle</button>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={stokCikis} onChange={e => setStokCikis(e.target.checked)} className="accent-accent" />
            Sevkiyatta stok çıkışı yap
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Sevkiyat Tarihi</label>
              <input type="date" value={tarih} onChange={e => setTarih(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Not</label>
              <input value={not_} onChange={e => setNot(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Oluştur</button>
        </div>
      </div>

      {searchIdx !== null && (
        <MaterialSearchModal
          materials={materials}
          title="Malzeme Ara — Ölçü Filtreli"
          allowedTypes={['Mamul', 'YarıMamul']}
          onSelect={(mat) => {
            setKalemler(prev => prev.map((k, idx) => idx === searchIdx ? { ...k, malkod: mat.kod, malad: mat.ad } : k))
            setSearchIdx(null)
          }}
          onClose={() => setSearchIdx(null)}
        />
      )}
    </div>
  )
}
