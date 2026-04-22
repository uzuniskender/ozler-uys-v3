import { useState, useMemo } from 'react'
import { useStore } from '@/store'
import { today } from '@/lib/utils'
import { UserX, X, Clock, Calendar, Stethoscope, Coffee } from 'lucide-react'

/**
 * Bugün Giriş Yapmayan Operatörler kartı — kompakt kutu + detay modal.
 *
 * Tanım:
 *   - "Giriş yaptı" = bugün `logs` tablosunda operatörün içinde olduğu en az 1 kayıt var
 *   - "Aktif operatör" = `operators.aktif !== false`
 *   - Modal'da her operatör için:
 *       · son log tarihinden "X gündür giriş yok"
 *       · `uys_izinler` tablosundan durum=onaylandi + bugün aralığındaysa → izin tipi rozeti
 *       · aktif=false ise "Pasif" rozeti
 *
 * Nerelerde kullanılabilir: Dashboard, Operatörler sayfası, Veri Yönetimi vs.
 * Sadece <InactiveOperatorsCard /> olarak yerleştir.
 */
export function InactiveOperatorsCard() {
  const { operators, logs, izinler } = useStore()
  const [showModal, setShowModal] = useState(false)

  const todayStr = today()

  const data = useMemo(() => {
    // Aktif operatörler — pasifler sayıma dahil değil
    const aktifler = operators.filter(o => o.aktif !== false)

    // Bugün log yazmış operatör ID'leri
    const bugunGiris = new Set<string>()
    for (const l of logs) {
      if (l.tarih !== todayStr) continue
      const ops = Array.isArray(l.operatorlar) ? l.operatorlar : []
      for (const o of ops) {
        if (o && o.id) bugunGiris.add(o.id)
      }
    }

    // Her operatör için son log tarihi
    const sonLogMap = new Map<string, string>()
    for (const l of logs) {
      const ops = Array.isArray(l.operatorlar) ? l.operatorlar : []
      for (const o of ops) {
        if (!o || !o.id) continue
        const mevcut = sonLogMap.get(o.id)
        if (!mevcut || l.tarih > mevcut) sonLogMap.set(o.id, l.tarih)
      }
    }

    // İzinler → opId → aktif izin (bugün aralığında, onaylı)
    type IzinInfo = { tip: string; baslangic: string; bitis: string; saatBaslangic?: string; saatBitis?: string }
    const aktifIzinMap = new Map<string, IzinInfo>()
    for (const iz of izinler) {
      if (iz.durum !== 'onaylandi') continue
      if (iz.baslangic > todayStr || iz.bitis < todayStr) continue
      aktifIzinMap.set(iz.opId, {
        tip: iz.tip, baslangic: iz.baslangic, bitis: iz.bitis,
        saatBaslangic: iz.saatBaslangic, saatBitis: iz.saatBitis,
      })
    }

    // Giriş yapmayan listesi
    const yapmayanlar = aktifler.filter(o => !bugunGiris.has(o.id)).map(o => {
      const sonLog = sonLogMap.get(o.id)
      let gunSayisi: number | null = null
      if (sonLog) {
        const d1 = new Date(sonLog).getTime()
        const d2 = new Date(todayStr).getTime()
        gunSayisi = Math.max(0, Math.round((d2 - d1) / 86400000))
      }
      return {
        id: o.id, kod: o.kod, ad: o.ad, bolum: o.bolum || 'Tanımsız',
        sonLog, gunSayisi, izin: aktifIzinMap.get(o.id),
      }
    })

    // Sıralama: izinli en sona, sonra gün sayısına göre azalan (en uzun süre girmeyen üstte)
    yapmayanlar.sort((a, b) => {
      if (!!a.izin !== !!b.izin) return a.izin ? 1 : -1
      const ga = a.gunSayisi ?? 9999
      const gb = b.gunSayisi ?? 9999
      if (gb !== ga) return gb - ga
      return a.ad.localeCompare(b.ad, 'tr')
    })

    // Bölüme göre grupla
    const gruplar: Record<string, typeof yapmayanlar> = {}
    for (const y of yapmayanlar) {
      if (!gruplar[y.bolum]) gruplar[y.bolum] = []
      gruplar[y.bolum].push(y)
    }
    const gruplarSorted = Object.entries(gruplar).sort((a, b) => a[0].localeCompare(b[0], 'tr'))

    // Izinli / raporlu breakdown
    const izinliSayisi = yapmayanlar.filter(y => y.izin).length
    const raporluSayisi = yapmayanlar.filter(y => y.izin && y.izin.tip === 'rapor').length
    const mesaiSayisi = yapmayanlar.filter(y => y.izin && y.izin.tip === 'mesai').length

    return {
      aktifToplam: aktifler.length,
      girisYapan: aktifler.length - yapmayanlar.length,
      yapmayan: yapmayanlar.length,
      izinliSayisi, raporluSayisi, mesaiSayisi,
      gruplar: gruplarSorted,
    }
  }, [operators, logs, izinler, todayStr])

  return (
    <>
      {/* Kompakt kart — tıklanabilir */}
      <button
        onClick={() => setShowModal(true)}
        className="bg-bg-2 border border-border rounded-lg p-4 hover:border-accent/50 hover:bg-bg-3/30 transition-colors text-left w-full group"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <UserX size={13} className="text-amber" />
            Bugün Giriş Yapmayan
          </div>
          <span className="text-[10px] text-zinc-500 group-hover:text-accent transition-colors">Detay →</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-mono font-bold text-amber">{data.yapmayan}</span>
          <span className="text-xs text-zinc-500">/ {data.aktifToplam} aktif</span>
        </div>
        {/* İzin breakdown mini badge */}
        {data.izinliSayisi > 0 && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {data.raporluSayisi > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-red/10 text-red rounded font-semibold">
                <Stethoscope size={9} /> {data.raporluSayisi} raporlu
              </span>
            )}
            {data.mesaiSayisi > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded font-semibold">
                <Clock size={9} /> {data.mesaiSayisi} mesai
              </span>
            )}
            {(data.izinliSayisi - data.raporluSayisi - data.mesaiSayisi) > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-amber/10 text-amber rounded font-semibold">
                <Coffee size={9} /> {data.izinliSayisi - data.raporluSayisi - data.mesaiSayisi} izinli
              </span>
            )}
            <span className="text-[10px] text-zinc-600">
              · {data.yapmayan - data.izinliSayisi} açıklamasız
            </span>
          </div>
        )}
      </button>

      {/* Detay modal */}
      {showModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-bg-1 border border-border rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserX size={18} className="text-amber" />
                <div>
                  <h2 className="text-base font-semibold">Bugün Giriş Yapmayan Operatörler</h2>
                  <div className="text-[11px] text-zinc-500">
                    {data.yapmayan} kişi · Bugün: <span className="font-mono text-zinc-400">{todayStr}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-zinc-500 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Özet şerit */}
            <div className="px-5 py-3 border-b border-border bg-bg-2/40 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-2 py-1 bg-green/10 border border-green/25 text-green rounded-full font-semibold">
                ✓ Giriş yapan: {data.girisYapan}
              </span>
              <span className="text-[11px] px-2 py-1 bg-amber/10 border border-amber/25 text-amber rounded-full font-semibold">
                Yapmayan: {data.yapmayan}
              </span>
              {data.raporluSayisi > 0 && (
                <span className="text-[11px] px-2 py-1 bg-red/10 border border-red/25 text-red rounded-full font-semibold inline-flex items-center gap-1">
                  <Stethoscope size={10} /> Raporlu: {data.raporluSayisi}
                </span>
              )}
              {data.mesaiSayisi > 0 && (
                <span className="text-[11px] px-2 py-1 bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 rounded-full font-semibold inline-flex items-center gap-1">
                  <Clock size={10} /> Mesai: {data.mesaiSayisi}
                </span>
              )}
              {(data.izinliSayisi - data.raporluSayisi - data.mesaiSayisi) > 0 && (
                <span className="text-[11px] px-2 py-1 bg-amber/10 border border-amber/25 text-amber rounded-full font-semibold inline-flex items-center gap-1">
                  <Coffee size={10} /> İzinli: {data.izinliSayisi - data.raporluSayisi - data.mesaiSayisi}
                </span>
              )}
            </div>

            {/* Liste */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {data.gruplar.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green/10 mb-3">
                    <UserX size={20} className="text-green" />
                  </div>
                  <div className="text-sm text-green font-semibold">🎉 Tüm aktif operatörler bugün giriş yapmış!</div>
                </div>
              ) : (
                data.gruplar.map(([bolum, list]) => (
                  <div key={bolum} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-accent/5 border border-accent/15 rounded-t-lg">
                      <span className="text-[11px] font-semibold text-accent font-mono tracking-wider">{bolum}</span>
                      <span className="text-[10px] text-zinc-500">{list.length} kişi</span>
                    </div>
                    <div className="bg-bg-2 border border-border border-t-0 rounded-b-lg divide-y divide-border/25">
                      {list.map(y => {
                        const izin = y.izin
                        return (
                          <div key={y.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-bg-3/30">
                            <span className="font-mono text-[10px] text-accent w-16 shrink-0">{y.kod}</span>
                            <span className="flex-1 text-xs text-zinc-200 font-medium">{y.ad}</span>
                            {/* Durum — önce izin varsa onu, yoksa gün sayısı */}
                            {izin ? (
                              izin.tip === 'rapor' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red/10 text-red rounded text-[10px] font-semibold">
                                  <Stethoscope size={10} /> Raporlu
                                  <span className="font-mono text-[9px] opacity-80 ml-0.5">
                                    ({izin.baslangic}{izin.bitis !== izin.baslangic ? `→${izin.bitis}` : ''})
                                  </span>
                                </span>
                              ) : izin.tip === 'mesai' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px] font-semibold">
                                  <Clock size={10} /> Mesai
                                  {izin.saatBaslangic && (
                                    <span className="font-mono text-[9px] opacity-80 ml-0.5">
                                      ({izin.saatBaslangic}–{izin.saatBitis})
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber/10 text-amber rounded text-[10px] font-semibold">
                                  <Coffee size={10} /> {izin.tip}
                                  <span className="font-mono text-[9px] opacity-80 ml-0.5">
                                    ({izin.baslangic}{izin.bitis !== izin.baslangic ? `→${izin.bitis}` : ''})
                                  </span>
                                </span>
                              )
                            ) : y.gunSayisi === null ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-500 rounded text-[10px]">
                                <Calendar size={10} /> Hiç giriş yok
                              </span>
                            ) : y.gunSayisi === 0 ? (
                              <span className="text-[10px] text-zinc-500">Bugün henüz giriş yok</span>
                            ) : y.gunSayisi === 1 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px]">
                                <Calendar size={10} /> Dün giriş yapmış
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                y.gunSayisi >= 7 ? 'bg-red/10 text-red' :
                                y.gunSayisi >= 3 ? 'bg-amber/10 text-amber' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                <Calendar size={10} /> {y.gunSayisi} gündür giriş yok
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between text-[11px] text-zinc-500">
              <div>
                İzin/rapor kaydı için: <span className="text-zinc-400">Operatörler → İzin / Mesai</span> sekmesi
              </div>
              <button onClick={() => setShowModal(false)} className="px-3 py-1.5 bg-bg-3 text-zinc-400 rounded hover:text-white">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
