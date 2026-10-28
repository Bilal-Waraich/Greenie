/**
 * Streak on the live screens (US-04): logs on earlier Zürich days continue the streak shown on Home and
 * on the success screen. The brief's full test table runs in the database tests
 * (supabase/tests/database/streak.test.sql), which can choose any "today".
 */
import { expect, test } from '@playwright/test'
import { createStudent, homeValues, insertLog, logInThroughUi, newStudent } from './helpers.js'

/**
 * Noon in Zürich, a number of days before today, as a UTC ISO timestamp.
 * @param {number} daysAgo
 * @returns {string}
 */
function zurichNoon(daysAgo) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date())
  const day = new Date(`${today}T10:00:00Z`) // 11:00 or 12:00 in Zürich, safely inside the day
  day.setUTCDate(day.getUTCDate() - daysAgo)
  return day.toISOString()
}

test('logs yesterday and the day before: streak 2 until today\'s log makes it 3 (US-04 AC2)', async ({ page }) => {
  const student = newStudent()
  const id = await createStudent(student)
  await insertLog(id, 'recycle_can', zurichNoon(2))
  await insertLog(id, 'recycle_can', zurichNoon(1))
  await insertLog(id, 'reusable_bag', zurichNoon(1))
  await logInThroughUi(page, student)
  expect(await homeValues(page)).toEqual({ total: '25', streak: '2-day streak', today: 'Today: +0' })

  await page.goto('/log')
  await page.locator('[data-action-key="recycle_can"]').click()
  await expect(page.getByText('Streak: 3 days')).toBeVisible()
  await expect(page.getByText('Streak increased!')).toBeVisible()
  await page.getByRole('link', { name: 'Log another' }).click()
  await page.locator('[data-action-key="recycle_can"]').click()
  await expect(page.getByText('Streak: 3 days')).toBeVisible()
  await expect(page.getByText('Streak increased!')).toHaveCount(0)
})

test('nothing logged yesterday: streak 0 until the next log, then 1 (US-04 AC3)', async ({ page }) => {
  const student = newStudent()
  const id = await createStudent(student)
  await insertLog(id, 'recycle_can', zurichNoon(3))
  await insertLog(id, 'recycle_can', zurichNoon(2))
  await logInThroughUi(page, student)
  expect((await homeValues(page)).streak).toBe('0-day streak')
  await page.goto('/log')
  await page.locator('[data-action-key="recycle_paper"]').click()
  await expect(page.getByText('Streak: 1 day')).toBeVisible()
})
