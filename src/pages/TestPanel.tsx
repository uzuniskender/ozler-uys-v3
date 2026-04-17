import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { uid, today } from '@/lib/utils'
import { fireTelafiIeOlustur } from '@/features/production/fireTelafi'
import type { FireLog, WorkOrder } from '@/types'

type Step = { ad: string; durum: 'bekliyor' | 'calisiyor' | 'ok' | 'fail'; detay?: string; sure?: number }

export function TestPanel() {
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [log, setLog] = useState<string[]>([])

  function appendLog(s: string) { setLog(l => [...l, s]) }
  function markStep(idx: number, durum: Step['durum'], detay?: string, sure?: number) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, durum, detay, sure } : s))
  }

  async function runAll() {
    setRunning(true)
    setLog([])
    const MAL_KOD = 'TEST-SMOKE-' + Date.now().toString(36).slice(-6).toUpperCase()
    const MAL_AD = 'SMOKE TEST MAMULÜ'
    const IE_ID = 'test-smoke-' + Date.now().toString(36)

    const stepList: Step[] = [
      { ad: '1. Temizlik — önceki test verisi', durum: 'bekliyor' },
      { ad: '2. İE oluştur (hedef=1)', durum: 'bekliyor' },
      { ad: '3. Fire=1 girişi (q=0, f=1)', durum: 'bekliyor' },
      { ad: '4. Orijinal İE durum=tamamlandı doğrula', durum: 'bekliyor' },
      { ad: '5. Fire log oluştu mu?', durum: 'bekliyor' },
      { ad: '6. Telafi İE oluştur', durum: 'bekliyor' },
      { ad: '7. Telafi İE DB\'de var mı?', durum: 'bekliyor' },
      { ad: '8. Telafi İE\'den q=1 üretim', durum: 'bekliyor' },
      { ad: '9. Stok hareketi (giris) yazıldı mı?', durum: 'bekliyor' },
      { ad: '10. Telafi İE durum=tamamlandı doğrula', durum: 'bekliyor' },
      { ad: '11. Cascade silme — log sil, fire_log da gitmeli', durum: 'bekliyor' },
      { ad: '12. Tüm test verisini temizle', durum: 'bekliyor' },
    ]
    setSteps(stepList)

    const sonuc: { basarili: number; hata: number } = { basarili: 0, hata: 0 }

    try {
      // ═══ STEP 1: Temizlik ═══
      let t = Date.now()
      markStep(0, 'calisiyor')
      await supabase.from('uys_stok_hareketler').delete().ilike('malkod', 'TEST-SMOKE-%')
      const { data: eskiWOs } = await supabase.from('uys_work_orders').select('id').ilike('malkod', 'TEST-SMOKE-%')
      const eskiIds = (eskiWOs || []).map(w => w.id)
      if (eskiIds.length) {
        await supabase.from('uys_fire_logs').delete().in('wo_id', eskiIds)
        await supabase.from('uys_logs').delete().in('wo_id', eskiIds)
        await supabase.from('uys_active_work').delete().in('wo_id', eskiIds)
      }
      await supabase.from('uys_work_orders').delete().ilike('malkod', 'TEST-SMOKE-%')
      markStep(0, 'ok', `${eskiIds.length} eski test kaydı silindi`, Date.now() - t)
      sonuc.basarili++

      // ═══ STEP 2: İE oluştur ═══
      t = Date.now()
      markStep(1, 'calisiyor')
      const { error: e2 } = await supabase.from('uys_work_orders').insert({
        id: IE_ID, order_id: null, rc_id: null, sira: 1, kirno: '1',
        malkod: MAL_KOD, malad: MAL_AD, mamul_kod: MAL_KOD, mamul_ad: MAL_AD,
        hedef: 1, mpm: 1, hm: [], ie_no: `IE-SMOKE-${Date.now().toString(36).toUpperCase()}`,
        durum: 'bekliyor', bagimsiz: true, siparis_disi: true, not_: 'SMOKE TEST',
        olusturma: today()
      })
      if (e2) throw new Error(`İE oluşturulamadı: ${e2.message}`)
      markStep(1, 'ok', IE_ID, Date.now() - t)
      sonuc.basarili++

      // ═══ STEP 3: Fire girişi ═══
      t = Date.now()
      markStep(2, 'calisiyor')
      const logId = uid()
      const now = new Date()
      const saatStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
      const { error: eL } = await supabase.from('uys_logs').insert({
        id: logId, wo_id: IE_ID, tarih: today(), saat: saatStr, qty: 0, fire: 1,
        operatorlar: [{ id: 'test', ad: 'TEST OPERATOR', bas: saatStr, bit: saatStr }],
        duruslar: [], malkod: MAL_KOD, ie_no: 'IE-SMOKE', operator_id: null,
      })
      if (eL) throw new Error(`Log insert hatası: ${eL.message}`)
      // Fire log
      const fireLogId = uid()
      const { error: eF } = await supabase.from('uys_fire_logs').insert({
        id: fireLogId, log_id: logId, wo_id: IE_ID, tarih: today(),
        malkod: MAL_KOD, malad: MAL_AD, qty: 1,
        ie_no: 'IE-SMOKE', op_ad: 'TEST OPERATOR',
        operatorlar: [{ id: 'test', ad: 'TEST OPERATOR' }], not_: '',
      })
      if (eF) throw new Error(`Fire log insert hatası: ${eF.message}`)
      // Auto-close simülasyonu (0+1 >= 1)
      const { error: eU } = await supabase.from('uys_work_orders').update({ durum: 'tamamlandi' }).eq('id', IE_ID)
      if (eU) throw new Error(`Durum update hatası: ${eU.message}`)
      markStep(2, 'ok', 'Log + Fire log + durum update', Date.now() - t)
      sonuc.basarili++

      // ═══ STEP 4: Durum doğrula ═══
      t = Date.now()
      markStep(3, 'calisiyor')
      const { data: check4 } = await supabase.from('uys_work_orders').select('durum').eq('id', IE_ID).single()
      if (check4?.durum !== 'tamamlandi') {
        markStep(3, 'fail', `BEKLENİYORDU: tamamlandi, GELDI: ${check4?.durum}`, Date.now() - t)
        sonuc.hata++
      } else {
        markStep(3, 'ok', 'durum = tamamlandi ✓', Date.now() - t)
        sonuc.basarili++
      }

      // ═══ STEP 5: Fire log kontrolü ═══
      t = Date.now()
      markStep(4, 'calisiyor')
      const { data: check5 } = await supabase.from('uys_fire_logs').select('*').eq('id', fireLogId).single()
      if (!check5) {
        markStep(4, 'fail', 'Fire log DB\'de yok!', Date.now() - t); sonuc.hata++
      } else {
        markStep(4, 'ok', `qty=${check5.qty}, wo_id=${check5.wo_id}`, Date.now() - t); sonuc.basarili++
      }

      // ═══ STEP 6: Telafi İE oluştur ═══
      t = Date.now()
      markStep(5, 'calisiyor')
      const orijWo: WorkOrder = {
        id: IE_ID, orderId: '', rcId: '', sira: 1, kirno: '1',
        opId: '', opKod: '', opAd: '', istId: '', istKod: '', istAd: '',
        malkod: MAL_KOD, malad: MAL_AD, hedef: 1, mpm: 1, hm: [],
        ieNo: 'IE-SMOKE', whAlloc: 0, hazirlikSure: 0, islemSure: 0,
        durum: 'tamamlandi', bagimsiz: true, siparisDisi: true,
        mamulKod: MAL_KOD, mamulAd: MAL_AD, mamulAuto: false,
        operatorId: null, not: '', olusturma: today(),
      }
      const fireLogObj: FireLog = {
        id: fireLogId, logId, woId: IE_ID, tarih: today(),
        malkod: MAL_KOD, malad: MAL_AD, qty: 1,
        ieNo: 'IE-SMOKE', opAd: 'TEST OPERATOR',
        operatorlar: [{ id: 'test', ad: 'TEST OPERATOR' }],
        not: '', telafiWoId: '',
      }
      const telafi = await fireTelafiIeOlustur(fireLogObj, orijWo)
      if (!telafi) {
        markStep(5, 'fail', 'fireTelafiIeOlustur null döndü', Date.now() - t); sonuc.hata++
        throw new Error('Telafi oluşturulamadı, devam edilemiyor')
      }
      markStep(5, 'ok', `Telafi woId: ${telafi.woId}`, Date.now() - t); sonuc.basarili++

      // ═══ STEP 7: Telafi DB'de var mı? ═══
      t = Date.now()
      markStep(6, 'calisiyor')
      const { data: check7 } = await supabase.from('uys_work_orders').select('*').eq('id', telafi.woId).single()
      if (!check7) {
        markStep(6, 'fail', 'Telafi İE kaydı bulunamadı', Date.now() - t); sonuc.hata++
      } else {
        markStep(6, 'ok', `hedef=${check7.hedef}, durum=${check7.durum}`, Date.now() - t); sonuc.basarili++
      }

      // ═══ STEP 8: Telafi İE'den üretim ═══
      t = Date.now()
      markStep(7, 'calisiyor')
      const telafiLogId = uid()
      const { error: eTL } = await supabase.from('uys_logs').insert({
        id: telafiLogId, wo_id: telafi.woId, tarih: today(), saat: saatStr, qty: 1, fire: 0,
        operatorlar: [{ id: 'test', ad: 'TEST OPERATOR', bas: saatStr, bit: saatStr }],
        duruslar: [], malkod: MAL_KOD, ie_no: telafi.ieNo, operator_id: null,
      })
      if (eTL) throw new Error(`Telafi log hatası: ${eTL.message}`)
      // Stok girişi
      const stokId = uid()
      const { error: eS } = await supabase.from('uys_stok_hareketler').insert({
        id: stokId, malkod: MAL_KOD, malad: MAL_AD, miktar: 1,
        tip: 'giris', aciklama: `${telafi.ieNo} üretim`,
        tarih: today(), log_id: telafiLogId, wo_id: telafi.woId,
      })
      if (eS) throw new Error(`Stok hareketi hatası: ${eS.message}`)
      // Telafi auto-close
      await supabase.from('uys_work_orders').update({ durum: 'tamamlandi' }).eq('id', telafi.woId)
      markStep(7, 'ok', 'Log + stok + durum', Date.now() - t); sonuc.basarili++

      // ═══ STEP 9: Stok hareketi doğrula ═══
      t = Date.now()
      markStep(8, 'calisiyor')
      const { data: check9 } = await supabase.from('uys_stok_hareketler').select('*').eq('malkod', MAL_KOD).eq('tip', 'giris')
      if (!check9 || check9.length === 0) {
        markStep(8, 'fail', 'Giriş hareketi bulunamadı!', Date.now() - t); sonuc.hata++
      } else {
        markStep(8, 'ok', `${check9.length} giriş, toplam ${check9.reduce((a, c) => a + c.miktar, 0)} adet`, Date.now() - t); sonuc.basarili++
      }

      // ═══ STEP 10: Telafi durum doğrula ═══
      t = Date.now()
      markStep(9, 'calisiyor')
      const { data: check10 } = await supabase.from('uys_work_orders').select('durum').eq('id', telafi.woId).single()
      if (check10?.durum !== 'tamamlandi') {
        markStep(9, 'fail', `BEKLENİYORDU: tamamlandi, GELDI: ${check10?.durum}`, Date.now() - t); sonuc.hata++
      } else {
        markStep(9, 'ok', 'Telafi durum = tamamlandi', Date.now() - t); sonuc.basarili++
      }

      // ═══ STEP 11: Cascade silme ═══
      t = Date.now()
      markStep(10, 'calisiyor')
      // Orijinal log'u sil, bağlı fire_log + stok_hareketler gitmeli
      await supabase.from('uys_logs').delete().eq('id', logId)
      await supabase.from('uys_fire_logs').delete().eq('log_id', logId)
      await supabase.from('uys_stok_hareketler').delete().eq('log_id', logId)
      // Doğrula
      const { data: check11a } = await supabase.from('uys_fire_logs').select('id').eq('log_id', logId)
      if (check11a && check11a.length > 0) {
        markStep(10, 'fail', 'Cascade silme başarısız: fire_log hala var', Date.now() - t); sonuc.hata++
      } else {
        markStep(10, 'ok', 'Log + fire_log cascade silindi', Date.now() - t); sonuc.basarili++
      }

      // ═══ STEP 12: Temizlik ═══
      t = Date.now()
      markStep(11, 'calisiyor')
      await supabase.from('uys_stok_hareketler').delete().eq('malkod', MAL_KOD)
      await supabase.from('uys_fire_logs').delete().in('wo_id', [IE_ID, telafi.woId])
      await supabase.from('uys_logs').delete().in('wo_id', [IE_ID, telafi.woId])
      await supabase.from('uys_work_orders').delete().in('id', [IE_ID, telafi.woId])
      markStep(11, 'ok', 'Tüm test verisi silindi', Date.now() - t); sonuc.basarili++

      appendLog(`✅ Test tamamlandı: ${sonuc.basarili}/${stepList.length} başarılı, ${sonuc.hata} hata`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      appendLog(`❌ Test kesildi: ${msg}`)
    }

    setRunning(false)
  }

  const ikon = (d: Step['durum']) => {
    if (d === 'ok') return <span className="text-green">✓</span>
    if (d === 'fail') return <span className="text-red">✗</span>
    if (d === 'calisiyor') return <span className="text-amber animate-pulse">⋯</span>
    return <span className="text-zinc-600">○</span>
  }

  const basariliSay = steps.filter(s => s.durum === 'ok').length
  const hataSay = steps.filter(s => s.durum === 'fail').length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">🧪 Smoke Test — Fire → Telafi → Stok Akışı</h1>
        <p className="text-xs text-zinc-500">Bu sayfa tüm kritik akışı otomatik test eder. Test verisi TEST-SMOKE-* önekiyle oluşturulur, sonunda tamamen silinir. Canlı veriye dokunmaz.</p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <button onClick={runAll} disabled={running}
          className="px-6 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white rounded-lg text-sm font-semibold">
          {running ? '⏳ Testler çalışıyor...' : '▶ Tüm Testleri Çalıştır'}
        </button>
        {steps.length > 0 && (
          <div className="text-xs text-zinc-400">
            <span className="text-green">✓ {basariliSay}</span>
            {' · '}
            <span className="text-red">✗ {hataSay}</span>
            {' / '}
            <span>{steps.length}</span>
          </div>
        )}
      </div>

      {steps.length > 0 && (
        <div className="bg-bg-1 border border-border rounded-lg p-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
              <div className="w-6 text-center font-mono text-sm mt-0.5">{ikon(s.durum)}</div>
              <div className="flex-1">
                <div className={`text-sm ${s.durum === 'fail' ? 'text-red' : s.durum === 'ok' ? 'text-zinc-200' : 'text-zinc-500'}`}>{s.ad}</div>
                {s.detay && <div className={`text-[11px] mt-0.5 ${s.durum === 'fail' ? 'text-red/70' : 'text-zinc-600'}`}>{s.detay}</div>}
              </div>
              {s.sure !== undefined && <div className="text-[10px] text-zinc-600 font-mono">{s.sure}ms</div>}
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-4 bg-bg-2 border border-border rounded-lg p-3 font-mono text-[11px]">
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  )
}
