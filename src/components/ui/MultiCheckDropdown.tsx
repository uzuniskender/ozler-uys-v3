import { useState, useRef, useEffect } from 'react'

type Option = string | { value: string; label: string; color?: string }

interface MultiCheckDropdownProps {
  label: string
  options: Option[]
  selected: Set<string>
  onChange: (selected: Set<string>) => void
}

export function MultiCheckDropdown({ label, options, selected, onChange }: MultiCheckDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const getVal = (o: Option) => typeof o === 'string' ? o : o.value
  const getLabel = (o: Option) => typeof o === 'string' ? o : o.label
  const getColor = (o: Option) => typeof o === 'string' ? '' : o.color || ''
  const allVals = options.map(getVal)

  function toggle(val: string) {
    const next = new Set(selected)
    next.has(val) ? next.delete(val) : next.add(val)
    onChange(next)
  }

  const count = selected.size

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="px-3 py-2 bg-bg-2 border border-border rounded-lg text-xs text-zinc-300 flex items-center gap-2 hover:border-zinc-500 min-w-[140px]">
        <span className="flex-1 text-left truncate">
          {count === 0 || count === allVals.length ? label : `${label} (${count})`}
        </span>
        <span className="text-zinc-600 text-[10px]">▼</span>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-1 border border-border rounded-lg shadow-xl z-50 min-w-[180px] py-1">
          <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-bg-3/50 border-b border-border/50">
            <input type="checkbox" checked={count === allVals.length} onChange={() => onChange(count === allVals.length ? new Set() : new Set(allVals))} className="accent-accent" />
            <span className="text-zinc-400 font-medium">Tümü</span>
          </label>
          {options.map(opt => (
            <label key={getVal(opt)} className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-bg-3/50">
              <input type="checkbox" checked={selected.has(getVal(opt))} onChange={() => toggle(getVal(opt))} className="accent-accent" />
              <span className={`text-zinc-300 ${getColor(opt)}`}>{getLabel(opt)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
