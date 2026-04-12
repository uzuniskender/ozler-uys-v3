const LOG_KEY = 'uys_activity_log'
const MAX_LOGS = 200

export interface ActivityEntry {
  ts: string
  user: string
  action: string
  detail: string
}

export function logAction(action: string, detail: string = '') {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    const logs: ActivityEntry[] = stored ? JSON.parse(stored) : []
    const authStr = localStorage.getItem('uys_v3_auth')
    const user = authStr ? JSON.parse(authStr).username || 'admin' : 'system'

    logs.unshift({
      ts: new Date().toISOString().slice(0, 19).replace('T', ' '),
      user, action, detail,
    })

    // Max 200 kayıt tut
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS
    localStorage.setItem(LOG_KEY, JSON.stringify(logs))
  } catch {}
}

export function getActivityLog(): ActivityEntry[] {
  try {
    const stored = localStorage.getItem(LOG_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

export function clearActivityLog() {
  localStorage.removeItem(LOG_KEY)
}
