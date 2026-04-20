import { useState, useMemo, useEffect } from 'react'
import type { Recipe, Material } from '@/types'
import { X, Search, RotateCcw } from 'lucide-react'

export interface RecipeSearchFilter {
  boy?: number
  en?: number
  kalinlik?: number
  uzunluk?: number
  cap?: number
  icCap?: number
}

interface Props {
  recipes: Recipe[]
  materials: Material[]
  defaultFilter?: RecipeSearchFilter
  title?: string
  onSelect: (sel: { rcId: string; mamulKod: string; mamulAd: string }) => void
  onClose: () => void
}

type EnrichedRecipe = {
  rcId: string
  rcKod: string
  rcAd: string
  mamulKod: string
  mamulAd: string
  boy: number
  en: number
  kalinlik: number
  uzunluk: number
  cap: number
  icCap: number
  birim: string
  tip: string
}

export function RecipeSearchModal({
  recipes,
  materials,
  defaultFilter,
  title = 'Reçete / Ürün Ara',
  onSelect,
  onClose,
}: Props) {
  const [filter, setFilter] = useState<RecipeSearchFilter>(defaultFilter || {})
  const [search, setSearch] = useState('')

  useEffect(() => {
    setFilter(defaultFilter || {})
  }, [JSON.stringify(defaultFilter)])

  // Reçeteleri, bağlı oldukları mamulün ölçü bilgileriyle birleştir
  const enriched: EnrichedRecipe[] = useMemo(() => {
    return recipes.map(r => {
      const mat = materials.find(m => m.kod === r.mamulKod)
      return {
        rcId: r.id,
        rcKod: r.rcKod || '',
        rcAd: r.ad || '',
        mamulKod: r.mamulKod || '',
        mamulAd: r.mamulAd || r.ad || '',
        boy: mat?.boy || 0,
        en: mat?.en || 0,
        kalinlik: mat?.kalinlik || 0,
        uzunluk: mat?.uzunluk || 0,
        cap: mat?.cap || 0,
        icCap: mat?.icCap || 0,
        birim: mat?.birim || '',
        tip: mat?.tip || '',
      }
    })
  }, [recipes, materials])

  const filtered = useMemo(() => {
    return enriched.filter(e => {
      if (filter.boy && e.boy !== filter.boy) return false
      if (filter.en && e.en !== filter.en) return false
      if (filter.kalinlik && e.kalinlik !== filter.kalinlik) return false
      if (filter.uzunluk && e.uzunluk !== filter.uzunluk) return false
      if (filter.cap && e.cap !== filter.cap) return false
      if (filter.icCap && e.icCap !== filter.icCap) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = (e.rcKod + ' ' + e.rcAd + ' ' + e.mamulKod + ' ' + e.mamulAd).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [enriched, filter, search])

  function updateFilter(key: keyof RecipeSearchFilter, value: string) {
    const num = value === '' ? undefined : parseFloat(value)
    setFilter(f => ({ ...f, [key]: num }))
  }

  function clearAllFilters() {
    setFilter({})
    setSearch('')
  }

  const olcuAlanlari: { key: keyof RecipeSearchFilter; label: string }[] = [
    { key: 'boy', label: 'Boy' },
    { key: 'en', label: 'En' },
    { key: 'kalinlik', label: 'Kalınlık' },
    { key: 'uzunluk', label: 'Uzunluk' },
    { key: 'cap', label: 'Çap' },
    { key: 'icCap', label: 'İç Çap' },
  ]

  const filterActiveCount = Object.values(filter).filter(v => v !== undefined && v !== '').length

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Search size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">{title}</h2>
            {filterActiveCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 bg-accent/15 text-accent rounded-full font-mono">
                {filterActiveCount} filtre aktif
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="px-5 py-3 border-b border-border bg-bg-2/30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">Ölçü Filtreleri</div>
            <div className="flex gap-2">
              {filterActiveCount > 0 && (
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-amber">
                  <RotateCcw size={10} /> Tüm filtreleri temizle
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {olcuAlanlari.map(o => (
              <div key={o.key}>
                <label className="text-[10px] text-zinc-500 mb-0.5 block">{o.label}</label>
                <input
                  type="number"
                  value={filter[o.key] ?? ''}
                  onChange={e => updateFilter(o.key, e.target.value)}
                  placeholder="—"
                  className="w-full px-2 py-1 bg-bg-2 border border-border rounded text-xs text-zinc-200 focus:outline-none focus:border-accent"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-border">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Reçete kodu, ürün kodu veya ad ile arama..."
            autoFocus
            className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              {filterActiveCount > 0 || search
                ? 'Filtreye uygun reçete bulunamadı. Filtreleri temizlemeyi deneyin.'
                : 'Kayıt yok.'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-1 border-b border-border text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2">Ürün Kodu</th>
                  <th className="text-left px-4 py-2">Ürün Adı</th>
                  <th className="text-right px-3 py-2">Boy</th>
                  <th className="text-right px-3 py-2">En</th>
                  <th className="text-right px-3 py-2">Kalınlık</th>
                  <th className="text-right px-3 py-2">Uzunluk</th>
                  <th className="text-right px-3 py-2">Çap</th>
                  <th className="text-left px-3 py-2">Birim</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(e => (
                  <tr
                    key={e.rcId}
                    onClick={() => onSelect({ rcId: e.rcId, mamulKod: e.mamulKod, mamulAd: e.mamulAd })}
                    className="border-b border-border/30 hover:bg-accent/5 cursor-pointer"
                  >
                    <td className="px-4 py-1.5 font-mono text-accent">{e.mamulKod || '—'}</td>
                    <td className="px-4 py-1.5 text-zinc-300">{e.mamulAd || e.rcAd || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{e.boy || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{e.en || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{e.kalinlik || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{e.uzunluk || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{e.cap || '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{e.birim || 'Adet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 200 && (
            <div className="p-2 text-center text-[10px] text-zinc-600">
              {filtered.length} sonuçtan ilk 200 gösteriliyor. Filtreleri daraltın.
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex items-center justify-between text-[11px] text-zinc-500">
          <div>{filtered.length} reçete · bir satıra tıklayarak seçin</div>
          <button onClick={onClose} className="px-3 py-1.5 bg-bg-3 text-zinc-400 rounded hover:text-white">Kapat</button>
        </div>
      </div>
    </div>
  )
}
