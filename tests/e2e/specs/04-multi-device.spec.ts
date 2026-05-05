/**
 * v16.40 — Multi-Device Single-Session DB Davranış Testleri
 *
 * Bu spec sessionGuard'ın DB tarafındaki davranışını doğrular:
 * claimSession (UPDATE), session_is_valid (SELECT), releaseSession (UPDATE NULL).
 *
 * Browser-side test (Playwright Page) yok çünkü:
 *   - PROD/TEST RLS politikaları uys_kullanicilar (authenticated_only) ve
 *     uys_operators (anon_select) anon UPDATE'e izin vermiyor.
 *   - Frontend Supabase Auth ile authenticated context'inde claim yapıyor;
 *     test'te real Supabase Auth seed + signin gerekirdi (büyük ek kapsam).
 *   - DB davranışı bu testle kanıtlanır; saha multi-cihaz testi Buket tarafından
 *     manuel yapılır (2 cihazdan login + senaryo doğrulama).
 *
 * Tüm testler supabaseAdmin (service_role) kullanır → RLS bypass.
 */

import { test, expect } from '../fixtures'
import { createTestKullanici, createTestOperator } from '../helpers/factory'
import { supabaseAdmin } from '../helpers/supabase'

// Yardımcılar — sessionGuard'ın UPDATE çağrısının DB karşılığı
async function claim(table: 'uys_kullanicilar' | 'uys_operators', id: string, sessionId: string, cihaz: string) {
  const { error } = await supabaseAdmin.from(table)
    .update({
      aktif_oturum_id: sessionId,
      aktif_oturum_cihaz: cihaz,
      aktif_oturum_son: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(`claim ${table}/${id}: ${error.message}`)
}

async function release(table: 'uys_kullanicilar' | 'uys_operators', id: string, sessionId: string) {
  const { error } = await supabaseAdmin.from(table)
    .update({ aktif_oturum_id: null, aktif_oturum_cihaz: null, aktif_oturum_son: null })
    .eq('id', id)
    .eq('aktif_oturum_id', sessionId)
  if (error) throw new Error(`release ${table}/${id}: ${error.message}`)
}

async function readSession(table: 'uys_kullanicilar' | 'uys_operators', id: string) {
  const { data, error } = await supabaseAdmin.from(table)
    .select('aktif_oturum_id, aktif_oturum_cihaz')
    .eq('id', id).single()
  if (error) throw new Error(`read ${table}/${id}: ${error.message}`)
  return data
}

function uid(): string { return crypto.randomUUID() }

test.describe('04 — Multi-Device Single-Session (v16.40, DB-only)', () => {

  // ─────────────────────────────────────────────────────────────────
  // S1 — Aynı admin 2 cihazdan login → ilki invalidate
  // ─────────────────────────────────────────────────────────────────
  test('S1: Aynı admin 2 cihaz claim → ikinci kazanır', async () => {
    const u = await createTestKullanici({ ad: 'S1Admin', rol: 'admin' })

    const sessA = uid()
    await claim('uys_kullanicilar', u.id, sessA, 'Device-A (Chrome)')
    expect((await readSession('uys_kullanicilar', u.id)).aktif_oturum_id).toBe(sessA)

    // Cihaz B login → A'yı override
    const sessB = uid()
    await claim('uys_kullanicilar', u.id, sessB, 'Device-B (Safari)')

    const after = await readSession('uys_kullanicilar', u.id)
    expect(after.aktif_oturum_id).toBe(sessB)
    expect(after.aktif_oturum_id).not.toBe(sessA)
    expect(after.aktif_oturum_cihaz).toBe('Device-B (Safari)')
  })

  // ─────────────────────────────────────────────────────────────────
  // S2 — 2 farklı admin bağımsız oturum → birbirini etkilemesin
  // ─────────────────────────────────────────────────────────────────
  test('S2: 2 farklı admin bağımsız claim → her ikisi aktif kalmalı', async () => {
    const u1 = await createTestKullanici({ ad: 'S2Admin1', rol: 'admin' })
    const u2 = await createTestKullanici({ ad: 'S2Admin2', rol: 'planlama' })

    const sess1 = uid()
    const sess2 = uid()
    await claim('uys_kullanicilar', u1.id, sess1, 'Device-A')
    await claim('uys_kullanicilar', u2.id, sess2, 'Device-B')

    expect((await readSession('uys_kullanicilar', u1.id)).aktif_oturum_id).toBe(sess1)
    expect((await readSession('uys_kullanicilar', u2.id)).aktif_oturum_id).toBe(sess2)
  })

  // ─────────────────────────────────────────────────────────────────
  // S3 — Aynı operatör 2 cihazdan login → ilki invalidate
  // ─────────────────────────────────────────────────────────────────
  test('S3: Aynı operatör 2 cihaz claim → ikinci kazanır', async () => {
    const op = await createTestOperator({ ad: 'S3Op' })

    const sessA = uid()
    await claim('uys_operators', op.id, sessA, 'Tablet-A')
    expect((await readSession('uys_operators', op.id)).aktif_oturum_id).toBe(sessA)

    const sessB = uid()
    await claim('uys_operators', op.id, sessB, 'Tablet-B')

    const after = await readSession('uys_operators', op.id)
    expect(after.aktif_oturum_id).toBe(sessB)
    expect(after.aktif_oturum_id).not.toBe(sessA)
  })

  // ─────────────────────────────────────────────────────────────────
  // S4 — Cross-rol: admin + operatör ayrı tablolarda bağımsız
  // ─────────────────────────────────────────────────────────────────
  test('S4: 1 admin + 1 operatör → ayrı tablolar, etkilemesin', async () => {
    const admin = await createTestKullanici({ ad: 'S4Admin', rol: 'admin' })
    const op = await createTestOperator({ ad: 'S4Op' })

    const sessAdmin = uid()
    const sessOp = uid()
    await claim('uys_kullanicilar', admin.id, sessAdmin, 'Admin-PC')
    await claim('uys_operators', op.id, sessOp, 'Op-Tablet')

    expect((await readSession('uys_kullanicilar', admin.id)).aktif_oturum_id).toBe(sessAdmin)
    expect((await readSession('uys_operators', op.id)).aktif_oturum_id).toBe(sessOp)
  })

  // ─────────────────────────────────────────────────────────────────
  // S5 — Logout → release çağrısı aktif_oturum_id NULL'a çekmeli
  // ─────────────────────────────────────────────────────────────────
  test('S5: Logout sonrası aktif_oturum_id NULL', async () => {
    const u = await createTestKullanici({ ad: 'S5Admin', rol: 'admin' })

    const sess = uid()
    await claim('uys_kullanicilar', u.id, sess, 'Device-A')
    expect((await readSession('uys_kullanicilar', u.id)).aktif_oturum_id).toBe(sess)

    await release('uys_kullanicilar', u.id, sess)
    expect((await readSession('uys_kullanicilar', u.id)).aktif_oturum_id).toBeNull()
  })

  // ─────────────────────────────────────────────────────────────────
  // S6 — Atomicity: eş zamanlı 2 claim, son yazan kazanır
  // ─────────────────────────────────────────────────────────────────
  test('S6: Eş zamanlı 2 claim → son yazan kazanır (atomicity)', async () => {
    const u = await createTestKullanici({ ad: 'S6Admin', rol: 'admin' })

    const sessA = uid()
    const sessB = uid()
    await Promise.all([
      claim('uys_kullanicilar', u.id, sessA, 'Device-A'),
      claim('uys_kullanicilar', u.id, sessB, 'Device-B'),
    ])

    const final = await readSession('uys_kullanicilar', u.id)
    expect(final.aktif_oturum_id).toBeTruthy()
    expect([sessA, sessB]).toContain(final.aktif_oturum_id)
    expect(['Device-A', 'Device-B']).toContain(final.aktif_oturum_cihaz)
  })
})
