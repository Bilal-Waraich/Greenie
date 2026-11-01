/**
 * Find students, profiles, follow and unfollow tests (US-11, US-12): search by part of a nickname in
 * any letter case, at most 20 results with nickname and university, "No student found", the profile's
 * values without private fields, the Follow/Unfollow toggle surviving a refresh, one-way following, and
 * no Follow button on the student's own profile.
 */
import { expect, test } from '@playwright/test'
import { createStudent, createStudentsWithPoints, deleteStudentsByPrefix, insertLog, logInThroughUi, newStudent } from './helpers.js'

/**
 * Types a search on the Find students screen and waits for the answer.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @returns {Promise<void>}
 */
async function search(page, text) {
  await page.getByLabel('Search', { exact: true }).fill(text)
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

test('search finds part of a nickname in any letter case, with nickname and university; "No student found" (US-11 AC1, AC2)', async ({ page }) => {
  const suffix = Math.random().toString(36).slice(2, 8)
  const target = newStudent({ nickname: `Findme_${suffix}`, university: 'ZHdK' })
  await createStudent(target)
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)

  await page.getByRole('link', { name: /Find students/ }).click()
  await expect(page.getByText('Type a nickname to find students')).toBeVisible()
  await search(page, `DME_${suffix.toUpperCase()}`)
  const results = page.getByTestId('search-results').getByRole('link')
  await expect(results).toHaveCount(1)
  await expect(results.first()).toContainText(target.nickname)
  await expect(results.first()).toContainText('ZHdK')

  await search(page, `nobody_${suffix}`)
  await expect(page.getByText('No student found')).toBeVisible()
  await search(page, '')
  await expect(page.getByText('Type a nickname to find students')).toBeVisible()
})

test('search shows at most 20 results (US-11 AC1)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates many students; runs once, in Chromium')
  const prefix = `sr${Math.random().toString(36).slice(2, 8)}`
  createStudentsWithPoints(Array.from({ length: 22 }, (_, index) => `${prefix}_${String(index).padStart(2, '0')}`), 1)
  try {
    const me = newStudent()
    await createStudent(me)
    await logInThroughUi(page, me)
    await page.goto('/students')
    await search(page, prefix)
    await expect(page.getByTestId('search-results').getByRole('link')).toHaveCount(20)
    await expect(page.getByTestId('search-results').getByRole('link').first()).toContainText(`${prefix}_00`)
  } finally {
    deleteStudentsByPrefix(prefix)
  }
})

test('a profile shows nickname, university, points and streak, never private fields; Follow survives a refresh (US-11 AC3, AC4; US-12 AC1)', async ({ page }) => {
  const other = newStudent({ firstName: 'Hiddenfirst', lastName: 'Hiddenlast', birthDate: '09.09.1999', university: 'PHZH' })
  const otherId = await createStudent(other)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString()
  await insertLog(otherId, 'plant_meal', yesterday)
  await insertLog(otherId, 'recycle_can', new Date().toISOString())
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)

  await page.goto('/students')
  await search(page, other.nickname)
  await page.getByTestId('search-results').getByRole('link').first().click()
  await expect(page.getByRole('heading', { level: 1, name: other.nickname })).toBeVisible()
  await expect(page.getByText('PHZH')).toBeVisible()
  await expect(page.getByTestId('profile-total')).toHaveText('25')
  await expect(page.getByTestId('profile-streak')).toHaveText('2 days')
  // Yesterday counts this week unless today is Monday in Zürich.
  const mondayInZurich = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short' }).format(new Date()) === 'Mon'
  await expect(page.getByTestId('profile-week')).toHaveText(mondayInZurich ? '10' : '25')
  for (const hidden of ['Hiddenfirst', 'Hiddenlast', '1999', other.email]) {
    await expect(page.locator('main')).not.toContainText(hidden)
  }

  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()
  await page.getByRole('button', { name: 'Unfollow' }).click()
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
})

test('following is one-way, and my own profile has no Follow button (US-12 AC2, AC3)', async ({ browser }) => {
  const alice = newStudent()
  const aliceId = await createStudent(alice)
  const bob = newStudent()
  const bobId = await createStudent(bob)

  const alicePage = await (await browser.newContext()).newPage()
  await logInThroughUi(alicePage, alice)
  await alicePage.goto(`/students/${bobId}`)
  await alicePage.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(alicePage.getByRole('button', { name: 'Unfollow' })).toBeVisible()

  const bobPage = await (await browser.newContext()).newPage()
  await logInThroughUi(bobPage, bob)
  await bobPage.goto(`/students/${aliceId}`)
  await expect(bobPage.getByRole('button', { name: 'Follow', exact: true })).toBeVisible()
  await bobPage.goto(`/students/${bobId}`)
  await expect(bobPage.getByText('This is your profile.')).toBeVisible()
  await expect(bobPage.getByRole('button', { name: /Follow/ })).toHaveCount(0)
  await alicePage.context().close()
  await bobPage.context().close()
})

test('an unknown or malformed profile address shows "Student not found"', async ({ page }) => {
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
    await page.goto(`/students/${id}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Student not found' })).toBeVisible()
  }
})
