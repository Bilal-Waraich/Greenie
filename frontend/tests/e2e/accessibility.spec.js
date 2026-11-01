/**
 * Accessibility tests (brief section 9, "readable contrast, labelled buttons and fields"): no serious
 * or critical axe violations (WCAG 2.1 A and AA rules) on any screen or state, and a keyboard-only
 * walk through registering, logging an action and logging out.
 */
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { createStudent, fillRegistration, follow, insertLog, logInThroughUi, newStudent } from './helpers.js'

/**
 * Fails with the rule ids if axe finds serious or critical problems.
 * @param {import('@playwright/test').Page} page
 * @param {string} screen - Name for the failure message.
 * @returns {Promise<void>}
 */
async function expectAccessible(page, screen) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.nodes[0]?.target.join(' ')}`)
  expect(serious, screen).toEqual([])
}

test('visitor screens and their error states', async ({ page }) => {
  await page.goto('/login')
  await expectAccessible(page, 'Log in')
  await page.getByLabel('Email', { exact: true }).fill('nobody@greenie.test')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Email or password is incorrect')).toBeVisible()
  await expectAccessible(page, 'Log in (error)')

  await page.goto('/register')
  await expectAccessible(page, 'Register')
  await fillRegistration(page, newStudent({ email: 'x', password: '1', nickname: '-', birthDate: '1.1.2020' }))
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expectAccessible(page, 'Register (errors)')

  await page.goto('/forgot-password')
  await expectAccessible(page, 'Reset password')
  await page.getByLabel('Email', { exact: true }).fill('x')
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  await expectAccessible(page, 'Reset password (error)')
  await page.getByLabel('Email', { exact: true }).fill(`nobody.${Date.now()}@greenie.test`)
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.getByText('If this email has an account, we sent a link')).toBeVisible()
  await expectAccessible(page, 'Reset password (confirmation)')

  await page.goto('/reset-password')
  await expect(page.getByRole('alert')).toBeVisible()
  await expectAccessible(page, 'Set a new password (no link)')

  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectAccessible(page, 'Privacy (visitor)')
})

test('logged-in screens and states', async ({ page }) => {
  const student = newStudent()
  const studentId = await createStudent(student)
  await logInThroughUi(page, student)
  await expectAccessible(page, 'Home')

  // Empty states before any log or follow.
  await page.goto('/history')
  await expect(page.getByText('Nothing logged yet.')).toBeVisible()
  await expectAccessible(page, 'My history (empty)')
  await page.goto('/leaderboard?tab=following')
  await expect(page.getByText('You are not following anyone yet')).toBeVisible()
  await expectAccessible(page, 'Leaderboard (Following empty)')
  await page.goto('/badges')
  await expect(page.getByTestId('badge-tile').first()).toBeVisible()
  await expectAccessible(page, 'My badges (none yet)')

  await page.goto('/log')
  await expect(page.locator('.action').first()).toBeVisible()
  await expectAccessible(page, 'Log action')
  await page.locator('[data-action-key="second_hand"]').click()
  await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
  await expect(page.getByTestId('new-badge')).toBeVisible()
  await expectAccessible(page, 'Success (new badge)')
  await page.getByRole('link', { name: 'Log another' }).click()
  await page.locator('[data-action-key="second_hand"]').click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expectAccessible(page, 'Log action (limit reached)')

  // Filled states.
  const friend = newStudent()
  const friendId = await createStudent(friend)
  await insertLog(friendId, 'plant_meal', new Date().toISOString())
  await follow(studentId, friendId)
  await page.goto('/leaderboard')
  await expect(page.getByTestId('board-row').first()).toBeVisible()
  await expectAccessible(page, 'Leaderboard (Everyone)')
  await page.goto('/leaderboard?tab=following')
  await expect(page.getByTestId('board-row').first()).toBeVisible()
  await expectAccessible(page, 'Leaderboard (Following)')
  await page.goto('/history')
  await expect(page.getByTestId('history-list')).toBeVisible()
  await expectAccessible(page, 'My history')
  await page.goto('/badges')
  await expect(page.locator('[data-earned="true"]')).toBeVisible()
  await expectAccessible(page, 'My badges (some earned)')
  await page.goto(`/students?q=${friend.nickname}`)
  await expect(page.getByTestId('search-results')).toBeVisible()
  await expectAccessible(page, 'Find students (results)')
  await page.getByLabel('Search', { exact: true }).fill('no-such-student-xyz')
  await expect(page.getByText('No student found')).toBeVisible()
  await expectAccessible(page, 'Find students (no result)')
  await page.goto(`/students/${friendId}`)
  await expect(page.getByRole('button', { name: 'Unfollow' })).toBeVisible()
  await expectAccessible(page, 'Student profile (following)')
  await page.goto('/guide')
  await expect(page.getByTestId('guide-list')).toBeVisible()
  await expectAccessible(page, 'Guide')
  await page.getByLabel('Filter', { exact: true }).fill('xyzxyz')
  await expect(page.getByText('No entries match your filter')).toBeVisible()
  await expectAccessible(page, 'Guide (no results)')

  await page.goto('/')
  await page.getByRole('button', { name: 'Delete my account' }).click()
  await expect(page.getByRole('heading', { name: 'Delete your account?' })).toBeVisible()
  await expectAccessible(page, 'Home (delete confirmation)')

  for (const path of ['/students', '/privacy', '/does-not-exist']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectAccessible(page, path)
  }
})

test('keyboard only: register, log an action, back to Home, log out', async ({ page, browserName }) => {
  // Safari (WebKit) skips links on Tab unless "Press Tab to highlight each item" is turned on.
  test.skip(browserName === 'webkit', 'WebKit does not move to links with Tab by default')
  const student = newStudent()
  const heading = page.getByRole('heading', { level: 1 })
  await page.goto('/register')
  await expect(heading).toBeFocused() // each page moves focus to its heading after navigation
  for (const value of [student.email, student.password, student.nickname, student.firstName, student.lastName, student.birthDate, student.university]) {
    await page.keyboard.press('Tab')
    await page.keyboard.type(value)
  }
  await page.keyboard.press('Tab')
  await expect(page.getByRole('checkbox')).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('Tab') // the "privacy notice" link in the checkbox label
  await expect(page.getByRole('link', { name: /^privacy notice/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Create account' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${student.nickname}` })).toBeVisible()
  await expect(heading).toBeFocused()

  await page.keyboard.press('Tab') // Log out
  await page.keyboard.press('Tab') // Log an action
  await expect(page.getByRole('link', { name: 'Log an action' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: 'Log an action' })).toBeVisible()
  await expect(page.locator('.action').first()).toBeVisible()
  await expect(heading).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.action').first()).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 1, name: /points$/ })).toBeVisible()
  await expect(heading).toBeFocused()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Back to Home' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('total-points')).toBeVisible()
  await expect(heading).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Log out' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/login$/)
})
