// v15.92 — Madde 15 P2: Mamul Cikis 2-asama Modal
// Saha modeli §25: Manuel cikis sirasinda rezerv'e dokunulacaksa
//   - Aşama 1: Rezerv durum gosterimi + miktar girisi
//   - Aşama 2 (rezerv'e dokunulacaksa): Sebep dropdown + aciklama zorunlu
//
// Cikis kaydedilirken:
//   - Normal cikis: uys_stok_hareketler insert (mevcut akis)
//   - Manuel mudahale: + uys_manuel_mudahale_log insert + uys_bildirimler insert (kirmizi)

import { useState, useMemo } from 'react'
import { X, AlertTriangle, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { hesaplaMamulRezervDurum } from '@/features/production/mamulRezerv'
import type { StokHareket } from '@/types'

const SEBEP_SECENEKLERI = [
  'Acil siparis ihtiyaci',
  'Iade / musteri red',
  'Hatali rezerv',
  'Numune / demo',
  'Diger',
]

interface OrderLite {
  id: string
  siparisNo: string
  musteri: string
  termin?: string
}

interface Props {
  malkod: string
  malad: string
  hareketler: StokHareket[]
  orders: OrderLite[]
  // Yetki + kullanici bilgisi
  canManuelMudahale: boolean
  currentUserId: string
  currentUserAd: string
  onClose: () => void
  onSaved: () => void
}

export function MamulCikisModal({
  malkod, malad, hareketler, orders,
  canManuelMudahale, currentUserId, currentUserAd,
  onClose, onSaved,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [miktarStr, setMiktarStr] = useState('')
  const [aciklama, setAciklama] = useState('')
  const [sebep, setSebep] = useState('')
  const [mudahaleAciklama, setMudahaleAciklama] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const durum = useMemo(
    () => hesaplaMamulRezervDurum(malkod, hareketler, orders),
    [malkod, hareketler, orders]
  )

  const miktar = parseFloat(miktarStr) || 0
  const rezerveCeker = miktar > durum.serbestMiktar
  const fazlaCikar = miktar > durum.toplamStok

  const tahsis = useMemo(() => {
    // FIFO termin: hangi siparislerden ne kadar cekilecek
    if (!rezerveCeker || miktar <= 0) return []
    let kalan = miktar - durum.serbestMiktar
    const out: Array<{ orderId: string; siparisNo: string; musteri: string; termin: string; cek: number }> = []
    for (const r of durum.rezervDetay) {
      if (kalan <= 0) break
      const cek = Math.min(kalan, r.miktar)
      out.push({ orderId: r.orderId, siparisNo: r.siparisNo, musteri: r.musteri, termin: r.termin, cek })
      kalan -= cek
    }
    return out
  }, [miktar, rezerveCeker, durum])

  function step1Devam() {
    setError('')
    if (miktar <= 0) { setError('Miktar gerekli'); return }
    if (fazlaCikar) {
      setError(`Cikis miktari (${miktar}) toplam stoktan (${durum.toplamStok}) buyuk olamaz`)
      return
    }
    if (!rezerveCeker) {
      // Sadece serbestten cikis - direkt kaydet
      kaydetSerbest()
      return
    }
    if (!canManuelMudahale) {
      setError('Bu cikis rezerve dokunuyor. "Manuel mudahale" yetkin yok.')
      return
    }
    setStep(2)
  }

  async function kaydetSerbest() {
    setSaving(true)
    try {
      const harId = uid()
      const { error: insErr } = await supabase.from('uys_stok_hareketler').insert({
        id: harId, tarih: today(),
        malkod, malad,
        miktar, tip: 'cikis',
        aciklama: aciklama || 'Manuel cikis',
      })
      if (insErr) throw insErr
      onSaved()
    } catch (e: any) {
      setError('Kayit hatasi: ' + (e.message || e))
      setSaving(false)
    }
  }

  async function kaydetMudahale() {
    setError('')
    if (!sebep) { setError('Sebep secimi zorunlu'); return }
    if (mudahaleAciklama.trim().length < 10) {
      setError('Aciklama en az 10 karakter olmali (zorunlu)')
      return
    }
    setSaving(true)
    try {
      const harId = uid()
      // Stok hareket insert (cikis + rezerv kirma notu)
      const ilkRezerv = tahsis[0]
      const { error: harErr } = await supabase.from('uys_stok_hareketler').insert({
        id: harId, tarih: today(),
        malkod, malad,
        miktar, tip: 'cikis',
        aciklama: `MUDAHALE: ${sebep} | ${mudahaleAciklama.slice(0, 100)}`,
        // rezerv_order_id NULL kaliyor cikiste (giris-rezerv eslemesi)
      })
      if (harErr) throw harErr

      // Manuel mudahale log
      const logId = uid()
      const { error: logErr } = await supabase.from('uys_manuel_mudahale_log').insert({
        id: logId, tarih: new Date().toISOString(),
        kullanici_id: currentUserId,
        kullanici_ad: currentUserAd,
        islem_tipi: 'rezerv_kirma',
        malkod, malad, miktar,
        rezerv_order_id: ilkRezerv?.orderId || null,
        rezerv_siparis_no: ilkRezerv?.siparisNo || null,
        sebep, aciklama: mudahaleAciklama,
        stok_hareket_id: harId,
      })
      if (logErr) throw logErr

      // Bildirim olustur (kirmizi - rezerv ihlali)
      for (const t of tahsis) {
        await supabase.from('uys_bildirimler').insert({
          id: uid(),
          tip: 'kirmizi',
          kategori: 'rezerv_ihlali',
          baslik: 'Rezerv ihlali',
          mesaj: `${t.siparisNo} (${t.musteri}) icin rezerv ${malad} - ${t.cek} adet manuel cekildi. Sebep: ${sebep}`,
          ref_id: t.orderId,
          ref_tip: 'order',
          olusturan: currentUserAd,
        })
      }

      onSaved()
    } catch (e: any) {
      setError('Kayit hatasi: ' + (e.message || e))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            {step === 1
              ? <span className="text-amber font-semibold">Adim 1/2</span>
              : <AlertTriangle size={18} className="text-red" />}
            <h3 className="text-base font-semibold">
              {step === 1 ? 'Mamul Cikis' : 'Manuel Mudahale Onayi'}
            </h3>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-bg-2 rounded-lg p-3">
              <div className="text-[11px] text-zinc-500 mb-1">Malzeme</div>
              <div className="text-sm font-mono text-accent">{malkod}</div>
              <div className="text-xs text-zinc-300 mt-0.5">{malad}</div>
            </div>

            {/* Stok ozet */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-bg-2 rounded-lg p-3">
                <div className="text-[11px] text-zinc-500">Toplam Stok</div>
                <div className="text-lg font-mono font-semibold">{durum.toplamStok}</div>
              </div>
              <div className="bg-amber/10 border border-amber/30 rounded-lg p-3">
                <div className="text-[11px] text-amber">Rezerv</div>
                <div className="text-lg font-mono font-semibold text-amber">{durum.rezervToplam}</div>
              </div>
              <div className="bg-green/10 border border-green/30 rounded-lg p-3">
                <div className="text-[11px] text-green">Serbest</div>
                <div className="text-lg font-mono font-semibold text-green">{durum.serbestMiktar}</div>
              </div>
            </div>

            {/* Rezerv detay */}
            {durum.rezervDetay.length > 0 && (
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">Rezerv Detay (FIFO termin sirasi)</div>
                <div className="bg-bg-2 rounded-lg divide-y divide-border max-h-32 overflow-y-auto">
                  {durum.rezervDetay.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                      <div>
                        <div className="font-mono text-accent">{r.siparisNo}</div>
                        <div className="text-zinc-500 text-[10px]">{r.musteri} · {r.termin || '(termin yok)'}</div>
                      </div>
                      <div className="font-mono text-amber">{r.miktar}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Cikis Miktari *</label>
                <input
                  type="number" min={0.01} step="any"
                  value={miktarStr} onChange={e => setMiktarStr(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500 mb-1 block">Aciklama</label>
                <input
                  value={aciklama} onChange={e => setAciklama(e.target.value)}
                  placeholder="Opsiyonel..."
                  className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm"
                />
              </div>
            </div>

            {rezerveCeker && (
              <div className="bg-red/10 border border-red/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-red mb-1">Rezerv'e dokuluyor</div>
                  <div className="text-zinc-300">
                    Bu cikis serbest stok'tan ({durum.serbestMiktar}) fazla. Devam edersen
                    {' '}<span className="text-red font-semibold">{(miktar - durum.serbestMiktar).toFixed(2)}</span> adet
                    rezerv kirilacak. FIFO termin sirasi:
                  </div>
                  <ul className="mt-1 ml-4 list-disc text-zinc-400 text-[11px]">
                    {tahsis.map((t, i) => (
                      <li key={i}>{t.siparisNo} ({t.musteri}, {t.termin || '-'}) — {t.cek} adet</li>
                    ))}
                  </ul>
                  {!canManuelMudahale && (
                    <div className="mt-2 flex items-center gap-1 text-red font-semibold">
                      <Lock size={12} /> Yetki yok (manuel_mudahale_yap)
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <div className="text-xs text-red bg-red/10 border border-red/30 rounded p-2">{error}</div>}
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-red/10 border border-red/30 rounded-lg p-3 text-xs">
              <div className="font-semibold text-red mb-1">Manuel Mudahale</div>
              <div className="text-zinc-300">
                {miktar} adet {malad} - rezerv kirilacak.
              </div>
              <ul className="mt-1 ml-4 list-disc text-zinc-400 text-[11px]">
                {tahsis.map((t, i) => (
                  <li key={i}>{t.siparisNo} - {t.cek} adet</li>
                ))}
              </ul>
            </div>

            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">Sebep *</label>
              <select
                value={sebep} onChange={e => setSebep(e.target.value)}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm"
              >
                <option value="">Sec...</option>
                {SEBEP_SECENEKLERI.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] text-zinc-500 mb-1 block">
                Aciklama * <span className="text-zinc-600">(min 10 karakter, audit log'a yazilir)</span>
              </label>
              <textarea
                value={mudahaleAciklama} onChange={e => setMudahaleAciklama(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm"
                placeholder="Neden rezerve dokunulduğunu detaylica yaz..."
              />
              <div className="text-[10px] text-zinc-500 mt-1">{mudahaleAciklama.length} / min 10</div>
            </div>

            {error && <div className="text-xs text-red bg-red/10 border border-red/30 rounded p-2">{error}</div>}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-border">
          <div className="text-[11px] text-zinc-500">
            {step === 1 && rezerveCeker && canManuelMudahale && 'Sonraki adim: sebep ve aciklama'}
            {step === 1 && !rezerveCeker && 'Serbest stoktan direkt cikis'}
            {step === 2 && 'Audit log\'a yazilir, geri alinmaz'}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving}
              className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400 hover:text-white">
              Iptal
            </button>
            {step === 1 && (
              <button onClick={step1Devam} disabled={saving || !miktar}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${rezerveCeker
                  ? 'bg-red/15 border border-red/30 text-red hover:bg-red/25'
                  : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25'
                }`}>
                {rezerveCeker ? 'Mudahale ile Devam' : 'Cikisi Kaydet'}
              </button>
            )}
            {step === 2 && (
              <>
                <button onClick={() => setStep(1)} disabled={saving}
                  className="px-3 py-1.5 bg-bg-2 border border-border rounded-lg text-xs text-zinc-400">
                  Geri
                </button>
                <button onClick={kaydetMudahale} disabled={saving}
                  className="px-4 py-1.5 bg-red/15 border border-red/30 text-red rounded-lg text-xs font-semibold hover:bg-red/25">
                  Onayla ve Cik
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
