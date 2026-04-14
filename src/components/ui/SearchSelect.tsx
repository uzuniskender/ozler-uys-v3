import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
  sub?: string
}

interface SearchSelectProps {
  options: Option[]
  value: string
  onChange: (value: string, label: string) => void
  placeholder?: string
  allowNew?: boolean  // Yeni değer girmeye izin ver
  className?: string
  inputClassName?: string
}

export function SearchSelect({ options, value, onChange, placeholder = 'Ara...', allowNew = true, className = '', inputClassName }: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Display label for current value
  const displayLabel = options.find(o => o.value === value)?.label || value

  const filtered = options.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.label.toLowerCase().includes(q) || (o.sub || '').toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
  }).slice(0, 15)

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(opt: Option) {
    onChange(opt.value, opt.label)
    setSearch('')
    setOpen(false)
  }

  function handleInputChange(val: string) {
    setSearch(val)
    if (allowNew) onChange(val, val)
    if (!open) setOpen(true)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={open ? search : displayLabel}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => { setOpen(true); setSearch('') }}
        placeholder={placeholder}
        className={inputClassName || "w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent"}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-bg-1 border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.length ? filtered.map(o => (
            <button key={o.value} onClick={() => select(o)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-3 transition-colors ${o.value === value ? 'bg-accent/10 text-accent' : 'text-zinc-300'}`}>
              <div>{o.label}</div>
              {o.sub && <div className="text-[10px] text-zinc-600">{o.sub}</div>}
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-zinc-600">
              {search ? (allowNew ? `"${search}" yeni değer olarak kullanılacak` : 'Sonuç yok') : 'Liste boş'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
