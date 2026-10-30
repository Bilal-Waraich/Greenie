/**
 * Account tests (US-09, US-10): deleting the account after a confirmation (and cancelling it), after
 * which the student can't log in and is gone from search; and resetting a forgotten password through
 * the emailed link, read from the local mail viewer (Mailpit), with the same answer for unknown emails,
 * the 8-character rule, and the old password no longer working.
 */
import { expect, test } from '@playwright/test'
import { createStudent, emailedLink, logInThroughUi, newStudent } from './helpers.js'

/**
 * Tries to log in and expects the "incorrect" message.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 * @returns {Promise<void>}
 */
async function expectLoginRefused(page, email, password) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Email or password is incorrect')).toBeVisible()
}

test('"Delete my account" asks first; Cancel keeps the account (US-09 AC1)', async ({ page }) => {
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeFocused()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${me.nickname}` })).toBeVisible()
})

test('deleting the account removes it: back to Log in, can\'t log in again, gone from search (US-09 AC1, AC2)', async ({ page, browser }) => {
  const me = newStudent()
  await createStudent(me)
  const other = newStudent()
  await createStudent(other)

  await logInThroughUi(page, me)
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await page.locator('.confirm-box').getByRole('button', { name: 'Delete my account' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expectLoginRefused(page, me.email, me.password)

  const otherPage = await (await browser.newContext()).newPage()
  await logInThroughUi(otherPage, other)
  await otherPage.goto(`/students?q=${me.nickname}`)
  await expect(otherPage.getByText('No student found')).toBeVisible()
  await otherPage.context().close()
})

test('"Forgot password?" always answers the same, for known and unknown emails (US-10 AC1)', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reset password' })).toBeVisible()
  await expect(page.getByText('Enter your email and we will send you a link.')).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(`nobody.${Date.now()}@greenie.test`)
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('If this email has an account, we sent a link')).toBeVisible()

  await page.getByLabel('Email', { exact: true }).fill('not-an-email')
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
})

test('the emailed link sets a new password of at least 8 characters; the old one stops working (US-10 AC2, AC3)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'sends real (local) email; runs once, in Chromium')
  const me = newStudent()
  await createStudent(me)
  const requestedAt = Date.now()
  await page.goto('/forgot-password')
  await page.getByLabel('Email', { exact: true }).fill(me.email.toUpperCase())
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('If this email has an account, we sent a link')).toBeVisible()

  const link = await emailedLink(me.email, requestedAt)
  await page.goto(link)
  await expect(page).toHaveURL(/\/reset-password/)
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible()
  await expect(page.getByText('Opened from the emailed link.')).toBeVisible()

  await page.getByLabel('New password', { exact: true }).fill('short')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password needs at least 8 characters')).toBeVisible()

  const newPassword = `new-${me.password}`
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText('Password saved. You can log in now.')).toBeVisible()
  await page.getByRole('link', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await expectLoginRefused(page, me.email, me.password)
  await logInThroughUi(page, { ...me, password: newPassword })
})

test('the "Set a new password" page refuses to work without a reset link (US-10)', async ({ page }) => {
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)
  await page.goto('/reset-password')
  await expect(page.getByText('This link is invalid or has expired. Please ask for a new one.')).toBeVisible()
  await expect(page.getByLabel('New password', { exact: true })).toHaveCount(0)
  await page.goto('/') // a fresh page load, as when an expired link is opened
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByText('This link is invalid or has expired. Please ask for a new one.')).toBeVisible()
})
