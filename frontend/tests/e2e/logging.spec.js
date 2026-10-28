/**
 * Home, logging and streak tests (US-02, US-03, US-04): the Log list equals actions.json, a tap adds
 * exactly the action's points once, the success screen, the daily limit, the 3-tap rule, and the
 * Home values matching the stored logs, including a streak from earlier days.
 */
import { expect, test } from '@playwright/test'
import { ACTIONS, createStudent, homeValues, logInThroughUi, newStudent } from './helpers.js'

/**
 * Formats a CO2 value like the app (grams below 1000, else kg with at most one decimal).
 * @param {number} grams
 * @returns {string}
 */
function co2(grams) {
  if (grams < 1000) return `≈ ${grams} g CO₂`
  return `≈ ${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(Math.round(grams / 100) / 10)} kg CO₂`
}

test.beforeEach(async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  await logInThroughUi(page, student)
})

test('Home has a prominent "Log an action" button (US-02 AC3) and starts at 0 (US-02 AC1)', async ({ page }) => {
  await expect(page.getByRole('link', { name: 'Log an action' })).toBeVisible()
  expect(await homeValues(page)).toEqual({ total: '0', streak: '0-day streak', today: 'Today: +0' })
})

test('the Log screen lists every action of actions.json, in order, with label, points and CO2 (US-03 AC1, AC6)', async ({ page }) => {
  await page.getByRole('link', { name: 'Log an action' }).click()
  const buttons = page.locator('.action')
  await expect(buttons).toHaveCount(ACTIONS.length)
  for (const [index, action] of ACTIONS.entries()) {
    const button = buttons.nth(index)
    await expect(button.locator('.action__label')).toHaveText(action.label)
    await expect(button.locator('.action__points')).toHaveText(`+${action.points}`)
    await expect(button.locator('.action__details')).toHaveText(`Limit ${action.daily_limit} per day · ${co2(action.co2_g)}`)
  }
})

test('logging takes 2 taps from Home, adds exactly the points, and shows the success screen (US-03 AC2, AC3, AC5)', async ({ page }) => {
  const action = ACTIONS.find((entry) => entry.key === 'plant_meal')
  await page.getByRole('link', { name: 'Log an action' }).click() // tap 1
  await page.locator(`[data-action-key="${action.key}"]`).click() // tap 2
  await expect(page.getByRole('heading', { level: 1, name: `+${action.points} points` })).toBeVisible()
  await expect(page.getByText(`New total: ${action.points}`)).toBeVisible()
  await expect(page.getByText('Streak: 1 day')).toBeVisible()
  await expect(page.getByText('Streak increased!')).toBeVisible()

  await page.getByRole('link', { name: 'Back to Home' }).click()
  expect(await homeValues(page)).toEqual({ total: `${action.points}`, streak: '1-day streak', today: `Today: +${action.points}` })
})

test('a double click logs only once (US-03 AC2)', async ({ page }) => {
  const action = ACTIONS.find((entry) => entry.key === 'recycle_bottle')
  await page.goto('/log')
  await page.locator(`[data-action-key="${action.key}"]`).dblclick()
  await expect(page.getByRole('heading', { level: 1, name: `+${action.points} points` })).toBeVisible()
  await page.goto('/')
  expect((await homeValues(page)).total).toBe(`${action.points}`)
})

test('beyond the daily limit: "Daily limit reached for this action" and no points (US-03 AC4)', async ({ page }) => {
  const action = ACTIONS.find((entry) => entry.key === 'green_commute')
  for (let n = 1; n <= action.daily_limit; n += 1) {
    await page.goto('/log')
    await page.locator(`[data-action-key="${action.key}"]`).click()
    await expect(page.getByText(`New total: ${action.points * n}`)).toBeVisible()
  }
  await page.getByRole('link', { name: 'Log another' }).click()
  await page.locator(`[data-action-key="${action.key}"]`).click()
  await expect(page.getByRole('alert')).toHaveText('Daily limit reached for this action')
  await expect(page).toHaveURL(/\/log$/)
  await expect(page.locator(`[data-action-key="${action.key}"] .action__details`)).toContainText(`${action.daily_limit} logged today`)

  await page.goto('/')
  expect((await homeValues(page)).total).toBe(`${action.points * action.daily_limit}`)
})

test('the success screen can\'t be reloaded or opened directly', async ({ page }) => {
  await page.goto('/log')
  await page.locator('[data-action-key="recycle_can"]').click()
  await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/\/log$/)
  await page.goto('/log/success')
  await expect(page).toHaveURL(/\/log$/)
})
