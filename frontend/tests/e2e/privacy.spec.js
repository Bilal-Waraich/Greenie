/**
 * Privacy test (US-01 AC8, US-11 AC4, US-15 AC5): while one student uses every screen, including
 * search, another student's profile and both leaderboards, every response from the API is captured.
 * None may contain another student's email, first name, last name or date of birth, and no database
 * function response may contain the student's own private fields either.
 */
import { expect, test } from '@playwright/test'
import { API_URL, createStudent, insertLog, logInThroughUi, newStudent } from './helpers.js'

test('API responses never contain another student\'s private fields', async ({ page }) => {
  const other = newStudent({ firstName: 'Zeldaprivate', lastName: 'Quixoteprivate', birthDate: '07.07.1999' })
  const otherId = await createStudent(other)
  await insertLog(otherId, 'plant_meal', new Date().toISOString())
  const me = newStudent({ firstName: 'Ownfirstname', lastName: 'Ownlastname', birthDate: '08.08.1998' })
  await createStudent(me)

  const responses = []
  page.on('response', async (response) => {
    if (!response.url().startsWith(API_URL)) return
    try {
      responses.push({ url: response.url(), body: await response.text() })
    } catch {
      // Some responses (redirects, aborted requests) have no body.
    }
  })

  await logInThroughUi(page, me)
  await page.getByRole('link', { name: 'Log an action' }).click()
  await page.locator('[data-action-key="recycle_can"]').click()
  await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
  await page.getByRole('link', { name: 'Back to Home' }).click()
  await expect(page.getByTestId('total-points')).toBeVisible()

  await page.goto(`/students?q=${other.nickname}`)
  await page.getByTestId('search-results').getByRole('link').first().click()
  await page.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()
  await page.goto('/leaderboard')
  await expect(page.getByTestId('board-row').first()).toBeVisible()
  await page.goto('/leaderboard?tab=following')
  await expect(page.getByTestId('board-row').filter({ hasText: other.nickname })).toBeVisible()
  await page.goto('/history')
  await expect(page.getByTestId('history-list')).toBeVisible()
  await page.goto('/badges')
  await expect(page.getByTestId('badge-tile').first()).toBeVisible()
  await page.goto('/')
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.goto('/register')
  await page.getByLabel('Nickname', { exact: true }).fill(other.nickname)

  expect(responses.length).toBeGreaterThan(10)
  for (const name of ['search_students', 'get_student_profile', 'follow_student', 'get_leaderboard', 'get_my_history', 'get_my_badges']) {
    expect(responses.some((response) => response.url.includes(`/rpc/${name}`)), `${name} was called`).toBe(true)
  }
  const othersPrivate = [other.email, other.firstName, other.lastName, '1999-07-07']
  for (const { url, body } of responses) {
    for (const value of othersPrivate) expect(body, `${url} contains ${value}`).not.toContain(value)
  }
  const ownPrivate = [me.email, me.firstName, me.lastName, '1998-08-08']
  for (const { url, body } of responses.filter((response) => response.url.includes('/rest/v1/'))) {
    for (const value of ownPrivate) expect(body, `${url} contains ${value}`).not.toContain(value)
  }
})
