import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore, TABLE_MAP } from '@/store'
import { toast } from 'sonner'

// Bu tarayıcı oturumunun kimliği — kendi yazdığımız değişikliğin "echo"su gelince toast gösterme
export const CLIENT_ID = Math.random().toString(36).slice(2, 10)

// Bu tablolardaki değişim sık + gürültülü — toast göstermeyiz ama yine de reload yaparız
const SESSIZ_TABLOLAR = new Set([
  'uys_logs', 'uys_active_work', 'uys_fire_logs', 'uys_stok_hareketler',
  'uys_operator_notes', 'uys_checklist',
])

// Kullanıcı dostu tablo adları
const ETIKET: Record<string, string> = {
  uys_orders: 'Sipariş', uys_work_orders: 'İş Emri', uys_logs: 'Üretim Kaydı',
  uys_malzemeler: 'Malzeme', uys_operations: 'Operasyon', uys_stations: 'İstasyon',
  uys_operators: 'Operatör', uys_recipes: 'Reçete', uys_bom_trees: 'Ürün Ağacı',
  uys_stok_hareketler: 'Stok', uys_kesim_planlari: 'Kesim Planı',
  uys_tedarikler: 'Tedarik', uys_tedarikciler: 'Tedarikçi', uys_durus_kodlari: 'Duruş',
  uys_customers: 'Müşteri', uys_sevkler: 'Sevk', uys_operator_notes: 'Not',
  uys_active_work: 'Aktif İş', uys_fire_logs: 'Fire', uys_checklist: 'Checklist',
  uys_izinler: 'İzin', uys_kullanicilar: 'Kullanıcı', uys_hm_tipleri: 'HM Tipi',
  uys_yetki_ayarlari: 'Yetki',
}

export function useRealtime() {
  const reloadTables = useStore(s => s.reloadTables)
  const loadAll = useStore(s => s.loadAll)
  const pendingRef = useRef<Set<string>>(new Set())
  const externalRef = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const channel = supabase.channel('uys-v3-realtime')
    const tables = [...TABLE_MAP.map(t => t.table), 'uys_yetki_ayarlari']

    tables.forEach(table => {
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          // Origin: bizim yazdığımız mı? (uys_work_orders.__client vb. sütunu yoksa undefined)
          const newRow = payload.new as Record<string, unknown> | undefined
          const oldRow = payload.old as Record<string, unknown> | undefined
          const origin = (newRow?.__client || oldRow?.__client) as string | undefined
          const isOwn = origin === CLIENT_ID

          pendingRef.current.add(table)
          if (!isOwn) externalRef.current.add(table)

          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(async () => {
            const tablolar = Array.from(pendingRef.current)
            const dis = Array.from(externalRef.current)
            pendingRef.current.clear()
            externalRef.current.clear()

            // uys_yetki_ayarlari özel — yetkiMap için tam loadAll gerekli
            if (tablolar.includes('uys_yetki_ayarlari')) {
              await loadAll()
            } else {
              await reloadTables(tablolar)
            }

            // Sadece dış kaynaklı + sessiz olmayan değişikliklerde kısa toast
            const gosterilecek = dis.filter(t => !SESSIZ_TABLOLAR.has(t) && t !== 'uys_yetki_ayarlari')
            if (gosterilecek.length > 0) {
              const adlar = [...new Set(gosterilecek.map(t => ETIKET[t] || t))]
              toast.info(`🔄 Güncellendi: ${adlar.join(', ')}`)
            }
          }, 800)
        }
      )
    })

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') console.log(`✅ Realtime aktif — ${tables.length} tablo · client=${CLIENT_ID}`)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('⚠ Realtime bağlantı hatası:', status)
    })

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [reloadTables, loadAll])
}
