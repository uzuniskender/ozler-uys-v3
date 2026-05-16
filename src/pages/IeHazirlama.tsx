
// src/pages/IeHazirlama.tsx
// v16.84 — İş Emri Hazırlama (Rapido BOM bazlı)

import { useState, useEffect, useMemo } from 'react'
import { supabase, fetchAll } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uid, today } from '@/lib/utils'
import { toast } from 'sonner'
import { Plus, Trash2, Download, CheckSquare, Square, History, ChevronRight, Check, X, Pencil, LayoutGrid, AlertTriangle } from 'lucide-react'
import { z } from 'zod'

const _birimAdetSchema = z.coerce.number().int('Tam sayı girin').min(1, 'En az 1 olmalı')

const _bomUrunSatirSchema = z.object({
  birim_adet: z.number().gt(0, "'1 HM'den Adet' sıfırdan büyük olmalı"),
  kesim_olc_mm: z.number().min(0, 'Kesim ölçüsü ≥ 0 olmalı'),
  hm_uzunluk_mm: z.number().min(0, 'HM uzunluk ≥ 0 olmalı'),
})

// UYS Sipariş No formatı: OZD + 4 haneli yıl + serbest (örn. OZD2026, OZD20260516, OZD2026-123)
const _uysSiparisNoSchema = z.string()
  .trim()
  .min(7, 'En az 7 karakter olmalı (örn. OZD2026)')
  .max(50, 'En fazla 50 karakter olabilir')
  .regex(/^OZD\d{4}/, 'Format: OZD + 4 haneli yıl ile başlamalı (örn. OZD2026, OZD20260516, OZD2026-123)')
  .refine(s => !/\s/.test(s), 'Boşluk içeremez')

// ─── Tipler ───────────────────────────────────────────────────
interface BomSatir {
  id: string
  urun_kodu: string
  urun_adi: string
  is_istasyonu: string
  hammadde_kodu: string
  hammadde_adi: string
  kesim_olc_mm: number
  birim_adet: number
  hm_uzunluk_mm: number
  aciklama: string
}

interface Kalem {
  id: string
  urun_kodu: string
  urun_adi: string
  siparis_adeti: number
}

interface HmIhtiyac {
  hammadde_kodu: string
  hammadde_adi: string
  toplam_kesim_mm: number
  hm_uzunluk_mm: number
  cubuk_adedi: number
}

interface IstasyonIe {
  istasyon: string
  satirlar: {
    urun_kodu: string
    urun_adi: string
    siparis_adeti: number
    hammadde_kodu: string
    hammadde_adi: string
    kesim_olc_mm: number
    birim_adet: number
    toplam_adet: number
  }[]
}

interface IeBaslik {
  id: string
  siparis_no: string
  musteri: string | null
  siparis_tarihi: string | null
  teslim_tarihi: string | null
  olusturan: string | null
  durum: string | null
  ie_verildi_at: string | null
  ie_verildi_by: string | null
  olusturma: string | null
  not_: string | null
  iptal_neden: string | null
  iptal_at: string | null
  iptal_by: string | null
  tamamlandi_at: string | null
  tamamlandi_by: string | null
}

interface IeKalem {
  id: string
  ie_id: string
  urun_kodu: string
  urun_adi: string | null
  siparis_adeti: number
  durum: string | null
  uys_siparis_no: string | null
  siparis_acildi: boolean | null
  siparis_acildi_at: string | null
  iptal_neden: string | null
  iptal_at: string | null
  iptal_by: string | null
}

interface TopluSlot {
  id: string
  urunKodu: string
  urunAdi: string
  adet: number
  arama: string
}

// ─── Hesaplama ────────────────────────────────────────────────
function hesaplaHmIhtiyac(kalemler: Kalem[], bom: BomSatir[]): HmIhtiyac[] {
  const map = new Map<string, HmIhtiyac>()
  for (const kalem of kalemler) {
    const bomSatirlari = bom.filter(b => b.urun_kodu === kalem.urun_kodu)
    // hammadde_kodu bazında: birim_adet × kesim_olc_mm topla
    const hmMap = new Map<string, { hammadde_adi: string; toplam_mm_per: number; hm_uzunluk_mm: number }>()
    for (const b of bomSatirlari) {
      if (!b.hammadde_kodu || b.kesim_olc_mm <= 0 || !b.birim_adet) continue
      const e = hmMap.get(b.hammadde_kodu)
      if (e) {
        e.toplam_mm_per += b.birim_adet * b.kesim_olc_mm
      } else {
        hmMap.set(b.hammadde_kodu, { hammadde_adi: b.hammadde_adi, toplam_mm_per: b.birim_adet * b.kesim_olc_mm, hm_uzunluk_mm: b.hm_uzunluk_mm })
      }
    }
    for (const [hmKod, hmData] of hmMap.entries()) {
      const totalMm = hmData.toplam_mm_per * kalem.siparis_adeti
      const e = map.get(hmKod)
      if (e) {
        e.toplam_kesim_mm += totalMm
      } else {
        map.set(hmKod, { hammadde_kodu: hmKod, hammadde_adi: hmData.hammadde_adi, toplam_kesim_mm: totalMm, hm_uzunluk_mm: hmData.hm_uzunluk_mm, cubuk_adedi: 0 })
      }
    }
  }
  return [...map.values()]
    .map(h => ({ ...h, cubuk_adedi: h.hm_uzunluk_mm > 0 ? Math.ceil(h.toplam_kesim_mm / h.hm_uzunluk_mm) : 0 }))
    .sort((a, b) => a.hammadde_kodu.localeCompare(b.hammadde_kodu, 'tr'))
}

function hesaplaIstasyonIe(kalemler: Kalem[], bom: BomSatir[]): IstasyonIe[] {
  const map = new Map<string, IstasyonIe>()
  for (const kalem of kalemler) {
    const bomSatirlari = bom.filter(b => b.urun_kodu === kalem.urun_kodu)
    for (const b of bomSatirlari) {
      const ist = b.is_istasyonu || 'Tanımsız'
      let group = map.get(ist)
      if (!group) { group = { istasyon: ist, satirlar: [] }; map.set(ist, group) }
      group.satirlar.push({
        urun_kodu: kalem.urun_kodu, urun_adi: kalem.urun_adi, siparis_adeti: kalem.siparis_adeti,
        hammadde_kodu: b.hammadde_kodu, hammadde_adi: b.hammadde_adi,
        kesim_olc_mm: b.kesim_olc_mm, birim_adet: b.birim_adet,
        toplam_adet: b.birim_adet * kalem.siparis_adeti,
      })
    }
  }
  return [...map.values()].sort((a, b) => a.istasyon.localeCompare(b.istasyon, 'tr'))
}

// ─── Excel Export ─────────────────────────────────────────────
async function exportExcel(
  baslik: { siparis_no: string; musteri: string; teslim_tarihi: string },
  hmIhtiyac: HmIhtiyac[],
  istasyonlar: IstasyonIe[]
) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const bilgiRows = [
    { Alan: 'Sipariş No', Değer: baslik.siparis_no },
    { Alan: 'Müşteri', Değer: baslik.musteri || '' },
    { Alan: 'Teslim Tarihi', Değer: baslik.teslim_tarihi || '' },
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bilgiRows), 'Sipariş Bilgileri')

  const hmRows = hmIhtiyac.map(h => ({
    'Hammadde Kodu': h.hammadde_kodu,
    'Hammadde Adı': h.hammadde_adi,
    'Toplam Kesim (mm)': Math.round(h.toplam_kesim_mm),
    'Toplam Kesim (m)': +(h.toplam_kesim_mm / 1000).toFixed(3),
    'HM Uzunluk (mm)': h.hm_uzunluk_mm,
    'Çubuk/Levha Adedi': h.cubuk_adedi,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hmRows), 'Hammadde İhtiyacı')

  for (const ist of istasyonlar) {
    const rows = ist.satirlar.map(s => ({
      'Ürün Kodu': s.urun_kodu,
      'Ürün Adı': s.urun_adi,
      'Sipariş Adeti': s.siparis_adeti,
      'Hammadde Kodu': s.hammadde_kodu,
      'Hammadde Adı': s.hammadde_adi,
      'Kesim Ölçüsü (mm)': s.kesim_olc_mm,
      'Birim Adet': s.birim_adet,
      'Toplam Adet': s.toplam_adet,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), ist.istasyon.slice(0, 30))
  }

  const fileName = `IE_${baslik.siparis_no}_${today()}.xlsx`
  XLSX.writeFile(wb, fileName)
  toast.success('Excel indirildi: ' + fileName)
}

// ─── Alt Bileşenler ───────────────────────────────────────────
function HammaddePanel({ hmIhtiyac }: { hmIhtiyac: HmIhtiyac[] }) {
  if (hmIhtiyac.length === 0) return null
  return (
    <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-zinc-300">🔩 Hammadde İhtiyacı</h3>
        <p className="text-[10px] text-zinc-500">{hmIhtiyac.length} hammadde kodu · CEILING(toplam kesim / HM uzunluk)</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border text-zinc-500">
            <th className="text-left px-3 py-2">HM Kodu</th>
            <th className="text-left px-3 py-2">HM Adı</th>
            <th className="text-right px-3 py-2">Top. Kesim (m)</th>
            <th className="text-right px-3 py-2 text-accent font-bold">Çubuk/Ad.</th>
          </tr>
        </thead>
        <tbody>
          {hmIhtiyac.map(h => (
            <tr key={h.hammadde_kodu} className="border-b border-border/30 hover:bg-bg-3/20">
              <td className="px-3 py-1.5 font-mono text-accent text-[10px]">{h.hammadde_kodu}</td>
              <td className="px-3 py-1.5 text-zinc-400 text-[11px]">{h.hammadde_adi}</td>
              <td className="px-3 py-1.5 text-right font-mono text-zinc-300">{(h.toplam_kesim_mm / 1000).toFixed(3)}</td>
              <td className="px-3 py-1.5 text-right font-mono font-bold text-accent text-sm">{h.cubuk_adedi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IstasyonPanel({ istasyonlar }: { istasyonlar: IstasyonIe[] }) {
  const [acik, setAcik] = useState<string | null>(null)
  if (istasyonlar.length === 0) return null
  return (
    <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-zinc-300">🏭 İş Emri — İstasyon Bazlı</h3>
        <p className="text-[10px] text-zinc-500">{istasyonlar.length} istasyon · satıra tıkla &rarr; aç/kapat</p>
      </div>
      <div className="divide-y divide-border">
        {istasyonlar.map(ist => {
          const isAcik = acik === ist.istasyon
          return (
            <div key={ist.istasyon}>
              <button
                onClick={() => setAcik(isAcik ? null : ist.istasyon)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-bg-3/30 text-left"
              >
                <ChevronRight size={13} className={`text-zinc-500 transition-transform ${isAcik ? 'rotate-90' : ''}`} />
                <span className="text-xs font-semibold text-zinc-200">{ist.istasyon}</span>
                <span className="text-[10px] text-zinc-600 ml-auto">{ist.satirlar.length} satır</span>
              </button>
              {isAcik && (
                <table className="w-full text-[11px] bg-bg-3/20">
                  <thead>
                    <tr className="border-b border-border/50 text-zinc-600">
                      <th className="text-left px-4 py-1.5">Ürün Kodu</th>
                      <th className="text-left px-3 py-1.5">HM Kodu</th>
                      <th className="text-right px-3 py-1.5">Kesim (mm)</th>
                      <th className="text-right px-3 py-1.5">Birim × Sipariş</th>
                      <th className="text-right px-3 py-1.5 text-accent">Toplam Adet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ist.satirlar.map((s, i) => (
                      <tr key={i} className="border-b border-border/20 hover:bg-bg-3/30">
                        <td className="px-4 py-1 text-zinc-400 font-mono text-[10px]">{s.urun_kodu}</td>
                        <td className="px-3 py-1 text-zinc-500 text-[10px]">{s.hammadde_kodu}</td>
                        <td className="px-3 py-1 text-right font-mono text-zinc-400">{s.kesim_olc_mm}</td>
                        <td className="px-3 py-1 text-right font-mono text-zinc-500">{s.birim_adet} × {s.siparis_adeti}</td>
                        <td className="px-3 py-1 text-right font-mono font-bold text-accent">{s.toplam_adet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ana Bileşen ──────────────────────────────────────────────
export function IeHazirlama() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'yeni' | 'gecmis'>('yeni')

  // BOM (bir kez yükle)
  const [bom, setBom] = useState<BomSatir[]>([])
  const [bomLoading, setBomLoading] = useState(true)

  // Yeni form
  const [siparisNo, setSiparisNo] = useState('')
  const [musteri, setMusteri] = useState('')
  const [siparisTarihi, setSiparisTarihi] = useState(today())
  const [teslimTarihi, setTeslimTarihi] = useState('')
  const [kalemler, setKalemler] = useState<Kalem[]>([])
  const [secilenUrun, setSecilenUrun] = useState('')
  const [sipAdet, setSipAdet] = useState<number>(1)
  const [saving, setSaving] = useState(false)
  const [urunArama, setUrunArama] = useState('')
  const [showTopluModal, setShowTopluModal] = useState(false)

  // Geçmiş
  const [gecmis, setGecmis] = useState<IeBaslik[]>([])
  const [gecmisLoading, setGecmisLoading] = useState(false)
  const [secilenIe, setSecilenIe] = useState<IeBaslik | null>(null)
  const [secilenKalemler, setSecilenKalemler] = useState<IeKalem[]>([])
  const [detayAcik, setDetayAcik] = useState(false)
  const [duzenleIe, setDuzenleIe] = useState<IeBaslik | null>(null)
  const [iptalModalAcik, setIptalModalAcik] = useState(false)
  const [iptalHedef, setIptalHedef] = useState<IeBaslik | null>(null)
  const [iptalNeden, setIptalNeden] = useState('')
  const [islemYapiliyor, setIslemYapiliyor] = useState(false)
  const [bomDuzenleSatir, setBomDuzenleSatir] = useState<BomSatir | null>(null)
  const [bomUrunModalOpen, setBomUrunModalOpen] = useState(false)
  // Geçmiş — filtre + pagination
  const PAGE_SIZE = 30
  const [filterSiparisNo, setFilterSiparisNo] = useState('')
  const [filterMusteri, setFilterMusteri] = useState('')
  const [filterBasTarih, setFilterBasTarih] = useState('')
  const [filterBitisTarih, setFilterBitisTarih] = useState('')
  const [gecmisPage, setGecmisPage] = useState(1)
  const [gecmisTotal, setGecmisTotal] = useState(0)

  useEffect(() => {
    // fetchAll: uys_rapido_bom 1000+ satır içerir, default cap'i aşar
    fetchAll<BomSatir>('uys_rapido_bom').then(({ data, error }) => {
      if (error) toast.error('BOM yüklenemedi: ' + error.message)
      else setBom(data.filter(b => b.aktif))
      setBomLoading(false)
    })
  }, [])

  const urunler = useMemo(() => {
    const map = new Map<string, { kodu: string; adi: string }>()
    for (const b of bom) {
      if (!map.has(b.urun_kodu)) map.set(b.urun_kodu, { kodu: b.urun_kodu, adi: b.urun_adi })
    }
    return [...map.values()].sort((a, b) => a.adi.localeCompare(b.adi, 'tr'))
  }, [bom])

  const filtreliUrunler = useMemo(() => {
    if (!urunArama) return urunler
    const q = urunArama.toLowerCase()
    return urunler.filter(u => u.kodu.toLowerCase().includes(q) || u.adi.toLowerCase().includes(q))
  }, [urunler, urunArama])

  const hmIhtiyac = useMemo(() => hesaplaHmIhtiyac(kalemler, bom), [kalemler, bom])
  const istasyonlar = useMemo(() => hesaplaIstasyonIe(kalemler, bom), [kalemler, bom])
  const eksikBomSatirlari = useMemo(() => {
    const eksik: BomSatir[] = []
    for (const kalem of kalemler) {
      bom
        .filter(b => b.urun_kodu === kalem.urun_kodu && b.hammadde_kodu && b.kesim_olc_mm > 0 && !b.birim_adet)
        .forEach(b => eksik.push(b))
    }
    return eksik
  }, [kalemler, bom])

  async function loadGecmis(
    page: number,
    ov: { siparisNo?: string; musteri?: string; bas?: string; bitis?: string } = {}
  ) {
    setGecmisLoading(true)
    const sNo   = ov.siparisNo  ?? filterSiparisNo
    const mstr  = ov.musteri    ?? filterMusteri
    const bas   = ov.bas        ?? filterBasTarih
    const bitis = ov.bitis      ?? filterBitisTarih
    const from  = (page - 1) * PAGE_SIZE
    const to    = from + PAGE_SIZE - 1

    let q = supabase
      .from('uys_ie_hazirlama')
      .select('*', { count: 'exact' })
      .order('olusturma', { ascending: false })
      .range(from, to)

    if (sNo.trim())   q = q.ilike('siparis_no', `%${sNo.trim()}%`)
    if (mstr.trim())  q = q.ilike('musteri',    `%${mstr.trim()}%`)
    if (bas)          q = q.gte('olusturma', bas)
    if (bitis)        q = q.lte('olusturma', bitis)

    const { data, error, count } = await q
    if (error) toast.error('Geçmiş yüklenemedi')
    else { setGecmis((data || []) as IeBaslik[]); setGecmisTotal(count || 0) }
    setGecmisLoading(false)
  }

  function goPage(p: number) { setGecmisPage(p); loadGecmis(p) }
  function araGecmis() { setGecmisPage(1); loadGecmis(1) }
  function resetFilters() {
    setFilterSiparisNo(''); setFilterMusteri(''); setFilterBasTarih(''); setFilterBitisTarih('')
    setGecmisPage(1)
    loadGecmis(1, { siparisNo: '', musteri: '', bas: '', bitis: '' })
  }

  useEffect(() => {
    if (tab !== 'gecmis') return
    setGecmisPage(1)
    loadGecmis(1, { siparisNo: '', musteri: '', bas: '', bitis: '' })
  }, [tab])

  function handleTopluEkle(slots: TopluSlot[]) {
    const gecerli = slots.filter(s => s.urunKodu && s.adet > 0)
    if (!gecerli.length) { toast.error('En az bir ürün seçin'); return }
    setKalemler(prev => {
      let next = [...prev]
      for (const s of gecerli) {
        const mevcut = next.find(k => k.urun_kodu === s.urunKodu)
        if (mevcut) {
          next = next.map(k => k.urun_kodu === s.urunKodu ? { ...k, siparis_adeti: k.siparis_adeti + s.adet } : k)
        } else {
          next.push({ id: uid(), urun_kodu: s.urunKodu, urun_adi: s.urunAdi, siparis_adeti: s.adet })
        }
      }
      return next
    })
    setShowTopluModal(false)
    toast.success(`${gecerli.length} ürün eklendi`)
  }

  function kalemEkle() {
    if (!secilenUrun) return toast.error('Ürün seçin')
    if (sipAdet <= 0) return toast.error('Geçerli adet girin')
    const urun = urunler.find(u => u.kodu === secilenUrun)
    if (!urun) return
    const existing = kalemler.find(k => k.urun_kodu === secilenUrun)
    if (existing) {
      setKalemler(prev => prev.map(k => k.urun_kodu === secilenUrun ? { ...k, siparis_adeti: k.siparis_adeti + sipAdet } : k))
    } else {
      setKalemler(prev => [...prev, { id: uid(), urun_kodu: urun.kodu, urun_adi: urun.adi, siparis_adeti: sipAdet }])
    }
    setSecilenUrun(''); setSipAdet(1); setUrunArama('')
  }

  function formSifirla() {
    setSiparisNo(''); setMusteri(''); setSiparisTarihi(today()); setTeslimTarihi('')
    setKalemler([]); setSecilenUrun(''); setSipAdet(1); setUrunArama('')
  }

  async function kaydetVeVer() {
    const _s = _uysSiparisNoSchema.safeParse(siparisNo)
    if (!_s.success) return toast.error(_s.error.issues[0].message)
    const sNo = _s.data
    if (kalemler.length === 0) return toast.error('En az bir ürün ekleyin')
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const ieId = uid()
      const { error: e1 } = await supabase.from('uys_ie_hazirlama').insert({
        id: ieId, siparis_no: sNo, musteri: musteri.trim() || null,
        siparis_tarihi: siparisTarihi || null, teslim_tarihi: teslimTarihi || null,
        olusturan: user?.username || user?.email || null,
        durum: 'verildi', ie_verildi_at: now, ie_verildi_by: user?.username || user?.email || null,
        olusturma: today(),
      })
      if (e1) throw e1
      for (const k of kalemler) {
        const { error: e2 } = await supabase.from('uys_ie_hazirlama_kalemler').insert({
          id: uid(), ie_id: ieId, urun_kodu: k.urun_kodu, urun_adi: k.urun_adi,
          siparis_adeti: k.siparis_adeti, durum: 'verildi', olusturma: today(),
        })
        if (e2) throw e2
      }
      await supabase.from('uys_ie_log').insert({
        id: uid(), ie_id: ieId, event: 'ie_verildi',
        aciklama: `${kalemler.length} kalem, ${kalemler.reduce((a, k) => a + k.siparis_adeti, 0)} adet`,
        kullanici: user?.username || user?.email || null, tarih: now,
      })
      toast.success('İş Emri verildi: ' + sNo)
      formSifirla()
    } catch (e: any) {
      toast.error('Kayıt hatası: ' + (e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function gecmisDetay(ie: IeBaslik) {
    setSecilenIe(ie); setDetayAcik(true)
    const { data } = await supabase.from('uys_ie_hazirlama_kalemler')
      .select('*').eq('ie_id', ie.id).order('olusturma')
    setSecilenKalemler((data || []) as IeKalem[])
  }

  // Audit log helper — uys_ie_hazirlama_log'a kayıt atar.
  // Fire-and-forget: hata olursa toast ile uyarır, ana akışı bozmaz.
  async function logIeOlay(args: {
    ieId: string
    kalemId: string
    tip: 'siparis_acildi_toggle' | 'uys_siparis_no_set'
    aciklama: string
    siparisNo: string
    urunKodu: string
  }) {
    const now = new Date()
    const kullanici = user?.username || user?.email || 'sistem'
    try {
      const { error } = await supabase.from('uys_ie_hazirlama_log').insert({
        id: uid(),
        ie_id: args.ieId,
        kalem_id: args.kalemId,
        tip: args.tip,
        aciklama: args.aciklama,
        siparis_no: args.siparisNo,
        urun_kodu: args.urunKodu,
        kullanici,
        tarih: now.toISOString().slice(0, 10),
        saat: now.toTimeString().slice(0, 8),
      })
      if (error) toast.warning('Log yazılamadı: ' + error.message)
    } catch (e: any) {
      toast.warning('Log exception: ' + (e?.message || e))
    }
  }

  async function toggleSiparisAcildi(kalem: IeKalem) {
    const newVal = !kalem.siparis_acildi
    await supabase.from('uys_ie_hazirlama_kalemler').update({
      siparis_acildi: newVal, siparis_acildi_at: newVal ? new Date().toISOString() : null,
    }).eq('id', kalem.id)
    setSecilenKalemler(prev => prev.map(k => k.id === kalem.id ? { ...k, siparis_acildi: newVal } : k))
    await logIeOlay({
      ieId: kalem.ie_id,
      kalemId: kalem.id,
      tip: 'siparis_acildi_toggle',
      aciklama: newVal ? 'UYS sipariş açıldı olarak işaretlendi' : 'UYS sipariş açıldı geri alındı',
      siparisNo: secilenIe?.siparis_no || '',
      urunKodu: kalem.urun_kodu,
    })
    toast.success(newVal ? 'UYS sipariş açıldı ✓' : 'Geri alındı')
  }

  async function kaydetUysSiparisNo(kalem: IeKalem, yeniNo: string) {
    const eski = kalem.uys_siparis_no || ''
    const yeni = yeniNo.trim()
    if (eski === yeni) return
    // Boş bırakmak temizleme demektir → format kontrolünden muaf
    if (yeni) {
      const _s = _uysSiparisNoSchema.safeParse(yeni)
      if (!_s.success) { toast.error(_s.error.issues[0].message); return }
    }
    const { error } = await supabase.from('uys_ie_hazirlama_kalemler')
      .update({ uys_siparis_no: yeni || null })
      .eq('id', kalem.id)
    if (error) { toast.error('Kayıt hatası: ' + error.message); return }
    setSecilenKalemler(prev => prev.map(k => k.id === kalem.id ? { ...k, uys_siparis_no: yeni || null } : k))
    await logIeOlay({
      ieId: kalem.ie_id,
      kalemId: kalem.id,
      tip: 'uys_siparis_no_set',
      aciklama: eski
        ? `UYS Sipariş No güncellendi: "${eski}" → "${yeni || '∅'}"`
        : `UYS Sipariş No atandı: "${yeni}"`,
      siparisNo: secilenIe?.siparis_no || '',
      urunKodu: kalem.urun_kodu,
    })
    toast.success(yeni ? 'UYS Sipariş No kaydedildi' : 'UYS Sipariş No temizlendi')
  }

  async function tamamlandiYap(ie: IeBaslik) {
    setIslemYapiliyor(true)
    try {
      const now = new Date().toISOString()
      const kullanici = user?.username || user?.email || 'sistem'
      const { error: e1 } = await supabase.from('uys_ie_hazirlama')
        .update({ durum: 'tamamlandi', tamamlandi_at: now, tamamlandi_by: kullanici })
        .eq('id', ie.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('uys_ie_hazirlama_kalemler')
        .update({ durum: 'tamamlandi' })
        .eq('ie_id', ie.id)
        .eq('durum', 'verildi')
      if (e2) throw e2
      await supabase.from('uys_ie_log').insert({
        id: uid(), ie_id: ie.id, event: 'ie_tamamlandi',
        aciklama: 'İş emri tamamlandı olarak işaretlendi',
        kullanici, tarih: now,
      })
      setGecmis(prev => prev.map(g => g.id === ie.id ? { ...g, durum: 'tamamlandi', tamamlandi_at: now, tamamlandi_by: kullanici } : g))
      toast.success('İş emri tamamlandı ✓')
    } catch (e: any) {
      toast.error('Hata: ' + (e.message || e))
    } finally {
      setIslemYapiliyor(false)
    }
  }

  async function iptalYap(ie: IeBaslik, neden: string) {
    if (!neden.trim()) return toast.error('İptal nedeni zorunlu')
    setIslemYapiliyor(true)
    try {
      const now = new Date().toISOString()
      const kullanici = user?.username || user?.email || 'sistem'
      const { error: e1 } = await supabase.from('uys_ie_hazirlama')
        .update({ durum: 'iptal', iptal_neden: neden.trim(), iptal_at: now, iptal_by: kullanici })
        .eq('id', ie.id)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('uys_ie_hazirlama_kalemler')
        .update({ durum: 'iptal', iptal_neden: neden.trim(), iptal_at: now, iptal_by: kullanici })
        .eq('ie_id', ie.id)
      if (e2) throw e2
      await supabase.from('uys_ie_log').insert({
        id: uid(), ie_id: ie.id, event: 'ie_iptal',
        aciklama: `İptal: ${neden.trim()}`,
        kullanici, tarih: now,
      })
      setGecmis(prev => prev.map(g => g.id === ie.id ? { ...g, durum: 'iptal', iptal_neden: neden.trim(), iptal_at: now, iptal_by: kullanici } : g))
      setIptalModalAcik(false)
      setIptalHedef(null)
      setIptalNeden('')
      toast.success('İş emri iptal edildi')
    } catch (e: any) {
      toast.error('Hata: ' + (e.message || e))
    } finally {
      setIslemYapiliyor(false)
    }
  }

  async function baslikKaydet(data: {
    siparis_no: string
    musteri: string
    siparis_tarihi: string
    teslim_tarihi: string
    not_: string
  }) {
    if (!duzenleIe) return
    const { error } = await supabase.from('uys_ie_hazirlama').update({
      siparis_no: data.siparis_no.trim(),
      musteri: data.musteri.trim() || null,
      siparis_tarihi: data.siparis_tarihi || null,
      teslim_tarihi: data.teslim_tarihi || null,
      not_: data.not_.trim() || null,
    }).eq('id', duzenleIe.id)
    if (error) { toast.error('Kayıt hatası: ' + error.message); return }
    const updated: IeBaslik = {
      ...duzenleIe,
      siparis_no: data.siparis_no.trim(),
      musteri: data.musteri.trim() || null,
      siparis_tarihi: data.siparis_tarihi || null,
      teslim_tarihi: data.teslim_tarihi || null,
      not_: data.not_.trim() || null,
    }
    setGecmis(prev => prev.map(ie => ie.id === duzenleIe.id ? updated : ie))
    if (secilenIe?.id === duzenleIe.id) setSecilenIe(updated)
    setDuzenleIe(null)
    toast.success('Başlık güncellendi')
  }

  const detayKalemler = useMemo(() =>
    secilenKalemler.map(k => ({ id: k.id, urun_kodu: k.urun_kodu, urun_adi: k.urun_adi || k.urun_kodu, siparis_adeti: Number(k.siparis_adeti) }))
  , [secilenKalemler])
  const detayHm = useMemo(() => hesaplaHmIhtiyac(detayKalemler, bom), [detayKalemler, bom])
  const detayIst = useMemo(() => hesaplaIstasyonIe(detayKalemler, bom), [detayKalemler, bom])

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">İş Emri Hazırlama</h1>
          <p className="text-xs text-zinc-500">Rapido BOM · Hammadde ihtiyaç + istasyon bazlı iş emri</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('yeni'); formSifirla() }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'yeni' ? 'bg-accent text-white' : 'bg-bg-2 border border-border text-zinc-400 hover:text-white'}`}>
            + Yeni Hazırla
          </button>
          <button onClick={() => setTab('gecmis')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === 'gecmis' ? 'bg-accent text-white' : 'bg-bg-2 border border-border text-zinc-400 hover:text-white'}`}>
            <History size={13} /> Geçmiş
          </button>
          <button onClick={() => setBomUrunModalOpen(true)} disabled={bomLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-2 border border-border text-zinc-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">
            🔧 BOM Düzenle
          </button>
        </div>
      </div>

      {bomUrunModalOpen && (
        <BomUrunDuzenleModal
          bom={bom}
          onClose={() => setBomUrunModalOpen(false)}
          onSaved={(updated) => {
            setBom(prev => prev.map(b => {
              const u = updated.find(x => x.id === b.id)
              return u || b
            }))
          }}
        />
      )}

      {/* ─── YENİ HAZIRLA ─── */}
      {tab === 'yeni' && (
        <div className="space-y-4">
          {/* Başlık formu */}
          <div className="bg-bg-2 border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 text-zinc-300">Sipariş Bilgileri</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'SİPARİŞ NO *', value: siparisNo, set: setSiparisNo, ph: 'OZD2026...', type: 'text' },
                { label: 'MÜŞTERİ', value: musteri, set: setMusteri, ph: 'Müşteri adı', type: 'text' },
                { label: 'SİPARİŞ TARİHİ', value: siparisTarihi, set: setSiparisTarihi, ph: '', type: 'date' },
                { label: 'TESLİM TARİHİ', value: teslimTarihi, set: setTeslimTarihi, ph: '', type: 'date' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] text-zinc-500 font-mono">{f.label}</label>
                  <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full mt-1 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent" />
                </div>
              ))}
            </div>
          </div>

          {/* Ürün ekleme */}
          <div className="bg-bg-2 border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold mb-3 text-zinc-300">Ürün Kalemleri</h2>
            <div className="flex gap-2 mb-3">
              <div className="flex-1 relative">
                <input
                  value={urunArama}
                  onChange={e => { setUrunArama(e.target.value); setSecilenUrun('') }}
                  placeholder={bomLoading ? 'BOM yükleniyor...' : `Ürün kodu / adı ara (${urunler.length} ürün)...`}
                  disabled={bomLoading}
                  className="w-full px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                />
                {urunArama && filtreliUrunler.length > 0 && !secilenUrun && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filtreliUrunler.slice(0, 40).map(u => (
                      <button key={u.kodu}
                        onClick={() => { setSecilenUrun(u.kodu); setUrunArama(u.kodu + ' — ' + u.adi) }}
                        className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-2 border-b border-border/30 last:border-0"
                      >
                        <span className="font-mono text-accent text-[11px]">{u.kodu}</span>
                        <span className="ml-2 text-zinc-400">{u.adi}</span>
                      </button>
                    ))}
                    {filtreliUrunler.length > 40 && <div className="px-3 py-1.5 text-[10px] text-zinc-600">+{filtreliUrunler.length - 40} daha...</div>}
                  </div>
                )}
              </div>
              <input type="number" value={sipAdet} min={1}
                onChange={e => setSipAdet(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 text-center focus:outline-none focus:border-accent"
              />
              <button onClick={kalemEkle} disabled={!secilenUrun}
                className="flex items-center gap-1.5 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus size={13} /> Ekle
              </button>
              <button onClick={() => setShowTopluModal(true)} disabled={bomLoading}
                className="flex items-center gap-1.5 px-3 py-2 bg-bg-3 border border-border hover:border-accent text-zinc-300 hover:text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                <LayoutGrid size={13} /> Toplu Ekle
              </button>
            </div>

            {kalemler.length === 0 ? (
              <div className="text-zinc-600 text-xs text-center py-4">Henüz ürün eklenmedi</div>
            ) : (
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-zinc-500">
                  <th className="text-left px-3 py-2">Ürün Kodu</th>
                  <th className="text-left px-3 py-2">Ürün Adı</th>
                  <th className="text-right px-3 py-2">Adet</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr></thead>
                <tbody>
                  {kalemler.map(k => (
                    <tr key={k.id} className="border-b border-border/30 hover:bg-bg-3/30">
                      <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{k.urun_kodu}</td>
                      <td className="px-3 py-1.5 text-zinc-300">{k.urun_adi}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input type="number" value={k.siparis_adeti} min={1}
                          onChange={e => setKalemler(prev => prev.map(x => x.id === k.id ? { ...x, siparis_adeti: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                          className="w-16 px-2 py-0.5 bg-bg-3 border border-border rounded text-xs text-right text-zinc-200 focus:outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button onClick={() => setKalemler(prev => prev.filter(x => x.id !== k.id))} className="p-1 text-zinc-600 hover:text-red">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Eksik birim_adet uyarısı */}
          {eksikBomSatirlari.length > 0 && (
            <div className="bg-amber/10 border border-amber/30 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber/20">
                <AlertTriangle size={13} className="text-amber shrink-0" />
                <span className="text-xs font-semibold text-amber">
                  {eksikBomSatirlari.length} BOM satırında "Birim Adet" eksik — hammadde ihtiyacı hesaplanamıyor
                </span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-amber/20 text-zinc-500">
                  <th className="text-left px-4 py-1.5">Ürün Kodu</th>
                  <th className="text-left px-3 py-1.5">İstasyon</th>
                  <th className="text-left px-3 py-1.5">HM Kodu</th>
                  <th className="text-right px-3 py-1.5">Kesim (mm)</th>
                  <th className="px-3 py-1.5 w-24"></th>
                </tr></thead>
                <tbody>
                  {eksikBomSatirlari.map(b => (
                    <tr key={b.id} className="border-b border-amber/10">
                      <td className="px-4 py-1.5 font-mono text-[11px] text-accent">{b.urun_kodu}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{b.is_istasyonu || '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-300">{b.hammadde_kodu}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{b.kesim_olc_mm}</td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          onClick={() => setBomDuzenleSatir(b)}
                          className="px-2.5 py-1 bg-amber/20 hover:bg-amber/35 text-amber rounded text-[10px] font-semibold"
                        >
                          Bilgiyi tamamlayın
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* BOM düzenleme modal */}
          {bomDuzenleSatir && (
            <BomDuzenleModal
              satir={bomDuzenleSatir}
              onClose={() => setBomDuzenleSatir(null)}
              onSaved={updated => {
                setBom(prev => prev.map(b => b.id === updated.id ? updated : b))
                setBomDuzenleSatir(null)
              }}
            />
          )}

          {/* Hesaplama paneli */}
          {kalemler.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <HammaddePanel hmIhtiyac={hmIhtiyac} />
              <IstasyonPanel istasyonlar={istasyonlar} />
            </div>
          )}

          {/* Aksiyon */}
          {kalemler.length > 0 && (
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => exportExcel({ siparis_no: siparisNo || 'taslak', musteri, teslim_tarihi: teslimTarihi }, hmIhtiyac, istasyonlar)}
                className="flex items-center gap-1.5 px-4 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300 hover:text-white"
              >
                <Download size={13} /> Excel İndir
              </button>
              <button onClick={kaydetVeVer} disabled={saving || !siparisNo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-green/80 hover:bg-green text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                <CheckSquare size={13} /> {saving ? 'Kaydediliyor...' : 'İş Emri Ver'}
              </button>
            </div>
          )}
        </div>
      )}

      {showTopluModal && (
        <TopluEkleModal
          urunler={urunler}
          onEkle={handleTopluEkle}
          onClose={() => setShowTopluModal(false)}
        />
      )}

      {/* ─── GEÇMİŞ ─── */}
      {tab === 'gecmis' && (
        <div>
          {/* Filtre bar */}
          <div className="flex flex-wrap items-end gap-2 mb-3 p-3 bg-bg-2 border border-border rounded-xl">
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Sipariş No</label>
              <input value={filterSiparisNo} onChange={e => setFilterSiparisNo(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && araGecmis()}
                placeholder="OZD2026..." className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 w-36 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Müşteri</label>
              <input value={filterMusteri} onChange={e => setFilterMusteri(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && araGecmis()}
                placeholder="Müşteri adı..." className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 w-40 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Tarih (başlangıç)</label>
              <input type="date" value={filterBasTarih} onChange={e => setFilterBasTarih(e.target.value)}
                className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 block mb-1">Tarih (bitiş)</label>
              <input type="date" value={filterBitisTarih} onChange={e => setFilterBitisTarih(e.target.value)}
                className="px-2 py-1.5 bg-bg-3 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <button onClick={araGecmis}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded text-xs font-semibold">Ara</button>
            <button onClick={resetFilters}
              className="px-3 py-1.5 bg-bg-3 text-zinc-400 hover:text-white rounded text-xs">Sıfırla</button>
            {gecmisTotal > 0 && (
              <span className="text-[10px] text-zinc-600 ml-auto self-end pb-1">{gecmisTotal} kayıt</span>
            )}
          </div>

          {gecmisLoading ? (
            <div className="text-zinc-600 text-xs text-center py-8">Yükleniyor...</div>
          ) : gecmis.length === 0 ? (
            <div className="bg-bg-2 border border-border rounded-xl p-8 text-center text-zinc-600 text-sm">İş emri hazırlama kaydı bulunamadı</div>
          ) : (
            <div className="bg-bg-2 border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border text-zinc-500">
                  <th className="text-left px-3 py-2">Sipariş No</th>
                  <th className="text-left px-3 py-2">Müşteri</th>
                  <th className="text-left px-3 py-2">Teslim</th>
                  <th className="text-left px-3 py-2">Durum</th>
                  <th className="text-left px-3 py-2">Oluşturan</th>
                  <th className="text-left px-3 py-2">Tarih</th>
                  <th className="text-left px-3 py-2">İşlem</th>
                  <th className="px-3 py-2 w-16"></th>
                </tr></thead>
                <tbody>
                  {gecmis.map(ie => (
                    <tr key={ie.id} className="border-b border-border/30 hover:bg-bg-3/30 cursor-pointer" onClick={() => gecmisDetay(ie)}>
                      <td className="px-3 py-2 font-mono text-accent text-[11px]">{ie.siparis_no}</td>
                      <td className="px-3 py-2 text-zinc-300">{ie.musteri || '—'}</td>
                      <td className="px-3 py-2 text-zinc-500 font-mono">{ie.teslim_tarihi || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          ie.durum === 'verildi'    ? 'bg-green/15 text-green' :
                          ie.durum === 'tamamlandi' ? 'bg-blue/15 text-blue' :
                          ie.durum === 'iptal'      ? 'bg-red/15 text-red' :
                          'bg-amber/15 text-amber'
                        }`}>
                          {ie.durum || 'taslak'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500">{ie.olusturan || '—'}</td>
                      <td className="px-3 py-2 text-zinc-500 font-mono">{ie.olusturma || '—'}</td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        {ie.durum === 'verildi' && (
                          <div className="flex gap-1">
                            <button
                              disabled={islemYapiliyor}
                              onClick={() => tamamlandiYap(ie)}
                              title="Tamamlandı olarak işaretle"
                              className="flex items-center gap-1 px-2 py-1 bg-blue/15 text-blue hover:bg-blue/30 rounded text-[10px] font-semibold disabled:opacity-40"
                            >
                              <Check size={10} /> Tamam
                            </button>
                            <button
                              disabled={islemYapiliyor}
                              onClick={() => { setIptalHedef(ie); setIptalNeden(''); setIptalModalAcik(true) }}
                              title="İptal et"
                              className="flex items-center gap-1 px-2 py-1 bg-red/15 text-red hover:bg-red/30 rounded text-[10px] font-semibold disabled:opacity-40"
                            >
                              <X size={10} /> İptal
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setDuzenleIe(ie) }}
                          className="p-1 text-zinc-500 hover:text-accent"
                          title="Düzenle"
                        >
                          <Pencil size={12} />
                        </button>
                        <ChevronRight size={13} className="inline ml-1 text-zinc-600" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              {gecmisTotal > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Sayfa {gecmisPage} / {Math.ceil(gecmisTotal / PAGE_SIZE)}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => goPage(gecmisPage - 1)} disabled={gecmisPage <= 1}
                      className="px-2.5 py-1 bg-bg-3 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30">‹ Önceki</button>
                    <button onClick={() => goPage(gecmisPage + 1)} disabled={gecmisPage >= Math.ceil(gecmisTotal / PAGE_SIZE)}
                      className="px-2.5 py-1 bg-bg-3 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30">Sonraki ›</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* İptal modal */}
          {iptalModalAcik && iptalHedef && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setIptalModalAcik(false)}>
              <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h2 className="text-base font-semibold mb-1">İş Emri İptal</h2>
                <p className="text-xs text-zinc-500 mb-4 font-mono">{iptalHedef.siparis_no}</p>
                <label className="text-[10px] text-zinc-500 font-mono block mb-1">İPTAL NEDENİ *</label>
                <textarea
                  value={iptalNeden}
                  onChange={e => setIptalNeden(e.target.value)}
                  rows={3}
                  placeholder="İptal nedenini yazın..."
                  className="w-full px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent resize-none"
                />
                <div className="flex gap-2 justify-end mt-4">
                  <button onClick={() => setIptalModalAcik(false)} className="px-4 py-2 bg-bg-3 text-zinc-400 hover:text-white rounded-lg text-xs">Vazgeç</button>
                  <button
                    disabled={islemYapiliyor || !iptalNeden.trim()}
                    onClick={() => iptalYap(iptalHedef, iptalNeden)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red/80 hover:bg-red text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X size={12} /> {islemYapiliyor ? 'İptal ediliyor...' : 'İptal Et'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Detay modal */}
          {detayAcik && secilenIe && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setDetayAcik(false)}>
              <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-semibold font-mono text-accent">{secilenIe.siparis_no}</h2>
                    <p className="text-xs text-zinc-500">{secilenIe.musteri} · Teslim: {secilenIe.teslim_tarihi || '—'} · {secilenIe.ie_verildi_by}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportExcel({ siparis_no: secilenIe.siparis_no, musteri: secilenIe.musteri || '', teslim_tarihi: secilenIe.teslim_tarihi || '' }, detayHm, detayIst)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300 hover:text-white"
                    >
                      <Download size={12} /> Excel
                    </button>
                    <button onClick={() => setDetayAcik(false)} className="text-zinc-500 hover:text-white text-lg">✕</button>
                  </div>
                </div>

                {secilenIe.durum === 'iptal' && secilenIe.iptal_neden && (
                  <div className="mb-4 px-4 py-2.5 bg-red/10 border border-red/20 rounded-lg">
                    <p className="text-xs text-red font-semibold">İptal Nedeni: {secilenIe.iptal_neden}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {secilenIe.iptal_by} · {secilenIe.iptal_at ? new Date(secilenIe.iptal_at).toLocaleString('tr-TR') : ''}
                    </p>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Ürün Kalemleri</h3>
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border text-zinc-500">
                      <th className="text-left px-3 py-2">Ürün Kodu</th>
                      <th className="text-left px-3 py-2">Ürün Adı</th>
                      <th className="text-right px-3 py-2">Adet</th>
                      <th className="text-center px-3 py-2">UYS Sipariş Açıldı</th>
                      <th className="text-left px-3 py-2">UYS Sipariş No</th>
                    </tr></thead>
                    <tbody>
                      {secilenKalemler.map(k => (
                        <tr key={k.id} className="border-b border-border/30">
                          <td className="px-3 py-1.5 font-mono text-accent text-[11px]">{k.urun_kodu}</td>
                          <td className="px-3 py-1.5 text-zinc-300">{k.urun_adi || k.urun_kodu}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{k.siparis_adeti}</td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => toggleSiparisAcildi(k)} className={`p-1 ${k.siparis_acildi ? 'text-green' : 'text-zinc-600 hover:text-zinc-400'}`}>
                              {k.siparis_acildi ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              defaultValue={k.uys_siparis_no || ''}
                              onBlur={e => kaydetUysSiparisNo(k, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              placeholder="—"
                              className="w-32 px-2 py-1 bg-bg-3 border border-border rounded text-[10px] font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {detayKalemler.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <HammaddePanel hmIhtiyac={detayHm} />
                    <IstasyonPanel istasyonlar={detayIst} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Başlık düzenleme modal */}
          {duzenleIe && (
            <BaslikDuzenleModal
              ie={duzenleIe}
              onClose={() => setDuzenleIe(null)}
              onSave={baslikKaydet}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Başlık Düzenleme Modal ───────────────────────────────────
function BaslikDuzenleModal({ ie, onClose, onSave }: {
  ie: IeBaslik
  onClose: () => void
  onSave: (data: { siparis_no: string; musteri: string; siparis_tarihi: string; teslim_tarihi: string; not_: string }) => Promise<void>
}) {
  const [siparisNo, setSiparisNo] = useState(ie.siparis_no)
  const [musteri, setMusteri] = useState(ie.musteri || '')
  const [siparisTarihi, setSiparisTarihi] = useState(ie.siparis_tarihi || '')
  const [teslimTarihi, setTeslimTarihi] = useState(ie.teslim_tarihi || '')
  const [not_, setNot] = useState(ie.not_ || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const _s = _uysSiparisNoSchema.safeParse(siparisNo)
    if (!_s.success) return toast.error(_s.error.issues[0].message)
    setSaving(true)
    await onSave({ siparis_no: _s.data, musteri, siparis_tarihi: siparisTarihi, teslim_tarihi: teslimTarihi, not_ })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">İE Başlık Düzenle</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-zinc-500 font-mono block mb-1">SİPARİŞ NO *</label>
            <input value={siparisNo} onChange={e => setSiparisNo(e.target.value)} autoFocus
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-mono block mb-1">MÜŞTERİ</label>
            <input value={musteri} onChange={e => setMusteri(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 font-mono block mb-1">SİPARİŞ TARİHİ</label>
              <input type="date" value={siparisTarihi} onChange={e => setSiparisTarihi(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 font-mono block mb-1">TESLİM TARİHİ</label>
              <input type="date" value={teslimTarihi} onChange={e => setTeslimTarihi(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 font-mono block mb-1">NOT</label>
            <input value={not_} onChange={e => setNot(e.target.value)}
              className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={handleSave} disabled={saving || !siparisNo.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-40">
            <Check size={13} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BOM Satır Düzenleme Modal ────────────────────────────────
function BomDuzenleModal({ satir, onClose, onSaved }: {
  satir: BomSatir
  onClose: () => void
  onSaved: (updated: BomSatir) => void
}) {
  const [birimAdet, setBirimAdet] = useState(satir.birim_adet ? String(satir.birim_adet) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const _r = _birimAdetSchema.safeParse(birimAdet)
    if (!_r.success) return toast.error(_r.error.issues[0].message)
    const val = _r.data
    setSaving(true)
    const { error } = await supabase.from('uys_rapido_bom').update({ birim_adet: val }).eq('id', satir.id)
    if (error) { toast.error('Kayıt hatası: ' + error.message); setSaving(false); return }
    toast.success('BOM satırı güncellendi')
    onSaved({ ...satir, birim_adet: val })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">BOM Satırı Düzenle</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-2 mb-4 p-3 bg-bg-2 rounded-lg text-xs text-zinc-400">
          <div className="flex justify-between"><span className="text-zinc-600">Ürün Kodu</span><span className="font-mono text-accent">{satir.urun_kodu}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">İstasyon</span><span>{satir.is_istasyonu || '—'}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">HM Kodu</span><span className="font-mono">{satir.hammadde_kodu}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">Kesim (mm)</span><span className="font-mono">{satir.kesim_olc_mm}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">HM Uzunluk (mm)</span><span className="font-mono">{satir.hm_uzunluk_mm}</span></div>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 font-mono block mb-1">BİRİM ADET *</label>
          <input
            type="number" min={1} value={birimAdet}
            onChange={e => setBirimAdet(e.target.value)}
            autoFocus
            placeholder="Kaç adet kesim gerekiyor?"
            className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
          />
          <p className="text-[10px] text-zinc-600 mt-1">1 ürün birimini üretmek için bu kesimden kaç adet gerekiyor</p>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={handleSave} disabled={saving || !birimAdet || parseInt(birimAdet) <= 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-40">
            <Check size={13} /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── BOM Ürün Düzenle (Çoklu Satır) ──────────────────────────
// Bir ürünün tüm BOM satırlarını listeler; üç sayısal alan inline edit.
// Kaydet → yalnızca değişen satırlar UPDATE; parent bom state'i patch ile yansıtılır.
function BomUrunDuzenleModal({ bom, onClose, onSaved }: {
  bom: BomSatir[]
  onClose: () => void
  onSaved: (updated: BomSatir[]) => void
}) {
  const [arama, setArama] = useState('')
  const [secilenUrun, setSecilenUrun] = useState('')
  const [rows, setRows] = useState<BomSatir[]>([])
  const [saving, setSaving] = useState(false)

  const urunler = useMemo(() => {
    const m = new Map<string, { kodu: string; adi: string }>()
    for (const b of bom) {
      if (!m.has(b.urun_kodu)) m.set(b.urun_kodu, { kodu: b.urun_kodu, adi: b.urun_adi })
    }
    return [...m.values()].sort((a, b) => a.adi.localeCompare(b.adi, 'tr'))
  }, [bom])

  const filtreli = useMemo(() => {
    if (!arama || secilenUrun) return []
    const q = arama.toLowerCase()
    return urunler.filter(u => u.kodu.toLowerCase().includes(q) || u.adi.toLowerCase().includes(q))
  }, [urunler, arama, secilenUrun])

  function urunSec(kodu: string, adi: string) {
    setSecilenUrun(kodu)
    setArama(kodu + ' — ' + adi)
    setRows(bom.filter(b => b.urun_kodu === kodu).map(b => ({ ...b })))
  }

  function alanGuncelle(idx: number, alan: 'birim_adet' | 'kesim_olc_mm' | 'hm_uzunluk_mm', deger: string) {
    const sayi = parseFloat(deger)
    const val = isNaN(sayi) ? 0 : sayi
    const clamped = (alan === 'kesim_olc_mm' || alan === 'hm_uzunluk_mm') ? Math.max(0, val) : val
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [alan]: clamped } : r))
  }

  const degisenler = useMemo(() => {
    if (!secilenUrun) return []
    const original = bom.filter(b => b.urun_kodu === secilenUrun)
    return rows.filter(r => {
      const o = original.find(x => x.id === r.id)
      if (!o) return false
      return o.birim_adet !== r.birim_adet || o.kesim_olc_mm !== r.kesim_olc_mm || o.hm_uzunluk_mm !== r.hm_uzunluk_mm
    })
  }, [rows, bom, secilenUrun])

  const gecersizSatir = rows.some(r => r.birim_adet <= 0 || r.kesim_olc_mm < 0 || r.hm_uzunluk_mm < 0)

  async function kaydet() {
    const ilkHatalı = rows.find(r => !_bomUrunSatirSchema.safeParse({ birim_adet: r.birim_adet, kesim_olc_mm: r.kesim_olc_mm, hm_uzunluk_mm: r.hm_uzunluk_mm }).success)
    if (ilkHatalı) {
      const _c = _bomUrunSatirSchema.safeParse({ birim_adet: ilkHatalı.birim_adet, kesim_olc_mm: ilkHatalı.kesim_olc_mm, hm_uzunluk_mm: ilkHatalı.hm_uzunluk_mm })
      toast.error((!_c.success && _c.error.issues[0].message) || 'Geçersiz satır değeri')
      return
    }
    if (degisenler.length === 0) {
      toast.info('Değişiklik yok')
      return
    }
    setSaving(true)
    try {
      const guncelleme = new Date().toISOString()
      const results = await Promise.all(degisenler.map(r =>
        supabase.from('uys_rapido_bom')
          .update({ birim_adet: r.birim_adet, kesim_olc_mm: r.kesim_olc_mm, hm_uzunluk_mm: r.hm_uzunluk_mm, guncelleme })
          .eq('id', r.id)
      ))
      const hatalar = results.filter(r => r.error)
      if (hatalar.length > 0) {
        toast.error(`${hatalar.length} satır kaydedilemedi: ` + (hatalar[0].error?.message || ''))
        return
      }
      onSaved(degisenler)
      toast.success(`${degisenler.length} satır güncellendi`)
      onClose()
    } catch (e: any) {
      toast.error('Kayıt hatası: ' + (e?.message || e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">🔧 BOM Düzenle — Ürün bazında</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <input
              value={arama}
              onChange={e => { setArama(e.target.value); setSecilenUrun(''); setRows([]) }}
              placeholder={`Ürün kodu / adı ara (${urunler.length} ürün)...`}
              className="w-full px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
            />
            {filtreli.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {filtreli.slice(0, 40).map(u => (
                  <button key={u.kodu}
                    onClick={() => urunSec(u.kodu, u.adi)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-2 border-b border-border/30 last:border-0">
                    <span className="font-mono text-accent text-[11px]">{u.kodu}</span>
                    <span className="ml-2 text-zinc-400">{u.adi}</span>
                  </button>
                ))}
                {filtreli.length > 40 && <div className="px-3 py-1.5 text-[10px] text-zinc-600">+{filtreli.length - 40} daha...</div>}
              </div>
            )}
          </div>

          {secilenUrun && rows.length > 0 && (
            <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-border bg-bg-3/50 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-300">{rows.length} satır</div>
                <div className="text-[10px] text-zinc-500">{degisenler.length} değişiklik bekliyor</div>
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border text-zinc-500">
                    <th className="text-left px-3 py-2">HM Kodu</th>
                    <th className="text-left px-3 py-2">HM Adı</th>
                    <th className="text-left px-3 py-2">İstasyon</th>
                    <th className="text-right px-3 py-2">Kesim (mm)</th>
                    <th className="text-right px-3 py-2">1 HM'den Adet</th>
                    <th className="text-right px-3 py-2">HM Uzunluk (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const gecersiz = r.birim_adet <= 0
                    return (
                      <tr key={r.id} className={`border-b border-border/30 ${gecersiz ? 'bg-red/10' : ''}`}>
                        <td className="px-3 py-1.5 font-mono text-accent text-[10px]">{r.hammadde_kodu}</td>
                        <td className="px-3 py-1.5 text-zinc-400">{r.hammadde_adi}</td>
                        <td className="px-3 py-1.5 text-zinc-500 text-[10px]">{r.is_istasyonu}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min={0} step="0.01" value={r.kesim_olc_mm}
                            onChange={e => alanGuncelle(idx, 'kesim_olc_mm', e.target.value)}
                            className="w-24 px-2 py-1 bg-bg-3 border border-border rounded text-[10px] text-zinc-200 text-right font-mono focus:outline-none focus:border-accent" />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min={0.01} step="0.01" value={r.birim_adet}
                            onChange={e => alanGuncelle(idx, 'birim_adet', e.target.value)}
                            className={`w-20 px-2 py-1 bg-bg-3 border rounded text-[10px] text-right font-mono focus:outline-none ${gecersiz ? 'border-red text-red' : 'border-border text-zinc-200 focus:border-accent'}`} />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min={0} step="1" value={r.hm_uzunluk_mm}
                            onChange={e => alanGuncelle(idx, 'hm_uzunluk_mm', e.target.value)}
                            className="w-24 px-2 py-1 bg-bg-3 border border-border rounded text-[10px] text-zinc-200 text-right font-mono focus:outline-none focus:border-accent" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {secilenUrun && rows.length === 0 && (
            <div className="p-4 text-center text-xs text-zinc-500">Bu ürün için BOM satırı yok.</div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-300 hover:text-white">İptal</button>
          <button onClick={kaydet} disabled={saving || gecersizSatir || degisenler.length === 0}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Kaydediliyor...' : `Kaydet${degisenler.length > 0 ? ` (${degisenler.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Toplu Ekle ───────────────────────────────────────────────
function newSlot(): TopluSlot {
  return { id: uid(), urunKodu: '', urunAdi: '', adet: 1, arama: '' }
}

function TopluEkleModal({
  urunler,
  onEkle,
  onClose,
}: {
  urunler: { kodu: string; adi: string }[]
  onEkle: (slots: TopluSlot[]) => void
  onClose: () => void
}) {
  const [slotlar, setSlotlar] = useState<TopluSlot[]>([newSlot(), newSlot(), newSlot()])
  const [activeId, setActiveId] = useState<string | null>(null)

  function update(id: string, patch: Partial<TopluSlot>) {
    setSlotlar(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }
  function secUrun(id: string, u: { kodu: string; adi: string }) {
    update(id, { urunKodu: u.kodu, urunAdi: u.adi, arama: `${u.kodu} — ${u.adi}` })
    setActiveId(null)
  }
  function slotEkle() {
    setSlotlar(prev => [...prev, newSlot()])
    setTimeout(() => {
      const els = document.querySelectorAll('[data-toplu-arama]')
      const last = els[els.length - 1] as HTMLInputElement | null
      last?.focus()
    }, 50)
  }
  function slotSil(id: string) {
    setSlotlar(prev => prev.filter(s => s.id !== id))
  }
  const gecerliSayisi = slotlar.filter(s => s.urunKodu && s.adet > 0).length

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg-1">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-base font-semibold">Toplu Ürün Ekle</h2>
          <p className="text-[11px] text-zinc-500 mt-0.5">Birden fazla ürün seçip tek seferde ekle</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {slotlar.map((slot, idx) => {
          const filtreliler = slot.arama && !slot.urunKodu
            ? urunler.filter(u =>
                u.kodu.toLowerCase().includes(slot.arama.toLowerCase()) ||
                u.adi.toLowerCase().includes(slot.arama.toLowerCase())
              ).slice(0, 40)
            : []
          const showDrop = activeId === slot.id && filtreliler.length > 0
          return (
            <div key={slot.id} className="bg-bg-2 border border-border rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 font-mono w-5 shrink-0">{idx + 1}</span>
                <div className="relative flex-1">
                  <input
                    data-toplu-arama
                    value={slot.arama}
                    placeholder="Ürün kodu / adı ara..."
                    onChange={e => { update(slot.id, { arama: e.target.value, urunKodu: '', urunAdi: '' }); setActiveId(slot.id) }}
                    onFocus={() => { if (!slot.urunKodu && slot.arama) setActiveId(slot.id) }}
                    onBlur={() => setTimeout(() => setActiveId(null), 150)}
                    className={`w-full px-3 py-2 bg-bg-3 border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-accent ${slot.urunKodu ? 'border-green/40' : 'border-border'}`}
                  />
                  {showDrop && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-bg-1 border border-border rounded-lg shadow-xl max-h-44 overflow-y-auto">
                      {filtreliler.map(u => (
                        <button key={u.kodu} onMouseDown={() => secUrun(slot.id, u)}
                          className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-bg-2 border-b border-border/30 last:border-0">
                          <span className="font-mono text-accent text-[11px]">{u.kodu}</span>
                          <span className="ml-2 text-zinc-400">{u.adi}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="number" min={1} value={slot.adet}
                  onChange={e => update(slot.id, { adet: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-20 px-3 py-2 bg-bg-3 border border-border rounded-lg text-xs text-zinc-200 text-center focus:outline-none focus:border-accent"
                />
                <button onClick={() => slotSil(slot.id)} className="p-1.5 text-zinc-600 hover:text-red shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              {slot.urunAdi && (
                <div className="mt-1.5 ml-7 text-[10px] text-green/70 font-mono truncate">✓ {slot.urunAdi}</div>
              )}
            </div>
          )
        })}
        <button onClick={slotEkle}
          className="w-full py-2 border border-dashed border-border rounded-xl text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 flex items-center justify-center gap-1.5">
          <Plus size={12} /> Yeni Satır
        </button>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
        <span className="text-[11px] text-zinc-500">
          {gecerliSayisi > 0 ? `${gecerliSayisi} ürün seçili` : 'Henüz ürün seçilmedi'}
        </span>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 hover:text-white rounded-lg text-xs">İptal</button>
          <button onClick={() => onEkle(slotlar)} disabled={gecerliSayisi === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            <CheckSquare size={13} /> Ekle ({gecerliSayisi} ürün)
          </button>
        </div>
      </div>
    </div>
  )
}
