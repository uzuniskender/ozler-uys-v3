// src/pages/HmTipleri.tsx
// Hammadde tipleri yönetim sayfası

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Power, Trash2, Search, X, Loader2, AlertCircle,
} from 'lucide-react'

import type { HmTipi, HmTipiInsert, HmTipiUpdate, VarsayilanBirim } from '@/types/hmTipi'
import { VARSAYILAN_BIRIM_SECENEKLERI, HM_TIPI_KURALLAR } from '@/types/hmTipi'
import {
  listHmTipleri,
  createHmTipi,
  updateHmTipi,
  togglePasif,
  deleteHmTipi,
  kodVarMi,
} from '@/services/hmTipleriService'
import { useAuth } from '@/hooks/useAuth'

// =============================================================
// SAYFA
// =============================================================

export function HmTipleri() {
  const { can, user } = useAuth()
  const kullaniciAd = user?.username ?? null

  const [tipler, setTipler] = useState<HmTipi[]>([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [hata, setHata] = useState<string | null>(null)
  const [arama, setArama] = useState('')
  const [sadeceAktif, setSadeceAktif] = useState(false)

  const [modalAcik, setModalAcik] = useState(false)
  const [duzenlenen, setDuzenlenen] = useState<HmTipi | null>(null)

  const [silmeOnay, setSilmeOnay] = useState<HmTipi | null>(null)

  useEffect(() => { yukle() }, [])

  async function yukle() {
    try {
      setYukleniyor(true)
      setHata(null)
      const veri = await listHmTipleri()
      setTipler(veri)
    } catch (e) {
      setHata((e as Error).message)
    } finally {
      setYukleniyor(false)
    }
  }

  const goruntulenen = useMemo(() => {
    let s = tipler
    if (sadeceAktif) s = s.filter((t) => t.aktif)
    if (arama.trim()) {
      const q = arama.trim().toLowerCase()
      s = s.filter(
        (t) =>
          t.kod.toLowerCase().includes(q) ||
          t.ad.toLowerCase().includes(q) ||
          (t.aciklama?.toLowerCase().includes(q) ?? false),
      )
    }
    return s
  }, [tipler, arama, sadeceAktif])

  async function aktifPasifDegistir(tip: HmTipi) {
    try {
      await togglePasif(tip.id, kullaniciAd)
      await yukle()
    } catch (e) {
      alert('Durum değiştirilemedi: ' + (e as Error).message)
    }
  }

  async function silmeyiOnayla() {
    if (!silmeOnay) return
    try {
      await deleteHmTipi(silmeOnay.id)
      setSilmeOnay(null)
      await yukle()
    } catch (e) {
      alert(
        'Silinemedi: ' +
          (e as Error).message +
          '\n(Bağlı stok kayıtları olabilir. Silmek yerine Pasif yapmayı düşün.)',
      )
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Başlık */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-medium text-zinc-100">Hammadde tipleri</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Stok ve reçetelerde kullanılan HM sınıflandırması
          </p>
        </div>
        {can('hmt_add') && (
          <button
            onClick={() => { setDuzenlenen(null); setModalAcik(true) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-sm hover:bg-accent/90"
          >
            <Plus size={16} /> Yeni tip
          </button>
        )}
      </div>

      {/* Filtreler */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder="Kod, ad veya açıklama..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-bg-2 border border-border rounded-md focus:outline-none focus:border-accent text-zinc-200"
          />
          {arama && (
            <button
              onClick={() => setArama('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={sadeceAktif}
            onChange={(e) => setSadeceAktif(e.target.checked)}
            className="rounded"
          />
          Sadece aktif
        </label>
      </div>

      {/* Hata */}
      {hata && (
        <div className="flex items-center gap-2 p-3 bg-red/10 text-red rounded-md text-sm">
          <AlertCircle size={16} /> {hata}
        </div>
      )}

      {/* Yükleniyor */}
      {yukleniyor ? (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : (
        /* Tablo */
        <div className="bg-bg-1 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-zinc-400">
              <tr>
                <th className="text-left font-medium px-3 py-2.5 w-24">Kod</th>
                <th className="text-left font-medium px-3 py-2.5 w-40">Ad</th>
                <th className="text-left font-medium px-3 py-2.5">Açıklama</th>
                <th className="text-left font-medium px-3 py-2.5 w-28">Birim</th>
                <th className="text-center font-medium px-3 py-2.5 w-16">Sıra</th>
                <th className="text-center font-medium px-3 py-2.5 w-20">Durum</th>
                <th className="text-right font-medium px-3 py-2.5 w-28">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {goruntulenen.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-zinc-500">
                    {arama || sadeceAktif ? 'Eşleşen kayıt yok' : 'Henüz kayıt yok'}
                  </td>
                </tr>
              ) : (
                goruntulenen.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-3 py-2.5 font-mono text-xs text-zinc-200">{t.kod}</td>
                    <td className="px-3 py-2.5 text-zinc-200">{t.ad}</td>
                    <td className="px-3 py-2.5 text-zinc-500">{t.aciklama ?? '—'}</td>
                    <td className="px-3 py-2.5 text-zinc-400">
                      {VARSAYILAN_BIRIM_SECENEKLERI.find((b) => b.value === t.varsayilan_birim)?.label}
                    </td>
                    <td className="px-3 py-2.5 text-center text-zinc-500">{t.sira}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={
                          'inline-block px-2 py-0.5 rounded-md text-xs ' +
                          (t.aktif
                            ? 'bg-green/15 text-green'
                            : 'bg-zinc-700/40 text-zinc-400')
                        }
                      >
                        {t.aktif ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {can('hmt_edit') && (
                          <>
                            <button
                              onClick={() => { setDuzenlenen(t); setModalAcik(true) }}
                              title="Düzenle"
                              className="p-1.5 rounded hover:bg-bg-2 text-zinc-400"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => aktifPasifDegistir(t)}
                              title={t.aktif ? 'Pasife al' : 'Aktif yap'}
                              className="p-1.5 rounded hover:bg-bg-2 text-zinc-400"
                            >
                              <Power size={14} />
                            </button>
                          </>
                        )}
                        {can('hmt_delete') && (
                          <button
                            onClick={() => setSilmeOnay(t)}
                            title="Sil"
                            className="p-1.5 rounded hover:bg-red/10 text-red"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Toplam bilgisi */}
      {!yukleniyor && (
        <p className="text-xs text-zinc-500">
          Toplam {tipler.length} tip · {tipler.filter((t) => t.aktif).length} aktif
          {(arama || sadeceAktif) && ` · ${goruntulenen.length} gösterilen`}
        </p>
      )}

      {/* Modal */}
      {modalAcik && (
        <HmTipiModal
          tip={duzenlenen}
          kullaniciAd={kullaniciAd}
          onKapat={() => { setModalAcik(false); setDuzenlenen(null) }}
          onKaydedildi={() => { setModalAcik(false); setDuzenlenen(null); yukle() }}
        />
      )}

      {/* Silme onay dialog */}
      {silmeOnay && (
        <SilmeOnayDialog
          tip={silmeOnay}
          onVazgec={() => setSilmeOnay(null)}
          onOnayla={silmeyiOnayla}
        />
      )}
    </div>
  )
}

// =============================================================
// EKLE / DÜZENLE MODAL
// =============================================================

interface ModalProps {
  tip: HmTipi | null
  kullaniciAd: string | null
  onKapat: () => void
  onKaydedildi: () => void
}

function HmTipiModal({ tip, kullaniciAd, onKapat, onKaydedildi }: ModalProps) {
  const duzenleme = !!tip

  const [kod, setKod] = useState(tip?.kod ?? '')
  const [ad, setAd] = useState(tip?.ad ?? '')
  const [aciklama, setAciklama] = useState(tip?.aciklama ?? '')
  const [birim, setBirim] = useState<VarsayilanBirim>(tip?.varsayilan_birim ?? 'adet')
  const [sira, setSira] = useState<number>(tip?.sira ?? 0)
  const [aktif, setAktif] = useState<boolean>(tip?.aktif ?? true)

  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [hata, setHata] = useState<string | null>(null)

  const kodNormalized = kod.toUpperCase().trim()

  function dogrula(): string | null {
    if (kodNormalized.length < HM_TIPI_KURALLAR.KOD_MIN)
      return `Kod en az ${HM_TIPI_KURALLAR.KOD_MIN} karakter olmalı`
    if (kodNormalized.length > HM_TIPI_KURALLAR.KOD_MAX)
      return `Kod en fazla ${HM_TIPI_KURALLAR.KOD_MAX} karakter olabilir`
    if (!HM_TIPI_KURALLAR.KOD_REGEX.test(kodNormalized))
      return 'Kod sadece BÜYÜK harf, rakam ve _ içerebilir'
    if (ad.trim().length < HM_TIPI_KURALLAR.AD_MIN)
      return 'Ad boş olamaz'
    if (ad.trim().length > HM_TIPI_KURALLAR.AD_MAX)
      return `Ad en fazla ${HM_TIPI_KURALLAR.AD_MAX} karakter olabilir`
    if (aciklama.length > HM_TIPI_KURALLAR.ACIKLAMA_MAX)
      return `Açıklama en fazla ${HM_TIPI_KURALLAR.ACIKLAMA_MAX} karakter olabilir`
    if (sira < HM_TIPI_KURALLAR.SIRA_MIN || sira > HM_TIPI_KURALLAR.SIRA_MAX)
      return 'Sıra 0-9999 arasında olmalı'
    return null
  }

  async function kaydet() {
    const v = dogrula()
    if (v) { setHata(v); return }

    try {
      setKaydediliyor(true)
      setHata(null)

      if (!duzenleme || (tip && tip.kod !== kodNormalized)) {
        const cakisma = await kodVarMi(kodNormalized, tip?.id)
        if (cakisma) {
          setHata(`"${kodNormalized}" kodu zaten kullanılıyor`)
          setKaydediliyor(false)
          return
        }
      }

      if (duzenleme && tip) {
        const payload: HmTipiUpdate = {
          kod: kodNormalized,
          ad: ad.trim(),
          aciklama: aciklama.trim() || null,
          varsayilan_birim: birim,
          sira,
          aktif,
        }
        await updateHmTipi(tip.id, payload, kullaniciAd)
      } else {
        const payload: HmTipiInsert = {
          kod: kodNormalized,
          ad: ad.trim(),
          aciklama: aciklama.trim() || null,
          varsayilan_birim: birim,
          sira,
          aktif,
        }
        await createHmTipi(payload, kullaniciAd)
      }
      onKaydedildi()
    } catch (e) {
      setHata((e as Error).message)
      setKaydediliyor(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onKapat}
    >
      <div
        className="bg-bg-1 border border-border rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-medium text-zinc-100">
            {duzenleme ? 'HM Tipi düzenle' : 'Yeni HM Tipi'}
          </h2>
          <button
            onClick={onKapat}
            className="p-1 rounded hover:bg-bg-2 text-zinc-400"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {hata && (
            <div className="flex items-center gap-2 p-2 bg-red/10 text-red rounded text-sm">
              <AlertCircle size={14} /> {hata}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Kod * <span className="font-normal text-zinc-500">(PRF, BOR, SAC…)</span>
            </label>
            <input
              type="text"
              value={kod}
              onChange={(e) => setKod(e.target.value.toUpperCase())}
              maxLength={HM_TIPI_KURALLAR.KOD_MAX}
              className="w-full px-3 py-1.5 text-sm font-mono bg-bg-2 border border-border rounded focus:outline-none focus:border-accent text-zinc-200"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Ad *</label>
            <input
              type="text"
              value={ad}
              onChange={(e) => setAd(e.target.value)}
              maxLength={HM_TIPI_KURALLAR.AD_MAX}
              className="w-full px-3 py-1.5 text-sm bg-bg-2 border border-border rounded focus:outline-none focus:border-accent text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Açıklama</label>
            <textarea
              value={aciklama}
              onChange={(e) => setAciklama(e.target.value)}
              maxLength={HM_TIPI_KURALLAR.ACIKLAMA_MAX}
              rows={2}
              className="w-full px-3 py-1.5 text-sm bg-bg-2 border border-border rounded focus:outline-none focus:border-accent text-zinc-200 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Varsayılan birim
              </label>
              <select
                value={birim}
                onChange={(e) => setBirim(e.target.value as VarsayilanBirim)}
                className="w-full px-3 py-1.5 text-sm bg-bg-2 border border-border rounded focus:outline-none focus:border-accent text-zinc-200"
              >
                {VARSAYILAN_BIRIM_SECENEKLERI.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Sıra</label>
              <input
                type="number"
                min={HM_TIPI_KURALLAR.SIRA_MIN}
                max={HM_TIPI_KURALLAR.SIRA_MAX}
                value={sira}
                onChange={(e) => setSira(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-1.5 text-sm bg-bg-2 border border-border rounded focus:outline-none focus:border-accent text-zinc-200"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              className="rounded"
            />
            Aktif (dropdown listelerinde görünür)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-bg-2">
          <button
            onClick={onKapat}
            disabled={kaydediliyor}
            className="px-3 py-1.5 text-sm rounded hover:bg-bg-3 text-zinc-300"
          >
            Vazgeç
          </button>
          <button
            onClick={kaydet}
            disabled={kaydediliyor}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {kaydediliyor && <Loader2 size={14} className="animate-spin" />}
            {duzenleme ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================
// SİLME ONAY DIALOG
// =============================================================

interface SilmeProps {
  tip: HmTipi
  onVazgec: () => void
  onOnayla: () => void
}

function SilmeOnayDialog({ tip, onVazgec, onOnayla }: SilmeProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onVazgec}
    >
      <div
        className="bg-bg-1 border border-border rounded-lg shadow-lg w-full max-w-sm p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={18} className="text-red" />
          <h2 className="font-medium text-zinc-100">HM Tipini sil</h2>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          <span className="font-mono text-zinc-200">{tip.kod}</span> —{' '}
          <strong className="text-zinc-200">{tip.ad}</strong> kalıcı olarak silinecek.
          Bu işlem geri alınamaz. Bağlı stok kayıtları varsa silme başarısız olacak;
          o durumda Pasif yapmayı düşün.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onVazgec}
            className="px-3 py-1.5 text-sm rounded hover:bg-bg-2 text-zinc-300"
          >
            Vazgeç
          </button>
          <button
            onClick={onOnayla}
            className="px-3 py-1.5 text-sm rounded bg-red/90 text-white hover:bg-red"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  )
}
