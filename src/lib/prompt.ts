/**
 * Browser prompt() yerine uygulama içi modal prompt
 * Kullanım: const value = await showPrompt('Başlık', 'placeholder', 'varsayılan')
 */
import { toast } from 'sonner'

export function showPrompt(label: string, placeholder?: string, defaultValue?: string): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center'
    overlay.style.background = 'rgba(0,0,0,0.6)'
    overlay.innerHTML = `
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:600px;font-family:system-ui">
        <div style="font-size:14px;font-weight:600;color:#e4e4e7;margin-bottom:12px">${label}</div>
        <input id="_prompt_input" type="text" placeholder="${placeholder || ''}" value="${defaultValue || ''}"
          style="width:100%;padding:10px 12px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;color:#e4e4e7;font-size:13px;outline:none;box-sizing:border-box" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button id="_prompt_cancel" style="padding:8px 16px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;color:#a1a1aa;font-size:12px;cursor:pointer">İptal</button>
          <button id="_prompt_ok" style="padding:8px 16px;background:#06b6d4;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Tamam</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    const input = document.getElementById('_prompt_input') as HTMLInputElement
    input?.focus()
    input?.select()

    function close(val: string | null) {
      document.body.removeChild(overlay)
      resolve(val)
    }

    document.getElementById('_prompt_cancel')!.onclick = () => close(null)
    document.getElementById('_prompt_ok')!.onclick = () => close(input.value)
    input.onkeydown = (e) => { if (e.key === 'Enter') close(input.value); if (e.key === 'Escape') close(null) }
  })
}

/**
 * Çoklu input prompt — birden fazla alan
 */
export function showMultiPrompt(title: string, fields: { label: string; key: string; defaultValue?: string; type?: string }[]): Promise<Record<string, string> | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center'
    overlay.style.background = 'rgba(0,0,0,0.6)'

    const fieldsHtml = fields.map((f, i) => `
      <div style="margin-bottom:10px">
        <label style="font-size:11px;color:#a1a1aa;display:block;margin-bottom:4px">${f.label}</label>
        <input id="_mp_${i}" type="${f.type || 'text'}" value="${f.defaultValue || ''}"
          style="width:100%;padding:8px 10px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:6px;color:#e4e4e7;font-size:13px;outline:none;box-sizing:border-box" />
      </div>
    `).join('')

    overlay.innerHTML = `
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:600px;font-family:system-ui">
        <div style="font-size:14px;font-weight:600;color:#e4e4e7;margin-bottom:16px">${title}</div>
        ${fieldsHtml}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button id="_mp_cancel" style="padding:8px 16px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;color:#a1a1aa;font-size:12px;cursor:pointer">İptal</button>
          <button id="_mp_ok" style="padding:8px 16px;background:#06b6d4;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Tamam</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    const firstInput = document.getElementById('_mp_0') as HTMLInputElement
    firstInput?.focus()

    function close(ok: boolean) {
      if (ok) {
        const result: Record<string, string> = {}
        fields.forEach((f, i) => { result[f.key] = (document.getElementById(`_mp_${i}`) as HTMLInputElement)?.value || '' })
        document.body.removeChild(overlay)
        resolve(result)
      } else {
        document.body.removeChild(overlay)
        resolve(null)
      }
    }

    document.getElementById('_mp_cancel')!.onclick = () => close(false)
    document.getElementById('_mp_ok')!.onclick = () => close(true)
  })
}

/**
 * Browser confirm() yerine uygulama içi onay modal
 */
export function showConfirm(message: string, title?: string): Promise<boolean> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center'
    overlay.style.background = 'rgba(0,0,0,0.6)'
    overlay.innerHTML = `
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:500px;font-family:system-ui">
        ${title ? `<div style="font-size:14px;font-weight:600;color:#e4e4e7;margin-bottom:8px">${title}</div>` : ''}
        <div style="font-size:13px;color:#a1a1aa;margin-bottom:20px;white-space:pre-line;line-height:1.5">${message}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="_confirm_no" style="padding:8px 20px;background:#1a1a2e;border:1px solid #2a2a3e;border-radius:8px;color:#a1a1aa;font-size:12px;cursor:pointer">İptal</button>
          <button id="_confirm_yes" style="padding:8px 20px;background:#ef4444;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Evet</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    function close(val: boolean) {
      document.body.removeChild(overlay)
      resolve(val)
    }

    document.getElementById('_confirm_no')!.onclick = () => close(false)
    document.getElementById('_confirm_yes')!.onclick = () => close(true)
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', handler) }
      if (e.key === 'Enter') { close(true); document.removeEventListener('keydown', handler) }
    })
  })
}

/**
 * Browser alert() yerine uygulama içi bilgi modal
 */
export function showAlert(message: string, title?: string): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center'
    overlay.style.background = 'rgba(0,0,0,0.6)'
    overlay.innerHTML = `
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:600px;max-height:70vh;font-family:system-ui;display:flex;flex-direction:column">
        ${title ? `<div style="font-size:14px;font-weight:600;color:#e4e4e7;margin-bottom:8px">${title}</div>` : ''}
        <div style="font-size:12px;color:#a1a1aa;margin-bottom:20px;white-space:pre-line;line-height:1.6;overflow-y:auto;flex:1">${message}</div>
        <div style="display:flex;justify-content:flex-end">
          <button id="_alert_ok" style="padding:8px 24px;background:#06b6d4;border:none;border-radius:8px;color:#fff;font-size:12px;font-weight:600;cursor:pointer">Tamam</button>
        </div>
      </div>`
    document.body.appendChild(overlay)

    function close() { document.body.removeChild(overlay); resolve() }

    document.getElementById('_alert_ok')!.onclick = close
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Enter' || e.key === 'Escape') { close(); document.removeEventListener('keydown', handler) }
    })
  })
}

/**
 * Şifre korumalı işlem — admin şifresi ayarlanmışsa şifre sor
 * localStorage'da 'uys_admin_pass' varsa kontrol eder
 */
export async function requirePassword(action: string): Promise<boolean> {
  const storedPass = localStorage.getItem('uys_admin_pass')
  if (!storedPass) return true // Şifre ayarlanmamışsa geç

  const entered = await showPrompt(`"${action}" için admin şifresi girin`, 'Şifre')
  if (!entered) return false
  if (entered !== storedPass) {
    toast.error('Şifre hatalı')
    return false
  }
  return true
}
