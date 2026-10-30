/**
 * Badge and CO2 tests (US-15, US-14): a new student has earned none of the badges from badges.json;
 * the first log shows "New badge!" with the badge's name on the success screen, together with the
 * action's CO2 estimate; My badges and the profile then show it; Home shows the CO2 total.
 */
import { expect, test } from '@playwright/test'
import { ACTIONS, BADGES, createStudent, logInThroughUi, newStudent } from './helpers.js'

/**
 * Formats a CO2 value like the app (grams below 1000, else kg with at most one decimal).
 * @param {number} grams
 * @returns {string}
 */
function co2(grams) {
  if (grams < 1000) return `≈ ${grams} g CO₂`
  return `≈ ${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(Math.round(grams / 100) / 10)} kg CO₂`
}

test('badges and CO2: none earned at first, "New badge!" on the first log, then shown on My badges and the profile (US-15 AC1 to AC5; US-14 AC3, AC4)', async ({ page }) => {
  const me = newStudent()
  const myId = await createStudent(me)
  await logInThroughUi(page, me)
  await expect(page.getByTestId('co2-saved')).toHaveText('≈ 0 g CO₂ saved')
  await expect(page.getByTestId('home-badges-summary')).toHaveText(`0 of ${BADGES.length} earned`)

  await page.getByRole('link', { name: /My badges/ }).click()
  await expect(page.getByTestId('badges-summary')).toHaveText(`0 of ${BADGES.length} earned`)
  const tiles = page.getByTestId('badge-tile')
  await expect(tiles).toHaveCount(BADGES.length)
  for (const [index, badge] of BADGES.entries()) {
    await expect(tiles.nth(index)).toContainText(badge.label)
    await expect(tiles.nth(index)).toContainText('Locked')
  }
  await expect(tiles.first()).toContainText('Log your first action')

  // The first log earns "First action".
  const action = ACTIONS.find((entry) => entry.key === 'plant_meal')
  await page.goto('/log')
  await page.locator(`[data-action-key="${action.key}"]`).click()
  await expect(page.getByRole('heading', { level: 1, name: `+${action.points} points` })).toBeVisible()
  await expect(page.getByTestId('co2-logged')).toHaveText(`${co2(action.co2_g)} saved`)
  const firstBadge = BADGES.find((badge) => badge.rule === 'logs' && badge.threshold === 1)
  await expect(page.getByTestId('new-badge')).toHaveCount(1)
  await expect(page.getByTestId('new-badge')).toContainText(`New badge!${firstBadge.label}`)

  // The second log earns nothing new.
  await page.getByRole('link', { name: 'Log another' }).click()
  await page.locator('[data-action-key="recycle_can"]').click()
  await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
  await expect(page.getByTestId('new-badge')).toHaveCount(0)

  await page.getByRole('link', { name: 'Back to Home' }).click()
  const recycleCan = ACTIONS.find((entry) => entry.key === 'recycle_can')
  await expect(page.getByTestId('co2-saved')).toHaveText(`${co2(action.co2_g + recycleCan.co2_g)} saved`)
  await expect(page.getByTestId('home-badges-summary')).toHaveText(`1 of ${BADGES.length} earned`)

  await page.goto('/badges')
  await expect(page.locator('[data-testid="badge-tile"][data-earned="true"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="badge-tile"][data-earned="true"]')).toContainText(firstBadge.label)
  await expect(page.locator('[data-testid="badge-tile"][data-earned="true"]')).not.toContainText('Locked')

  // My profile (as others see it) shows the earned badge.
  await page.goto(`/students/${myId}`)
  await expect(page.getByRole('img', { name: firstBadge.label })).toBeVisible()
})
