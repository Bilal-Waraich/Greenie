/**
 * Responsive check (brief section 9: mobile-first, from 360 px): every screen at 360, 390, 768 and
 * 1280 px wide has no horizontal scrolling. Full-page screenshots go to test-results/ for the QA
 * report. Runs once, in Chromium.
 */
import { expect, test } from '@playwright/test'
import { createStudent, follow, insertLog, logInThroughUi, newStudent } from './helpers.js'

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
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await check(page, testInfo, `${width}-privacy`)
    await page.goto('/forgot-password')
    await expect(page.getByRole('button', { name: 'Send link' })).toBeVisible()
    await check(page, testInfo, `${width}-reset-password`)

    const student = newStudent({ nickname: `wide_${width}_${Date.now().toString(36).slice(-6)}` })
    const studentId = await createStudent(student)
    const friend = newStudent({ nickname: `wider_friend_${width}_${Math.random().toString(36).slice(2, 5)}`.slice(0, 20) })
    const friendId = await createStudent(friend)
    await insertLog(friendId, 'plant_meal', new Date().toISOString())
    await follow(studentId, friendId)
    await logInThroughUi(page, student)
    await check(page, testInfo, `${width}-home`)
    await page.goto('/log')
    await expect(page.locator('.action').first()).toBeVisible()
    await check(page, testInfo, `${width}-log`)
    await page.locator('[data-action-key="green_commute"]').click()
    await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
    await check(page, testInfo, `${width}-success`)

    const screens = [
      ['/leaderboard', 'board-row', 'leaderboard'],
      ['/leaderboard?tab=following', 'board-row', 'leaderboard-following'],
      ['/guide', 'guide-list', 'guide'],
      ['/history', 'history-list', 'history'],
      ['/badges', 'badge-tile', 'badges'],
      [`/students?q=${friend.nickname}`, 'search-results', 'find-students'],
    ]
    for (const [path, testId, name] of screens) {
      await page.goto(path)
      await expect(page.getByTestId(testId).first()).toBeVisible()
      await check(page, testInfo, `${width}-${name}`)
    }
    await page.goto(`/students/${friendId}`)
    await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()
    await check(page, testInfo, `${width}-profile`)
  })
}
