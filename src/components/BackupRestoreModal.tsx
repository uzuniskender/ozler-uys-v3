/**
 * v15.53 Adım 3 — Yedek Geri Yükleme Modal'ı (2-adım onay + progress)
 * ─────────────────────────────────────────────────────────────────────────
 * Adım 1 — Mod seçimi: Merge (güvenli) vs Replace (TEHLİKELİ)
 *          Replace seçilirse "Devam" butonu 5 saniye disabled
 *
 * Adım 2 — Son onay:
 *   - Replace mode → "GERI YÜKLE" yazma confirmation (GitHub-style)
 *   - Merge mode → tek tıkla onay
 *
 * İşlem sırasında modal kapanmaz, kullanıcıya progress yazıları gösterilir
 * (Güvenlik yedeği alınıyor → Veriler temizleniyor → Yedek yükleniyor → Tamamlandı).
 *
 * Hata durumunda hata mesajı + güvenlik yedeği ID'si gösterilir; kullanıcı
 * o yedekten geri dönebilir.
 *
 * RBAC: bu modal sadece can('backup_restore') olanlar tarafından çağrılır.
 */

import { useState, useEffect } from 'react'
import { restoreBackup, type Backup, type RestoreResult } from '@/lib/backup'
import { Loader2, AlertTriangle, ShieldCheck, Skull, X, CheckCircle2 } from 'lucide-react'

type RestoreMode = 'merge' | 'replace'

interface Props {
  backup: Backup       // hangi yedek geri yüklenecek (id + tarih + tip yeterli, veri null)
  alanKisi: string     // useAuth user.username || email || dbId
  onClose: () => void  // modal kapanırken çağrılır
  onSuccess: () => void // başarılı restore sonrası (parent listeyi yeniler vs.)
}

export function BackupRestoreModal({ backup, alanKisi, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'mode' | 'confirm' | 'running' | 'done' | 'error'>('mode')
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [confirmText, setConfirmText] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [progressLine, setProgressLine] = useState('')
  const [progressDetail, setProgressDetail] = useState('')
  const [result, setResult] = useState<RestoreResult | null>(null)

  // Replace mode seçilince 5sn timer (mode adımında)
  useEffect(() => {
    if (step === 'mode' && mode === 'replace') {
      setSecondsLeft(5)
      const t = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { clearInterval(t); return 0 }
          return s - 1
        })
      }, 1000)
      return () => clearInterval(t)
    } else {
      setSecondsLeft(0)
    }
  }, [step, mode])

  function devamMode() {
    setStep('confirm')
    setConfirmText('')
  }

  function devamConfirm() {
    if (mode === 'replace' && confirmText !== 'GERI YÜKLE') return
    runRestore()
  }

  async function runRestore() {
    setStep('running')
    setProgressLine('Başlatılıyor...')
    setProgressDetail('')

    const r = await restoreBackup(backup.id, mode, alanKisi, (line, detail) => {
      setProgressLine(line)
      setProgressDetail(detail || '')
    })

    setResult(r)
    if (r.ok) {
      setStep('done')
      // 2 saniye sonra başarı bildirimi yap, modal'ı kapat
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)
    } else {
      setStep('error')
    }
  }

  function tarihGoster(yyyymmdd: string): string {
    if (!yyyymmdd) return '—'
    const [y, m, d] = yyyymmdd.split('-')
    return `${d}.${m}.${y}`
  }

  // ─── Render ───
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
      onClick={() => step === 'mode' && onClose()}
    >
      <div
        className="bg-bg-1 border-2 border-red/40 rounded-xl p-6 w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red" />
            <h3 className="text-lg font-bold text-zinc-100">Yedek Geri Yükleme</h3>
          </div>
          {(step === 'mode' || step === 'confirm') && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Yedek info */}
        <div className="bg-bg-2 border border-border rounded-lg p-3 mb-4 text-xs">
          <div className="text-zinc-500 mb-1">Geri yüklenecek yedek:</div>
          <div className="font-mono text-zinc-200">
            {tarihGoster(backup.alindiTarih)} · {backup.tip.toUpperCase()} · {backup.boyutKb} KB
          </div>
          {backup.notlar && (
            <div className="text-zinc-400 mt-1 italic">"{backup.notlar}"</div>
          )}
        </div>

        {/* Adım 1 — Mod Seçimi */}
        {step === 'mode' && (
          <>
            <div className="mb-4 p-3 bg-amber/10 border border-amber/25 rounded-lg text-xs text-amber">
              <strong>⚠️ Bu işlem TÜM verilerinizi etkileyecek.</strong> Yanlış mod seçilirse veri kaybı olabilir.
            </div>

            <div className="space-y-2 mb-4">
              <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${mode === 'merge' ? 'border-green/50 bg-green/5' : 'border-border hover:border-zinc-600'}`}>
                <input
                  type="radio"
                  checked={mode === 'merge'}
                  onChange={() => setMode('merge')}
                  className="mt-1 accent-green"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-semibold text-green">
                    <ShieldCheck size={14} /> MERGE — Güvenli
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Yedekteki kayıtlar mevcutlara eklenir veya günceller. <strong>Mevcut yeni veriler kaybolmaz.</strong>
                    Örn: "Yanlışlıkla silinen bir sipariş geri geliyor, yeni siparişler etkilenmiyor."
                  </div>
                </div>
              </label>

              <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer ${mode === 'replace' ? 'border-red/50 bg-red/5' : 'border-border hover:border-zinc-600'}`}>
                <input
                  type="radio"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="mt-1 accent-red"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-semibold text-red">
                    <Skull size={14} /> REPLACE — TEHLİKELİ
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    Mevcut veri SİLİNİR, yedek tam haliyle geri yüklenir. <strong>Yedekten sonra eklenen tüm veri kaybolur.</strong>
                    Örn: "Bugün sistem bozuldu, dünkü temiz haline tam geri dönmek istiyorum."
                  </div>
                </div>
              </label>
            </div>

            <div className="text-[11px] text-zinc-500 mb-3 italic">
              Geri yükleme öncesi otomatik güvenlik yedeği alınacak — yanlış yapsanız bile güvende olacaksınız.
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg-3 hover:bg-bg-4 text-zinc-400 rounded-lg text-xs"
              >
                İptal
              </button>
              <button
                onClick={devamMode}
                disabled={mode === 'replace' && secondsLeft > 0}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold ${
                  mode === 'replace'
                    ? 'bg-red hover:bg-red/80 text-white disabled:opacity-40'
                    : 'bg-green hover:bg-green/80 text-black'
                }`}
              >
                {mode === 'replace' && secondsLeft > 0
                  ? `Devam (${secondsLeft})`
                  : `Devam — ${mode === 'replace' ? 'REPLACE' : 'MERGE'}`}
              </button>
            </div>
          </>
        )}

        {/* Adım 2 — Son Onay */}
        {step === 'confirm' && (
          <>
            <div className={`mb-4 p-3 rounded-lg text-xs ${mode === 'replace' ? 'bg-red/10 border border-red/25 text-red' : 'bg-green/10 border border-green/25 text-green'}`}>
              <strong>{mode === 'replace' ? '💀 REPLACE mode seçildi.' : '🔄 MERGE mode seçildi.'}</strong>
              <br />
              {mode === 'replace'
                ? 'Tüm mevcut veriler silinecek ve yedekteki haliyle değiştirilecek.'
                : 'Yedek mevcut verilerle birleştirilecek (eksikler eklenir, çakışanlar yedekteki haline döner).'}
            </div>

            {mode === 'replace' && (
              <div className="mb-4">
                <label className="text-xs text-zinc-400 block mb-1.5">
                  Onaylamak için aşağıya <strong className="text-red">GERI YÜKLE</strong> yazın:
                </label>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="GERI YÜKLE"
                  className="w-full px-3 py-2 bg-bg-2 border border-red/30 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red font-mono tracking-wider"
                  autoFocus
                />
                {confirmText && confirmText !== 'GERI YÜKLE' && (
                  <div className="text-[10px] text-amber mt-1">Tam olarak "GERI YÜKLE" yazmalısınız (Türkçe-büyük harf).</div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep('mode')}
                className="px-4 py-2 bg-bg-3 hover:bg-bg-4 text-zinc-400 rounded-lg text-xs"
              >
                ← Geri
              </button>
              <button
                onClick={devamConfirm}
                disabled={mode === 'replace' && confirmText !== 'GERI YÜKLE'}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-semibold ${
                  mode === 'replace'
                    ? 'bg-red hover:bg-red/80 text-white disabled:opacity-40'
                    : 'bg-green hover:bg-green/80 text-black'
                }`}
              >
                GERİ YÜKLE
              </button>
            </div>
          </>
        )}

        {/* Adım 3 — İşlem Çalışıyor */}
        {step === 'running' && (
          <div className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 size={20} className="animate-spin text-accent" />
              <div>
                <div className="text-sm font-semibold text-zinc-200">{progressLine}</div>
                {progressDetail && <div className="text-[11px] text-zinc-500 mt-0.5">{progressDetail}</div>}
              </div>
            </div>
            <div className="text-[11px] text-amber bg-amber/10 border border-amber/25 rounded p-2">
              ⚠️ <strong>Sayfayı kapatmayın.</strong> İşlem birkaç saniye sürebilir, büyük yedeklerde 30 saniyeyi geçebilir.
            </div>
          </div>
        )}

        {/* Adım 4 — Başarı */}
        {step === 'done' && result?.ok && (
          <div className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 size={28} className="text-green" />
              <div>
                <div className="text-base font-bold text-green">Geri Yükleme Tamamlandı ✓</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {result.insertedRows} kayıt · {result.affectedTables} tablo · {result.mode} mode
                </div>
              </div>
            </div>
            {result.guvenlikYedegiId && (
              <div className="text-[11px] text-zinc-500 italic mb-2">
                Güvenlik yedeği ID: <code className="font-mono text-zinc-400">{result.guvenlikYedegiId.slice(0, 13)}...</code>
              </div>
            )}
            <div className="text-[11px] text-zinc-500">Sayfa otomatik kapanıyor...</div>
          </div>
        )}

        {/* Adım 5 — Hata */}
        {step === 'error' && result && !result.ok && (
          <div className="py-4">
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle size={24} className="text-red flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-base font-bold text-red">Geri Yükleme Başarısız</div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  Adım: <code className="font-mono">{result.step}</code>
                </div>
                <div className="text-[11px] text-zinc-300 mt-2 p-2 bg-red/10 border border-red/25 rounded">
                  {result.error}
                </div>
              </div>
            </div>
            {result.guvenlikYedegiId && (
              <div className="text-[11px] text-amber bg-amber/10 border border-amber/25 rounded p-2 mb-3">
                💡 <strong>Güvenlik yedeği alındı:</strong> <code className="font-mono">{result.guvenlikYedegiId.slice(0, 13)}...</code>
                <br />
                Yedek listesinde bunu bulup geri yükleyerek mevcut duruma dönebilirsiniz.
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-bg-3 hover:bg-bg-4 text-zinc-300 rounded-lg text-xs font-semibold"
            >
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
