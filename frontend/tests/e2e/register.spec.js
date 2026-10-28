/**
 * Registration tests (US-01): field errors next to each field, consent gating the button, duplicate
 * email and nickname in another letter case, the age rule, and a successful sign-up landing on Home
 * with 0 points and streak 0.
 */
import { expect, test } from '@playwright/test'
import { createStudent, fillRegistration, homeValues, newStudent } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/register')
})

test('"Create account" stays disabled until the consent box is ticked (US-01 AC5)', async ({ page }) => {
  const button = page.getByRole('button', { name: 'Create account' })
  await expect(page.getByText('I agree to the privacy notice')).toBeVisible()
  await expect(button).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(button).toBeEnabled()
  await page.getByRole('checkbox').uncheck()
  await expect(button).toBeDisabled()
})

test('every invalid field shows its error next to it, and no account is created (US-01 AC1, AC4)', async ({ page }) => {
  const student = newStudent({
    email: 'not-an-email', password: '1234567', nickname: 'no-way', firstName: ' ', lastName: 'x'.repeat(51),
    birthDate: '31.02.2001', university: 'E',
  })
  await fillRegistration(page, student)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()

  const expected = {
    Email: 'Enter a valid email address',
    Password: 'Password needs at least 8 characters',
    Nickname: '3–20 characters, letters, digits, _',
    'First name': '1–50 characters',
    'Last name': '1–50 characters',
    'Date of birth': 'Enter a valid date as DD.MM.YYYY',
    University: '2–60 characters',
  }
  for (const [label, message] of Object.entries(expected)) {
    const input = page.getByLabel(label, { exact: true })
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription(message)
  }
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused()
  await expect(page).toHaveURL(/\/register$/)
})

test('the password field is masked (US-01 AC6)', async ({ page }) => {
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
})

test('a 15-year-old is refused: "You must be at least 16" (US-01 AC1)', async ({ page }) => {
  const today = new Date()
  const birth = new Date(Date.UTC(today.getUTCFullYear() - 15, today.getUTCMonth(), today.getUTCDate()))
  const birthDate = `${String(birth.getUTCDate()).padStart(2, '0')}.${String(birth.getUTCMonth() + 1).padStart(2, '0')}.${birth.getUTCFullYear()}`
  await fillRegistration(page, newStudent({ birthDate }))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Date of birth', { exact: true })).toHaveAccessibleDescription('You must be at least 16')
  await expect(page).toHaveURL(/\/register$/)
})

test('an email already registered, in another case, is refused (US-01 AC2)', async ({ page }) => {
  const existing = newStudent()
  await createStudent(existing)
  await fillRegistration(page, newStudent({ email: existing.email.toUpperCase() }))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveAccessibleDescription('Email already registered')
  await expect(page).toHaveURL(/\/register$/)
})

test('a nickname already taken, in another case, is refused next to the field (US-01 AC3)', async ({ page }) => {
  const existing = newStudent()
  await createStudent(existing)
  await fillRegistration(page, newStudent({ nickname: existing.nickname.toUpperCase() }))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Nickname', { exact: true })).toHaveAccessibleDescription('Nickname taken')
  await expect(page).toHaveURL(/\/register$/)
})

test('a valid sign-up logs in and lands on Home with 0 points and streak 0 (US-01 AC7)', async ({ page }) => {
  const student = newStudent()
  await fillRegistration(page, student)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${student.nickname}` })).toBeVisible()
  await expect(page).toHaveURL(/\/$/)
  expect(await homeValues(page)).toEqual({ total: '0', streak: '0-day streak', today: 'Today: +0' })
})
