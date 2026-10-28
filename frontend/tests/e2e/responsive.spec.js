/**
 * Responsive check (brief section 9: mobile-first, from 360 px): every milestone 1 screen at 360, 390,
 * 768 and 1280 px wide has no horizontal scrolling. Full-page screenshots go to test-results/ for the
 * QA report. Runs once, in Chromium.
 */
import { expect, test } from '@playwright/test'
import { createStudent, logInThroughUi, newStudent } from './helpers.js'

const WIDTHS = [360, 390, 768, 1280]

/**
 * Checks for horizontal scrolling and saves a screenshot.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} name
 * @returns {Promise<void>}
 */
async function check(page, testInfo, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `${name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0)
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true })
}

for (const width of WIDTHS) {
  test(`no horizontal scrolling at ${width} px`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'runs once, in Chromium')
    await page.setViewportSize({ width, height: width < 768 ? 800 : 900 })

    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
    await check(page, testInfo, `${width}-login`)
    await page.goto('/register')
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await check(page, testInfo, `${width}-register`)

    const student = newStudent({ nickname: `wide_${width}_${Date.now().toString(36).slice(-6)}` })
    await createStudent(student)
    await logInThroughUi(page, student)
    await check(page, testInfo, `${width}-home`)
    await page.goto('/log')
    await expect(page.locator('.action').first()).toBeVisible()
    await check(page, testInfo, `${width}-log`)
    await page.locator('[data-action-key="green_commute"]').click()
    await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
    await check(page, testInfo, `${width}-success`)
    await page.goto('/leaderboard')
    await expect(page.getByText('Coming in Milestone 2.')).toBeVisible()
    await check(page, testInfo, `${width}-placeholder`)
  })
}
