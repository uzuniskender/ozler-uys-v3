import { useState } from 'react'
import { Menu, LogOut, RefreshCw, Key } from 'lucide-react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface TopbarProps {
  onMenuClick: () => void
  onSignOut: () => void
}

export function Topbar({ onMenuClick, onSignOut }: TopbarProps) {
  const { synced, loadAll } = useStore()
  const { user } = useAuth()
  const [showPassModal, setShowPassModal] = useState(false)
  const isTestMode = localStorage.getItem('uys_test_mode') === 'true'

  return (
    <>
    {isTestMode && (
      <div className="bg-amber text-black text-center text-xs font-bold py-1">
        ⚠ TEST ORTAMI — Veriler gerçek sisteme kaydedilmektedir, test sonrası temizleyin
        <button onClick={() => { localStorage.removeItem('uys_test_mode'); window.location.reload() }} className="ml-3 px-2 py-0.5 bg-black/20 rounded text-[10px]">Kapat</button>
      </div>
    )}
    <header className="h-12 bg-bg-1 border-b border-border flex items-center px-4 gap-3">
      <button onClick={onMenuClick} className="lg:hidden text-zinc-400 hover:text-white">
        <Menu size={20} />
      </button>

      <div className="flex-1" />

      {!isTestMode && (
        <button onClick={() => { localStorage.setItem('uys_test_mode', 'true'); window.location.reload() }}
          className="text-[10px] text-zinc-600 hover:text-amber px-2 py-0.5 rounded" title="Test modunu aç">🧪 Test</button>
      )}

      {user && (
        <span className="text-[11px] text-zinc-500 font-mono">{user.email ? `${user.username} (${user.email})` : user.username}</span>
      )}

      <div className="flex items-center gap-1.5 text-[11px] font-mono">
        <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-green' : 'bg-red'}`} />
        <span className="text-zinc-500">{synced ? 'Bağlı' : 'Çevrimdışı'}</span>
      </div>

      <button onClick={() => loadAll()} className="text-zinc-500 hover:text-zinc-300" title="Yenile"><RefreshCw size={14} /></button>
      <button onClick={() => setShowPassModal(true)} className="text-zinc-500 hover:text-amber" title="Şifre Değiştir"><Key size={14} /></button>
      <button onClick={onSignOut} className="text-zinc-500 hover:text-red" title="Çıkış"><LogOut size={14} /></button>
    </header>

    {showPassModal && <PassModal onClose={() => setShowPassModal(false)} />}
    </>
  )
}

function PassModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')

  function save() {
    if (current !== 'admin123' && current !== localStorage.getItem('uys_admin_pass')) {
      toast.error('Mevcut şifre hatalı'); return
    }
    if (newPass.length < 4) { toast.error('Yeni şifre en az 4 karakter olmalı'); return }
    if (newPass !== confirm) { toast.error('Şifreler eşleşmiyor'); return }
    localStorage.setItem('uys_admin_pass', newPass)
    toast.success('Şifre değiştirildi — yeni giriş: ' + newPass)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Şifre Değiştir</h2>
        <div className="space-y-3">
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Mevcut Şifre</label>
          <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" autoFocus /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Yeni Şifre</label>
          <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[11px] text-zinc-500 mb-1 block">Yeni Şifre (Tekrar)</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-accent" /></div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 bg-bg-3 text-zinc-400 rounded-lg text-xs">İptal</button>
          <button onClick={save} className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold">Değiştir</button>
        </div>
      </div>
    </div>
  )
}
