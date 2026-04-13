import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store'

const RT_TABLES = [
  'uys_logs', 'uys_work_orders', 'uys_orders',
  'uys_operator_notes', 'uys_active_work',
  'uys_stok_hareketler', 'uys_fire_logs',
  'uys_tedarikler', 'uys_kesim_planlari',
]

export function useRealtime() {
  const loadAll = useStore(s => s.loadAll)

  useEffect(() => {
    const channel = supabase.channel('uys-v3-realtime')

    RT_TABLES.forEach(table => {
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          console.log('🔄 RT:', table, payload.eventType)
          // Debounced reload
          clearTimeout((window as unknown as Record<string, ReturnType<typeof setTimeout>>).__rtTimer)
          ;(window as unknown as Record<string, ReturnType<typeof setTimeout>>).__rtTimer = setTimeout(() => {
            loadAll()
          }, 1500)
        }
      )
    })

    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') console.log('✅ Realtime aktif (' + RT_TABLES.length + ' tablo)')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadAll])
}
