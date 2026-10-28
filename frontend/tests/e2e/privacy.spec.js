/**
 * Privacy test (US-01 AC8): while one student uses every milestone 1 screen, every response from the
 * API is captured. None may contain another student's email, first name, last name or date of birth,
 * and no database function response may contain the student's own private fields either.
 */
import { expect, test } from '@playwright/test'
import { API_URL, createStudent, logInThroughUi, newStudent } from './helpers.js'

test('API responses never contain another student\'s private fields', async ({ page }) => {
  const other = newStudent({ firstName: 'Zeldaprivate', lastName: 'Quixoteprivate', birthDate: '07.07.1999' })
  await createStudent(other)
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
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.goto('/register')
  await page.getByLabel('Nickname', { exact: true }).fill(other.nickname)

  expect(responses.length).toBeGreaterThan(3)
  const othersPrivate = [other.email, other.firstName, other.lastName, '1999-07-07']
  for (const { url, body } of responses) {
    for (const value of othersPrivate) expect(body, `${url} contains ${value}`).not.toContain(value)
  }
  const ownPrivate = [me.email, me.firstName, me.lastName, '1998-08-08']
  for (const { url, body } of responses.filter((response) => response.url.includes('/rest/v1/'))) {
    for (const value of ownPrivate) expect(body, `${url} contains ${value}`).not.toContain(value)
  }
})
