import type { Page } from '@playwright/test'
import type { UserRole } from '../../../src/lib/permissions'

/**
 * Login UI akışını atlayıp direkt localStorage/sessionStorage'a auth objesi yazar.
 * Sayfa yüklenmeden önce çalışır → useAuth ilk render'da oturumu hazır görür.
 *
 * v16.40 — Multi-device single-session testleri için dbId/sessionId/authUserId opsiyonel parametreler.
 * dbId verilirse useAuth claimSession() çağrısını yapar (DB'ye yazar).
 * sessionId verilmezse migrate akışı kendisi üretir.
 */
export async function loginAs(
  page: Page,
  role: Exclude<UserRole, 'operator'>,
  options?: { username?: string; dbId?: string; sessionId?: string; authUserId?: string; email?: string }
) {
  const name = options?.username ?? `e2e-${role}`
  const authUser: Record<string, unknown> = {
    role,
    username: name,
    loginTime: new Date().toISOString(),
  }
  if (options?.dbId) authUser.dbId = options.dbId
  if (options?.sessionId) authUser.sessionId = options.sessionId
  if (options?.authUserId) authUser.authUserId = options.authUserId
  if (options?.email) authUser.email = options.email

  await page.addInitScript((data) => {
    localStorage.setItem('uys_v3_auth', JSON.stringify(data))
  }, authUser)
}

/**
 * Operatör oturumu — sessionStorage'a yazılır (tab kapanınca silinir).
 *
 * v16.40 — sessionId opsiyonel; verilmezse useAuth migrate akışı üretir.
 */
export async function loginAsOperator(
  page: Page,
  oprId: string,
  oprAd: string,
  options?: { sessionId?: string }
) {
  const authUser: Record<string, unknown> = {
    role: 'operator' as const,
    username: oprAd,
    loginTime: new Date().toISOString(),
    oprId,
  }
  if (options?.sessionId) authUser.sessionId = options.sessionId

  await page.addInitScript((data) => {
    sessionStorage.setItem('uys_v3_opr', JSON.stringify(data))
  }, authUser)
}

/**
 * Auth'u temizle — yeni test için login yok durumunu garanti et.
 */
export async function clearAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.removeItem('uys_v3_auth')
    sessionStorage.removeItem('uys_v3_opr')
  })
}
