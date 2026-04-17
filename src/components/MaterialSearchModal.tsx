import { useState, useMemo, useEffect } from 'react'
import type { Material } from '@/types'
import { X, Search, RotateCcw } from 'lucide-react'

export interface MaterialSearchFilter {
  boy?: number
  en?: number
  kalinlik?: number
  uzunluk?: number
  cap?: number
  icCap?: number
  tip?: string
  hammaddeTipi?: string
}

interface Props {
  materials: Material[]
  defaultFilter?: MaterialSearchFilter
  allowedTypes?: string[]
  title?: string
  onSelect: (mat: Material) => void
  onClose: () => void
}

export function MaterialSearchModal({
  materials,
  defaultFilter,
  allowedTypes,
  title = 'Malzeme Ara',
  onSelect,
  onClose,
}: Props) {
  const [filter, setFilter] = useState<MaterialSearchFilter>(defaultFilter || {})
  const [search, setSearch] = useState('')

  // Default filter değişirse sıfırdan uygula
  useEffect(() => {
    setFilter(defaultFilter || {})
  }, [JSON.stringify(defaultFilter)])

  const filtered = useMemo(() => {
    return materials.filter(m => {
      if (!m.aktif && m.aktif !== undefined) return false
      if (allowedTypes?.length && !allowedTypes.includes(m.tip)) return false
      if (filter.tip && m.tip !== filter.tip) return false
      if (filter.hammaddeTipi && m.hammaddeTipi !== filter.hammaddeTipi) return false
      // Ölçü tolerans = 0 (tam eşleşme). Boş/0 filtre uygulanmaz.
      if (filter.boy && m.boy !== filter.boy) return false
      if (filter.en && m.en !== filter.en) return false
      if (filter.kalinlik && m.kalinlik !== filter.kalinlik) return false
      if (filter.uzunluk && m.uzunluk !== filter.uzunluk) return false
      if (filter.cap && m.cap !== filter.cap) return false
      if (filter.icCap && m.icCap !== filter.icCap) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(m.kod + ' ' + m.ad).toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [materials, filter, search, allowedTypes])

  function updateFilter(key: keyof MaterialSearchFilter, value: string) {
    const num = value === '' ? undefined : parseFloat(value)
    setFilter(f => ({ ...f, [key]: num }))
  }

  function clearAllFilters() {
    setFilter({})
    setSearch('')
  }

  const olcuAlanlari: { key: keyof MaterialSearchFilter; label: string }[] = [
    { key: 'boy', label: 'Boy' },
    { key: 'en', label: 'En' },
    { key: 'kalinlik', label: 'Kalınlık' },
    { key: 'uzunluk', label: 'Uzunluk' },
    { key: 'cap', label: 'Çap' },
    { key: 'icCap', label: 'İç Çap' },
  ]

  const filterActiveCount = Object.values(filter).filter(v => v !== undefined && v !== '').length

  // Varsayılan ölçülerin listede ürün verip vermediğini kontrol et
  const defaultVarMi = defaultFilter && Object.keys(defaultFilter).some(k => {
    const v = defaultFilter[k as keyof MaterialSearchFilter]
    return v !== undefined && v !== 0 && v !== ''
  })
  const defaultUygulandi = defaultVarMi && Object.keys(defaultFilter || {}).every(k => {
    const v = defaultFilter![k as keyof MaterialSearchFilter]
    if (v === undefined || v === 0 || v === '') return true
    return filter[k as keyof MaterialSearchFilter] === v
  })

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

        {/* Ölçü Filtreleri */}
        <div className="px-5 py-3 border-b border-border bg-bg-2/30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">Ölçü Filtreleri</div>
            <div className="flex gap-2">
              {defaultVarMi && !defaultUygulandi && (
                <button onClick={() => setFilter(defaultFilter || {})}
                  className="text-[10px] text-accent hover:underline">
                  ↻ Varsayılan ölçülere dön
                </button>
              )}
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

        {/* Metin Arama */}
        <div className="px-5 py-3 border-b border-border">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Kod veya ad ile arama..."
            autoFocus
            className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Sonuç listesi */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              {filterActiveCount > 0 || search
                ? 'Filtreye uygun malzeme bulunamadı. Filtreleri temizlemeyi deneyin.'
                : 'Kayıt yok.'}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-bg-1 border-b border-border text-zinc-500">
                <tr>
                  <th className="text-left px-4 py-2">Kod</th>
                  <th className="text-left px-4 py-2">Ad</th>
                  <th className="text-left px-3 py-2">Tip</th>
                  <th className="text-right px-3 py-2">Boy</th>
                  <th className="text-right px-3 py-2">En</th>
                  <th className="text-right px-3 py-2">Kalınlık</th>
                  <th className="text-right px-3 py-2">Çap</th>
                  <th className="text-left px-3 py-2">Birim</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map(m => (
                  <tr
                    key={m.id}
                    onClick={() => onSelect(m)}
                    className="border-b border-border/30 hover:bg-accent/5 cursor-pointer"
                  >
                    <td className="px-4 py-1.5 font-mono text-accent">{m.kod}</td>
                    <td className="px-4 py-1.5 text-zinc-300">{m.ad}</td>
                    <td className="px-3 py-1.5 text-zinc-500">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        m.tip === 'YarıMamul' ? 'bg-amber/15 text-amber'
                        : m.tip === 'Mamul' ? 'bg-green/15 text-green'
                        : m.tip === 'Sarf' ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-cyan-500/15 text-cyan-400'
                      }`}>
                        {m.tip || 'HM'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{m.boy || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{m.en || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{m.kalinlik || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-zinc-400">{m.cap || '—'}</td>
                    <td className="px-3 py-1.5 text-zinc-500">{m.birim || 'Adet'}</td>
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
          <div>{filtered.length} malzeme · bir satıra tıklayarak seçin</div>
          <button onClick={onClose} className="px-3 py-1.5 bg-bg-3 text-zinc-400 rounded hover:text-white">Kapat</button>
        </div>
      </div>
    </div>
  )
}
