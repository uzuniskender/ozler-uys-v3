import { useState, useEffect, useRef } from 'react'
import { useProductionStore } from '@/store/useProductionStore'
import { useWarehouseStore } from '@/store/useWarehouseStore'
import { loadAllStores } from '@/store/loadAllStores'

const SNAPSHOT_KEY = 'uys_offline_snapshot'
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 saat

interface OfflineSnapshot {
  ts: number
  workOrders: unknown[]
  recipes: unknown[]
  materials: unknown[]
}

function saveSnapshot() {
  try {
    const { workOrders, recipes } = useProductionStore.getState()
    const { materials } = useWarehouseStore.getState()
    if (!workOrders.length && !recipes.length && !materials.length) return
    const snap: OfflineSnapshot = { ts: Date.now(), workOrders, recipes, materials }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap))
  } catch {
    // localStorage dolu olabilir — sessizce geç
  }
}

export function readOfflineSnapshot(): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const snap = JSON.parse(raw) as OfflineSnapshot
    if (Date.now() - snap.ts > SNAPSHOT_MAX_AGE_MS) {
      localStorage.removeItem(SNAPSHOT_KEY)
      return null
    }
    return snap
  } catch {
    return null
  }
}

export function useOffline(): boolean {
  const [offline, setOffline] = useState(!navigator.onLine)
  const wasOffline = useRef(false)

  useEffect(() => {
    const handleOnline = () => {
      setOffline(false)
      if (wasOffline.current) {
        wasOffline.current = false
        // Çevrimdışıyken kaçırılan değişiklikler için tam yeniden yükle
        loadAllStores()
      }
    }
    const handleOffline = () => {
      wasOffline.current = true
      setOffline(true)
      saveSnapshot()
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return offline
}
