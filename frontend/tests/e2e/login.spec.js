/**
 * Login, session and route guard tests (US-13): the login screen's elements, one message for any wrong
 * credentials, staying logged in across reloads and devices, logging out on one device only, and
 * visitors seeing only the login, registration, password reset and privacy screens.
 */
import { expect, test } from '@playwright/test'
import { createStudent, logInThroughUi, newStudent } from './helpers.js'

/** Every address of a logged-in page, plus an unknown one. */
const PROTECTED = [
  '/', '/log', '/log/success', '/leaderboard', '/leaderboard?tab=following', '/guide', '/history', '/badges',
  '/students', '/students?q=eco', '/students/00000000-0000-4000-8000-000000000000', '/does-not-exist',
]

test('the login screen has email, masked password, "Log in" and both links (US-13 AC1)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
  await page.getByRole('link', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Reset password' })).toBeVisible()
})

test('a wrong password and an unknown email show the same single message (US-13 AC2)', async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  for (const attempt of [
    { email: student.email, password: 'wrong-password' },
    { email: `nobody.${Date.now()}@greenie.test`, password: student.password },
  ]) {
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill(attempt.email)
    await page.getByLabel('Password', { exact: true }).fill(attempt.password)
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Email or password is incorrect', { exact: true })).toBeVisible()
    await expect(page.getByText(/password is incorrect|email is incorrect|no account/i)).toHaveCount(1)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('correct credentials open Home, and a reload keeps the session (US-13 AC2, AC4)', async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  await logInThroughUi(page, student)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${student.nickname}` })).toBeVisible()
  await page.goto('/log')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Log an action' })).toBeVisible()
})

test('logged-in students opening Log in or Register go to Home', async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  await logInThroughUi(page, student)
  for (const path of ['/login', '/register']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/$/)
  }
})

test('the same account works on two devices; logging out on one keeps the other logged in (US-13 AC3)', async ({ browser }) => {
  const student = newStudent()
  await createStudent(student)
  const phone = await browser.newContext()
  const laptop = await browser.newContext()
  const phonePage = await phone.newPage()
  const laptopPage = await laptop.newPage()
  await logInThroughUi(phonePage, student)
  await logInThroughUi(laptopPage, student)

  await phonePage.getByRole('button', { name: 'Log out' }).click()
  await expect(phonePage).toHaveURL(/\/login$/)
  await laptopPage.reload()
  await expect(laptopPage.getByRole('heading', { level: 1, name: `Hi, ${student.nickname}` })).toBeVisible()
  await phone.close()
  await laptop.close()
})

test('after "Log out", every protected page redirects to the login screen (US-13 AC5)', async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  await logInThroughUi(page, student)
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  for (const path of PROTECTED) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login$/)
  }
})

test('a visitor sees only the login, registration, password reset and privacy screens (US-13 AC6)', async ({ page }) => {
  for (const path of PROTECTED) {
    await page.goto(path)
    await expect(page, path).toHaveURL(/\/login$/)
  }
  for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/privacy']) {
    await page.goto(path)
    await expect(page, path).toHaveURL(new RegExp(`${path}$`))
  }
})
