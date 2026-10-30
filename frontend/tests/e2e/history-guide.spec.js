/**
 * My history and Guide tests (US-05, US-07): the last 20 entries newest first with label, points and
 * Zürich date and time, the empty state; every guide.json entry, and the filter narrowing the list as
 * the student types, with the "no results" state.
 */
import { expect, test } from '@playwright/test'
import { ACTIONS, createStudent, GUIDE, insertLog, logInThroughUi, newStudent } from './helpers.js'

/**
 * A Zürich time as the history shows it ("08:05").
 * @param {Date} date
 * @returns {string}
 */
function zurichTime(date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/**
 * Noon UTC on the UTC date a number of days ago (the same calendar date in Zürich).
 * @param {number} daysAgo
 * @returns {Date}
 */
function noonDaysAgo(daysAgo) {
  const day = new Date(Date.now() - daysAgo * 86_400_000)
  day.setUTCHours(12, 0, 0, 0)
  return day
}

test('My history: empty state, then the last 20 entries newest first (US-05 AC1, AC2)', async ({ page }) => {
  const me = newStudent()
  const myId = await createStudent(me)
  await logInThroughUi(page, me)
  await page.getByRole('link', { name: /My history/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'My history' })).toBeVisible()
  await expect(page.getByText('Nothing logged yet.')).toBeVisible()

  // 24 older logs (one a day, at noon UTC), then one logged through the app now.
  for (let daysAgo = 25; daysAgo >= 2; daysAgo -= 1) {
    await insertLog(myId, 'recycle_can', noonDaysAgo(daysAgo).toISOString())
  }
  await page.goto('/log')
  await page.locator('[data-action-key="plant_meal"]').click()
  await expect(page.getByRole('heading', { level: 1, name: '+15 points' })).toBeVisible()
  const loggedAt = new Date()

  await page.goto('/history')
  const rows = page.getByTestId('history-list').locator('li')
  await expect(rows).toHaveCount(20)
  const plantMeal = ACTIONS.find((action) => action.key === 'plant_meal')
  await expect(rows.first()).toContainText(plantMeal.label)
  await expect(rows.first()).toContainText('+15')
  await expect(rows.first()).toContainText(new RegExp(`Today, (${zurichTime(loggedAt)}|${zurichTime(new Date(loggedAt.getTime() - 60_000))})`))
  await expect(rows.nth(1)).toContainText('Recycled a can')
  // The 20th entry is the 19th newest of the older logs: 20 days ago, shown as "Mon 19 Oct, 13:00".
  const twentieth = noonDaysAgo(20)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short' }).format(twentieth).replace(',', '')
  await expect(rows.last()).toContainText(`${day}, ${zurichTime(twentieth)}`)
})

test('Guide: every entry of guide.json, and the filter narrows the list as I type (US-07 AC1, AC2)', async ({ page }) => {
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)
  await page.getByRole('link', { name: 'Guide' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Which bin in Zürich?' })).toBeVisible()

  const rows = page.getByTestId('guide-list').locator('li')
  await expect(rows).toHaveCount(GUIDE.length)
  for (const [index, entry] of GUIDE.entries()) {
    await expect(rows.nth(index)).toContainText(entry.item)
    await expect(rows.nth(index)).toContainText(entry.where)
  }

  const filter = page.getByLabel('Filter', { exact: true })
  await filter.pressSequentially('batt')
  await expect(rows).toHaveCount(GUIDE.filter((entry) => `${entry.item} ${entry.where} ${entry.note}`.toLowerCase().includes('batt')).length)
  await expect(rows.first()).toContainText('Batteries')

  await filter.fill('zuri-sack')
  await expect(rows).toHaveCount(GUIDE.filter((entry) => `${entry.item} ${entry.where} ${entry.note}`.includes('Züri-Sack')).length)

  await filter.fill('xyzxyz')
  await expect(page.getByText('No entries match your filter')).toBeVisible()
  await filter.fill('')
  await expect(rows).toHaveCount(GUIDE.length)
})
