import { useOrderStore } from "./useOrderStore"
import { useProductionStore } from "./useProductionStore"
import { useWarehouseStore } from "./useWarehouseStore"

export const loadAllStores = async () => {
  try {
    // örnek: store'ları tetikle
    const orderStore = useOrderStore.getState()
    const productionStore = useProductionStore.getState()
    const warehouseStore = useWarehouseStore.getState()

    // Eğer içinde fetch fonksiyonları varsa burada çağır
    // await orderStore.load?.()
    // await productionStore.load?.()
    // await warehouseStore.load?.()

    console.log("Tüm store'lar yüklendi")
  } catch (err) {
    console.error("Store yükleme hatası:", err)
  }
}