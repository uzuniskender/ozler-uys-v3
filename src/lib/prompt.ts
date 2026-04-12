/**
 * Browser prompt() yerine uygulama içi modal prompt
 * Kullanım: const value = await showPrompt('Başlık', 'placeholder', 'varsayılan')
 */
export function showPrompt(label: string, placeholder?: string, defaultValue?: string): Promise<string | null> {
  return new Promise(resolve => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[999] flex items-center justify-center'
    overlay.style.background = 'rgba(0,0,0,0.6)'
    overlay.innerHTML = `
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:380px;font-family:system-ui">
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
    overlay.onclick = (e) => { if (e.target === overlay) close(null) }
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
      <div style="background:#12121e;border:1px solid #2a2a3e;border-radius:12px;padding:24px;width:90%;max-width:400px;font-family:system-ui">
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
    overlay.onclick = (e) => { if (e.target === overlay) close(false) }
  })
}
