import type { Page } from '@playwright/test'
import type { UserRole } from '../../../src/lib/permissions'

/**
 * Login UI akışını atlayıp direkt localStorage/sessionStorage'a auth objesi yazar.
 * Sayfa yüklenmeden önce çalışır → useAuth ilk render'da oturumu hazır görür.
 */
export async function loginAs(
  page: Page,
  role: Exclude<UserRole, 'operator'>,
  username?: string
) {
  const name = username ?? `e2e-${role}`
  const authUser = {
    role,
    username: name,
    loginTime: new Date().toISOString(),
  }
  await page.addInitScript((data) => {
    localStorage.setItem('uys_v3_auth', JSON.stringify(data))
  }, authUser)
}

/**
 * Operatör oturumu — sessionStorage'a yazılır (tab kapanınca silinir).
 */
export async function loginAsOperator(
  page: Page,
  oprId: string,
  oprAd: string
) {
  const authUser = {
    role: 'operator' as const,
    username: oprAd,
    loginTime: new Date().toISOString(),
    oprId,
  }
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
