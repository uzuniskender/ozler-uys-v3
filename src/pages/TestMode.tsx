// ═══ TEST MODU — v15.37 ═══
// Sistemde test kalıntısı bırakmadan testler yapmak için UI.
// Test başlat → aktif kayıtların tümüne test_run_id otomatik eklenir (supabase proxy)
// Test sonlandır → cascade delete ile sadece o etiketli kayıtlar silinir

import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import { showConfirm } from '@/lib/prompt'
import { Play, StopCircle, RotateCcw, AlertTriangle, Check, X as XIcon } from 'lucide-react'
import {
  startTestRun, finishTestRun, cancelTestRun,
  getActiveTestRunId, cascadeDeleteTestRun,
} from '@/lib/testRun'
import { senaryo1, senaryo2, senaryo3, senaryo4, senaryo5, senaryo6, type SenaryoRapor, type SenaryoAdim } from '@/lib/testRunner'

export function TestMode() {
  const { testRuns, recipes, loadAll } = useStore()
  const { can, user } = useAuth()
  const [aktifTestId, setAktifTestId] = useState<string>(getActiveTestRunId() || '')
  const [aciklama, setAciklama] = useState('')
  const [loading, setLoading] = useState(false)
  // v15.37 Part 3 — Otomatik senaryo çalıştırma
  const [recipeKod, setRecipeKod] = useState('YMH100265')
  const [adet, setAdet] = useState(10)
  const [canliLog, setCanliLog] = useState<SenaryoAdim[]>([])
  const [sonRapor, setSonRapor] = useState<SenaryoRapor | null>(null)
  const [calisan, setCalisan] = useState<string | null>(null)

  // Rehidrasyon: localStorage ↔ state senkron
  useEffect(() => {
    const id = getActiveTestRunId() || ''
    if (id !== aktifTestId) setAktifTestId(id)
  }, [aktifTestId])

  const aktifTest = aktifTestId ? testRuns.find(t => t.id === aktifTestId) : null
  const tamamlananTestler = testRuns
    .filter(t => t.durum !== 'aktif')
    .sort((a, b) => (b.baslangic || '').localeCompare(a.baslangic || ''))
    .slice(0, 20)

  if (!can('data_test')) {
    return (
      <div className="p-8 text-center text-zinc-500 text-sm">
        Bu sayfaya erişim için "Test modu" yetkisi gerekli.
      </div>
    )
  }

  async function baslat() {
    if (aktifTestId) { toast.error('Zaten aktif bir test var'); return }
    if (!user) { toast.error('Kullanıcı tespit edilemedi'); return }
    const onay = await showConfirm(
      'Test modu başlatılıyor. Bu modda oluşturduğun tüm kayıtlar "test_run_id" ile etiketlenir.\n\n' +
      'Testi bitirince "Temizle ve Sonlandır" ile tüm kalıntılar otomatik silinir.\n\n' +
      'Başlatmak istiyor musun?'
    )
    if (!onay) return

    setLoading(true)
    try {
      const userId = user.dbId || user.email || user.username || ''
      const userAd = user.username || ''
      const tr = await startTestRun({ userId, userAd, aciklama: aciklama.trim() })
      if (!tr) { toast.error('Test başlatılamadı'); return }
      setAktifTestId(tr.id)
      setAciklama('')
      await loadAll()
      toast.success(`Test modu AÇIK — ${tr.id}`, { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  async function sonlandir() {
    if (!aktifTestId) return
    const onay = await showConfirm(
      `Test modu sonlandırılacak ve ${aktifTestId} etiketli tüm kayıtlar silinecek.\n\n` +
      `Silinecekler: siparişler, iş emirleri, kesim planları, MRP rezerveler, tedarikler, ` +
      `üretim logları, stok hareketleri, fire logları, sevkler, açık barlar, aktif çalışmalar.\n\n` +
      `Mevcut (test-dışı) kayıtlar ETKİLENMEZ.\n\n` +
      `Devam edilsin mi?`
    )
    if (!onay) return

    setLoading(true)
    try {
      const r = await finishTestRun(aktifTestId, { cleanup: true })
      if (!r.ok) { toast.error('Sonlandırma kısmen başarısız'); return }
      const toplam = Object.values(r.silinen).reduce((a, b) => a + (b > 0 ? b : 0), 0)
      setAktifTestId('')
      await loadAll()
      toast.success(`Test tamamlandı · ${toplam} kayıt silindi`, { duration: 7000 })
    } finally {
      setLoading(false)
    }
  }

  async function iptal() {
    if (!aktifTestId) return
    const onay = await showConfirm(
      `Test modu İPTAL edilecek ama etiketli kayıtlar SİLİNMEYECEK.\n\n` +
      `Bu modda oluşturulan veri canlı sistemde kalıntı olarak kalacak.\n\n` +
      `Genelde "Temizle ve Sonlandır" tercih edilmeli. Yine de devam?`
    )
    if (!onay) return

    setLoading(true)
    try {
      await cancelTestRun(aktifTestId)
      setAktifTestId('')
      await loadAll()
      toast.info('Test iptal edildi (kayıtlar silinmedi)')
    } finally {
      setLoading(false)
    }
  }

  async function eskiTestTemizle(testId: string) {
    const onay = await showConfirm(
      `${testId} test run'ının kayıtları silinecek (tekrar temizlik). Devam?`
    )
    if (!onay) return

    setLoading(true)
    try {
      const silinen = await cascadeDeleteTestRun(testId)
      const toplam = Object.values(silinen).reduce((a, b) => a + (b > 0 ? b : 0), 0)
      await loadAll()
      toast.success(`${toplam} kayıt silindi`)
    } finally {
      setLoading(false)
    }
  }

  // v15.37 Part 3 — Senaryo çalıştırıcı (v15.38: Senaryo 6 dahil)
  async function senaryoCalistir(num: 1 | 2 | 3 | 4 | 5 | 6) {
    if (!aktifTestId) { toast.error('Önce test modunu başlat'); return }
    if (num !== 6 && !recipeKod.trim()) { toast.error('Reçete kodu gir'); return }
    setCalisan(`Senaryo ${num}`)
    setCanliLog([])
    setSonRapor(null)
    const fn =
      num === 1 ? senaryo1 :
      num === 2 ? senaryo2 :
      num === 3 ? senaryo3 :
      num === 4 ? senaryo4 :
      num === 5 ? senaryo5 :
      senaryo6
    try {
      const rapor = await fn({
        recipeKod: recipeKod.trim() || 'N/A',  // Senaryo 6 reçeteye dokunmaz
        adet,
        onLog: (adim) => setCanliLog(prev => [...prev, adim]),
      })
      setSonRapor(rapor)
      toast[rapor.genelDurum === 'PASS' ? 'success' : rapor.genelDurum === 'KISMI' ? 'warning' : 'error'](
        `Senaryo ${num} ${rapor.genelDurum} · ${rapor.adimlar.length} adım · ${rapor.toplamSureMs}ms`,
        { duration: 7000 }
      )
    } catch (e: any) {
      toast.error(`Senaryo ${num} KRİTİK HATA: ${e?.message || e}`, { duration: 10000 })
      console.error('[senaryo]', e)
    } finally {
      setCalisan(null)
    }
  }

  // v15.37 Part 3 v2 — Senaryolar arası temizlik (sub test_run_id'yi temizle)
  async function araTemizle() {
    if (!aktifTestId) return
    const onay = await showConfirm(
      `Senaryolar arası temizlik: ${aktifTestId}_s1 / _s2 / _s3 / _s4 etiketli kayıtlar silinecek, parent test modu AÇIK kalır. Devam?`
    )
    if (!onay) return
    setLoading(true)
    try {
      let toplam = 0
      for (const suffix of ['s1', 's2', 's3', 's4', 's5', 's6']) {
        const silinen = await cascadeDeleteTestRun(`${aktifTestId}_${suffix}`)
        toplam += Object.values(silinen).reduce((a, b) => a + (b > 0 ? b : 0), 0)
      }
      await loadAll()
      toast.success(`Ara temizlik: ${toplam} kayıt silindi (parent açık)`)
    } finally {
      setLoading(false)
    }
  }

  // v15.37 Part 3 v2 / v15.38 — 6 senaryoyu ardışık çalıştır, her biri arasında otomatik temizlik
  async function tumSenaryolarCalistir() {
    if (!aktifTestId) { toast.error('Önce test modunu başlat'); return }
    if (!recipeKod.trim()) { toast.error('Reçete kodu gir (Senaryo 1-5 için gerekli)'); return }

    const tumRaporlar: SenaryoRapor[] = []
    setCanliLog([])
    setSonRapor(null)

    for (const num of [1, 2, 3, 4, 5, 6] as const) {
      setCalisan(`Senaryo ${num}`)
      const fn =
        num === 1 ? senaryo1 :
        num === 2 ? senaryo2 :
        num === 3 ? senaryo3 :
        num === 4 ? senaryo4 :
        num === 5 ? senaryo5 :
        senaryo6
      try {
        const rapor = await fn({
          recipeKod: recipeKod.trim() || 'N/A',
          adet,
          onLog: (adim) => setCanliLog(prev => [...prev, { ...adim, adim: `[S${num}] ${adim.adim}` }]),
        })
        tumRaporlar.push(rapor)
        setSonRapor(rapor)

        // v15.37 Part 3 v3: Her senaryodan sonra sub-run temizlik (son dahil)
        await cascadeDeleteTestRun(`${aktifTestId}_s${num}`)
        await loadAll()
        if (num < 6) await new Promise(r => setTimeout(r, 500))
      } catch (e: any) {
        toast.error(`Senaryo ${num} kritik hata: ${e?.message || e}`)
        console.error('[senaryo]', e)
      }
    }
    setCalisan(null)

    // Toplu rapor indir
    const tumRapor = {
      baslangic: tumRaporlar[0]?.baslangic,
      bitis: tumRaporlar[tumRaporlar.length - 1]?.bitis,
      testRunId: aktifTestId,
      adet,
      recipeKod,
      senaryolar: tumRaporlar,
      genelDurum: tumRaporlar.every(r => r.genelDurum === 'PASS') ? 'ALL_PASS' : 'MIXED',
    }
    const json = JSON.stringify(tumRapor, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `toplu_rapor_${aktifTestId}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast.success(`4 senaryo tamamlandı — ${tumRapor.genelDurum === 'ALL_PASS' ? 'TÜMÜ PASS' : 'KARIŞIK'}`, { duration: 10000 })
  }

  function raporIndir() {
    if (!sonRapor) return
    const json = JSON.stringify(sonRapor, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapor_${sonRapor.testRunId}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">🧪 Test Modu</h1>
          <p className="text-xs text-zinc-500">
            Sistem üzerinde temiz testler yap — test kayıtları otomatik etiketlenir, sonlandırmada temizlenir
          </p>
        </div>
      </div>

      {/* AKTİF TEST + SENARYO RUNNER */}
      {aktifTest && (
        <div className="mb-4 p-4 bg-bg-2 border border-border rounded-lg">
          <h2 className="text-sm font-semibold mb-3">🤖 Otomatik Senaryo Çalıştırıcı</h2>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Reçete kodu veya mamul kodu</label>
              <input
                value={recipeKod}
                onChange={e => setRecipeKod(e.target.value)}
                placeholder="YMH100265"
                list="recipe-options"
                className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm font-mono"
              />
              <datalist id="recipe-options">
                {recipes.slice(0, 50).map(r => (
                  <option key={r.id} value={r.mamulKod}>{r.mamulAd}</option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Adet</label>
              <input
                type="number" min={1} max={99999}
                value={adet}
                onChange={e => setAdet(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-bg-1 border border-border rounded text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => senaryoCalistir(n as 1 | 2 | 3 | 4 | 5 | 6)}
                disabled={!!calisan || loading}
                className={
                  n === 6
                    ? "px-3 py-2 bg-red/10 hover:bg-red/20 border border-red/30 text-red rounded text-[11px] font-semibold text-left"
                    : "px-3 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent rounded text-[11px] font-semibold text-left"
                }
              >
                {calisan === `Senaryo ${n}` ? '⏳ ' : n === 6 ? '⛔ ' : '🤖 '}
                Senaryo {n}: {
                  n === 1 ? 'Sipariş → tam akış' :
                  n === 2 ? 'Manuel İE → tam akış' :
                  n === 3 ? 'Sipariş + tedarik sil + 2. sipariş' :
                  n === 4 ? 'İE + tedarik sil + 2. İE' :
                  n === 5 ? 'Fire + Telafi + Duruş' :
                  'Negatif — Yasak Kontrolleri'
                }
              </button>
            ))}
          </div>

          {/* v2: Tümünü çalıştır + ara temizlik */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button
              onClick={tumSenaryolarCalistir}
              disabled={!!calisan || loading}
              className="px-3 py-2.5 bg-green/15 hover:bg-green/25 border border-green/40 text-green rounded text-[11px] font-bold"
            >
              {calisan ? '⏳ Çalışıyor: ' + calisan : '🚀 Tümünü Ardışık Çalıştır (her biri arasında temizlik)'}
            </button>
            <button
              onClick={araTemizle}
              disabled={!!calisan || loading}
              className="px-3 py-2.5 bg-amber/10 hover:bg-amber/20 border border-amber/30 text-amber rounded text-[11px] font-semibold"
              title="Senaryolar arası kayıtları temizle, test modu açık kalır"
            >
              🧹 Senaryolar Arası Temizlik
            </button>
          </div>
        </div>
      )}

      {/* CANLI LOG */}
      {canliLog.length > 0 && (
        <div className="mb-4 bg-bg-2 border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold">
              📋 {calisan ? `${calisan} — çalışıyor...` : 'Son çalıştırma logu'}
            </h3>
            {sonRapor && (
              <button
                onClick={raporIndir}
                className="px-3 py-1 bg-accent text-white rounded text-[10px] font-semibold"
              >
                📥 JSON İndir
              </button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {canliLog.map((log, i) => (
              <div
                key={i}
                className={`px-4 py-1.5 border-b border-border/30 text-[11px] flex items-start gap-2 ${
                  log.durum === 'FAIL' ? 'bg-red/10' : log.durum === 'SKIP' ? 'bg-zinc-500/5' : ''
                }`}
              >
                <span className={`shrink-0 font-bold ${
                  log.durum === 'OK' ? 'text-green' :
                  log.durum === 'FAIL' ? 'text-red' : 'text-zinc-500'
                }`}>
                  {log.durum === 'OK' ? '✓' : log.durum === 'FAIL' ? '✗' : '○'}
                </span>
                <span className="flex-1 text-zinc-300">{log.adim}</span>
                {log.hata && <span className="text-red text-[10px] truncate max-w-[300px]">{log.hata}</span>}
                {log.delil && !log.hata && (
                  <span className="text-zinc-500 font-mono text-[10px] truncate max-w-[300px]">
                    {JSON.stringify(log.delil).slice(0, 100)}
                  </span>
                )}
                <span className="shrink-0 text-zinc-600 font-mono text-[10px]">{log.sureMs}ms</span>
              </div>
            ))}
          </div>
          {sonRapor && (
            <div className="px-4 py-2 border-t border-border bg-bg-3/20 flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                sonRapor.genelDurum === 'PASS' ? 'bg-green/20 text-green' :
                sonRapor.genelDurum === 'KISMI' ? 'bg-amber/20 text-amber' : 'bg-red/20 text-red'
              }`}>
                {sonRapor.genelDurum}
              </span>
              <span className="text-[10px] text-zinc-400">
                {sonRapor.adimlar.length} adım · {sonRapor.toplamSureMs}ms
              </span>
              <span className="text-[10px] text-zinc-500">
                {sonRapor.ozet.olusanSiparis}sip · {sonRapor.ozet.olusanIE}İE · {sonRapor.ozet.olusanKesimPlan}kp ·
                {' '}{sonRapor.ozet.olusanTedarik}ted · {sonRapor.ozet.uretimLog}log
              </span>
            </div>
          )}
        </div>
      )}

      {/* AKTİF TEST BANNER */}
      {aktifTest ? (
        <div className="mb-4 p-4 bg-amber/10 border-2 border-amber/40 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-amber" />
                <span className="font-semibold text-amber text-sm">TEST MODU AKTİF</span>
              </div>
              <div className="font-mono text-amber text-sm">{aktifTest.id}</div>
              <div className="text-[11px] text-zinc-400 mt-1">
                Başlangıç: <span className="font-mono">{aktifTest.baslangic?.slice(0, 16).replace('T', ' ')}</span>
                <span className="text-zinc-600 mx-2">·</span>
                Kullanıcı: <span className="text-zinc-300">{aktifTest.userAd || aktifTest.userId}</span>
              </div>
              {aktifTest.aciklama && (
                <div className="mt-2 text-[11px] text-zinc-300 italic">"{aktifTest.aciklama}"</div>
              )}
              <div className="mt-3 text-[11px] text-zinc-400">
                Bu modda oluşturduğun tüm sipariş, İE, kesim planı, tedarik, log vb. kayıtlar test_run_id etiketi alır.
                Testi sonlandırınca tümü silinir, canlı veri etkilenmez.
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={sonlandir}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-green hover:bg-green/80 text-white rounded-lg text-xs font-semibold"
              >
                <Check size={14} /> Temizle ve Sonlandır
              </button>
              <button
                onClick={iptal}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-bg-3 hover:bg-red/20 text-zinc-400 hover:text-red rounded-lg text-xs"
              >
                <XIcon size={14} /> İptal (temizlemeden)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 p-4 bg-bg-2 border border-border rounded-lg">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <label className="text-[11px] text-zinc-500 block mb-1">Test açıklaması (opsiyonel)</label>
              <input
                value={aciklama}
                onChange={e => setAciklama(e.target.value)}
                placeholder='Örn: "Sipariş → kesim → MRP tam akış testi"'
                className="w-full px-3 py-2 bg-bg-1 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={baslat}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shrink-0"
            >
              <Play size={14} /> Test Başlat
            </button>
          </div>
        </div>
      )}

      {/* GEÇMİŞ TESTLER */}
      <div className="bg-bg-2 border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Geçmiş Testler</h2>
          <p className="text-[10px] text-zinc-500">Son 20 tamamlanan / iptal edilen test</p>
        </div>
        {!tamamlananTestler.length ? (
          <div className="p-8 text-center text-zinc-500 text-xs">Geçmiş test kaydı yok</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-zinc-500 bg-bg-3/30">
                <th className="text-left px-4 py-2">Test ID</th>
                <th className="text-left px-4 py-2">Başlangıç</th>
                <th className="text-left px-4 py-2">Bitiş</th>
                <th className="text-left px-4 py-2">Kullanıcı</th>
                <th className="text-left px-4 py-2">Durum</th>
                <th className="text-right px-4 py-2">Silinen Kayıt</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tamamlananTestler.map(t => {
                const toplam = Object.values(t.temizlenenKayitSayisi || {}).reduce((a, b) => a + (b > 0 ? b : 0), 0)
                return (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-bg-3/20">
                    <td className="px-4 py-2 font-mono text-accent text-[11px]">{t.id}</td>
                    <td className="px-4 py-2 text-zinc-400 font-mono text-[10px]">
                      {t.baslangic?.slice(0, 16).replace('T', ' ') || '-'}
                    </td>
                    <td className="px-4 py-2 text-zinc-400 font-mono text-[10px]">
                      {t.bitis?.slice(0, 16).replace('T', ' ') || '-'}
                    </td>
                    <td className="px-4 py-2 text-zinc-300">{t.userAd || t.userId || '-'}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        t.durum === 'tamamlandi' ? 'bg-green/10 text-green' :
                        t.durum === 'iptal' ? 'bg-red/10 text-red' : 'bg-zinc-500/10 text-zinc-500'
                      }`}>
                        {t.durum === 'tamamlandi' ? '✓ Temizlendi' : t.durum === 'iptal' ? '⚠ İptal' : t.durum}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {t.durum === 'tamamlandi' ? toplam : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {t.durum === 'iptal' && (
                        <button
                          onClick={() => eskiTestTemizle(t.id)}
                          disabled={loading}
                          className="flex items-center gap-1 px-2 py-1 bg-bg-3 hover:bg-red/20 text-zinc-400 hover:text-red rounded text-[10px]"
                          title="Bu iptal edilmiş test'in etiketli kayıtlarını tekrar temizle"
                        >
                          <RotateCcw size={10} /> Temizle
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detay - silinen tablolar */}
      {aktifTest && Object.keys(aktifTest.temizlenenKayitSayisi || {}).length > 0 && (
        <div className="mt-4 p-3 bg-bg-2 border border-border rounded-lg">
          <div className="text-xs text-zinc-400 mb-2">Son temizlikteki tablo detayları:</div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            {Object.entries(aktifTest.temizlenenKayitSayisi).map(([tablo, sayi]) => (
              <div key={tablo} className="flex justify-between px-2 py-1 bg-bg-3/30 rounded">
                <span className="text-zinc-500 font-mono">{tablo}</span>
                <span className="text-zinc-300 font-mono">{sayi as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
