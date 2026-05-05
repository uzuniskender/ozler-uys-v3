import type { Page } from '@playwright/test'
import type { UserRole } from '../../../src/lib/permissions'
import { supabaseTest, TEST_URL } from './supabase'

/**
 * E2E test seed user'ları (TEST projesi migration: test_2026_05_05_e2e_users_v16_42)
 * Şifre: TestPass2026! — sadece TEST projesinde, PROD'a uygulanmaz.
 */
const TEST_PASSWORD = 'TestPass2026!'
const ROLE_TO_EMAIL: Record<Exclude<UserRole, 'operator'>, string> = {
  admin: 'test_admin@v16.test',
  planlama: 'test_kullanici@v16.test',
  depocu: 'test_depocu@v16.test',
} as Record<Exclude<UserRole, 'operator'>, string>

const ROLE_TO_DBID: Record<Exclude<UserRole, 'operator'>, string> = {
  admin: 'test-admin-dbid',
  planlama: 'test-kullanici-dbid',
  depocu: 'test-depocu-dbid',
} as Record<Exclude<UserRole, 'operator'>, string>

const ROLE_TO_AUTH_UID: Record<Exclude<UserRole, 'operator'>, string> = {
  admin: '11111111-1111-1111-1111-111111111111',
  planlama: '22222222-2222-2222-2222-222222222222',
  depocu: '55555555-5555-5555-5555-555555555555',
} as Record<Exclude<UserRole, 'operator'>, string>

function getProjectRef(): string {
  const m = TEST_URL.match(/https:\/\/([^.]+)\.supabase\.co/)
  if (!m) throw new Error('Supabase project ref alınamadı: ' + TEST_URL)
  return m[1]
}

/**
 * v16.42 — İstek #21: Supabase Auth login pattern
 *
 * Önceki (v16.40) sadece localStorage'a custom authUser yazıyordu.
 * 5 May TEST sync sonrası RLS authenticated kısıtlamasıyla anon RLS reddi → 5 fail.
 *
 * Yeni akış:
 * 1. supabaseTest.auth.signInWithPassword ile JWT al
 * 2. page.addInitScript ile localStorage'a sb-{ref}-auth-token yaz
 * 3. Custom uys_v3_auth da yaz (useAuth eski pattern korunur)
 *
 * Sonuç: Browser Supabase JS client storage'dan session okur, query'ler authenticated.
 */
export async function loginAs(
  page: Page,
  role: Exclude<UserRole, 'operator'>,
  options?: { username?: string; dbId?: string; sessionId?: string; authUserId?: string; email?: string }
) {
  const email = options?.email ?? ROLE_TO_EMAIL[role]
  const dbId = options?.dbId ?? ROLE_TO_DBID[role]
  const authUserId = options?.authUserId ?? ROLE_TO_AUTH_UID[role]
  const name = options?.username ?? `e2e-${role}`

  const { data: signIn, error } = await supabaseTest.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  })
  if (error || !signIn.session) {
    throw new Error(
      `[loginAs] Supabase Auth login fail (${role} / ${email}): ${error?.message || 'session yok'}`
    )
  }
  const session = signIn.session
  const projectRef = getProjectRef()
  const storageKey = `sb-${projectRef}-auth-token`

  const authUser: Record<string, unknown> = {
    role,
    username: name,
    loginTime: new Date().toISOString(),
    dbId,
    authUserId,
    email,
  }
  if (options?.sessionId) authUser.sessionId = options.sessionId

  await page.addInitScript(
    ({ key, sess, authUserPayload }) => {
      localStorage.setItem(key, JSON.stringify(sess))
      localStorage.setItem('uys_v3_auth', JSON.stringify(authUserPayload))
    },
    {
      key: storageKey,
      sess: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      },
      authUserPayload: authUser,
    }
  )

  // NOT: supabaseTest.auth.signOut() ÇAĞIRMIYORUZ — spec içindeki
  // supabaseTest.from(...).select() çağrıları authenticated kalmalı (RLS geçsin).
  // Sonraki test'te yeni signInWithPassword zaten önceki session'ı override eder.
}

/**
 * Operatör oturumu — sessionStorage'a yazılır (tab kapanınca silinir).
 * v16.40 davranışı korundu (operatör auth.users gerektirmiyor, DB seed ile çalışır).
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
 * v16.42 — Supabase auth storage da temizlenir.
 */
export async function clearAuth(page: Page) {
  const projectRef = getProjectRef()
  const supabaseKey = `sb-${projectRef}-auth-token`
  await page.addInitScript((sbKey) => {
    localStorage.removeItem('uys_v3_auth')
    localStorage.removeItem(sbKey)
    sessionStorage.removeItem('uys_v3_opr')
  }, supabaseKey)
}
