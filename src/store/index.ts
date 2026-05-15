// ═══ TYPES (senin mevcut type'ların yukarıda kalabilir) ═══


// ═══ STORE EXPORTS ═══

// Store'lar
export * from "./useAuthStore"
export * from "./useOrderStore"
export * from "./useProductionStore"
export * from "./useWarehouseStore"

// Helpers
export * from "./mappers"
export * from "./tables"

// Loader
export * from "./loadAllStores"


// ═══ EXTRA (EKSİK OLANLAR) ═══

// Realtime için gerekli (HATA BURADAN GELİYOR)
export const reloadTablesDispatched = () => {
  console.log("reloadTablesDispatched tetiklendi")
}
// Legacy support (eski kod kırılmasın diye)
import { useOrderStore } from "./useOrderStore"
import { useProductionStore } from "./useProductionStore"
import { useWarehouseStore } from "./useWarehouseStore"

export const useStore = () => ({
  ...useOrderStore(),
  ...useProductionStore(),
  ...useWarehouseStore(),
})
