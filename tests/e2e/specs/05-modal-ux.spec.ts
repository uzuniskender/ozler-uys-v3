import { test, expect } from '../fixtures'
import { loginAs } from '../helpers/auth'

test.describe('05 — Yeni İş Emri Modal UX (v16.43)', () => {
  test('modal-default-adet: adet input boş başlar, placeholder görünür', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    // "Yeni İş Emri" butonuna tıkla → modal aç
    await page.locator('button:has-text("Yeni İş Emri")').first().click()

    // Modal title görünür
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).toBeVisible({ timeout: 5_000 })

    // Adet input boş — value="" (1 değil)
    const adetInput = page.locator('input[type="number"]').first()
    await expect(adetInput).toHaveValue('')

    // Placeholder hint
    await expect(adetInput).toHaveAttribute('placeholder', /örn|adet/i)

    // Oluştur butonu disabled (canSubmit false: adet boş + rcId boş)
    const olusturBtn = page.locator('button:has-text("Oluştur")').first()
    await expect(olusturBtn).toBeDisabled()

    // Adet'e 5 yaz → input value="5"
    await adetInput.fill('5')
    await expect(adetInput).toHaveValue('5')

    // Adet'i sil → tekrar boş, Oluştur hâlâ disabled
    await adetInput.fill('')
    await expect(adetInput).toHaveValue('')
    await expect(olusturBtn).toBeDisabled()
  })

  test('modal-drag: header sürükleme ile modal pozisyonu değişir', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni İş Emri")').first().click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).toBeVisible({ timeout: 5_000 })

    const modal = page.getByTestId('ie-modal')
    const header = page.getByTestId('ie-modal-header')
    await expect(modal).toBeVisible()
    await expect(header).toBeVisible()

    const before = await modal.boundingBox()
    expect(before).not.toBeNull()

    const headerBox = await header.boundingBox()
    expect(headerBox).not.toBeNull()
    const startX = headerBox!.x + headerBox!.width / 2
    const startY = headerBox!.y + headerBox!.height / 2

    // Drag: header üzerinde mouse down → 200px sağa, 100px aşağı → mouse up
    // Pointer Events için intermediate move'lar şart
    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 50, startY + 30, { steps: 5 })
    await page.mouse.move(startX + 200, startY + 100, { steps: 10 })
    await page.mouse.up()

    // Yeni pozisyon — modal sağa+aşağı kaymış olmalı
    const after = await modal.boundingBox()
    expect(after).not.toBeNull()
    expect(after!.x).toBeGreaterThan(before!.x + 50) // en az 50px sağa
    expect(after!.y).toBeGreaterThan(before!.y + 20) // en az 20px aşağı
  })

  test('modal-drag-input-not-affected: body input drag olarak yorumlanmaz', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/#/orders')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })

    await page.locator('button:has-text("Yeni İş Emri")').first().click()
    await expect(page.locator('h2:has-text("Yeni İş Emri")')).toBeVisible({ timeout: 5_000 })

    const modal = page.getByTestId('ie-modal')
    const before = await modal.boundingBox()

    // Adet input'u üzerinde mouse down + move → modal kaymamalı
    const adetInput = page.locator('input[type="number"]').first()
    const inputBox = await adetInput.boundingBox()
    expect(inputBox).not.toBeNull()

    await page.mouse.move(inputBox!.x + 5, inputBox!.y + 5)
    await page.mouse.down()
    await page.mouse.move(inputBox!.x + 200, inputBox!.y + 100, { steps: 5 })
    await page.mouse.up()

    const after = await modal.boundingBox()
    // Modal pozisyonu değişmemeli (body üzerinde drag yok)
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(5)
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(5)
  })
})
