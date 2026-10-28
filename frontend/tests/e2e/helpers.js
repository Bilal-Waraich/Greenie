/**
 * Shared helpers for the end-to-end tests: fake students, direct data set-up through the LOCAL admin
 * API (refused for any non-local address), and common UI steps.
 */
import { createClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readLocalStatus, REPO_ROOT } from '../../scripts/local-supabase.mjs'
import { parsePrivacyText } from '../../src/lib/privacyText.js'

const local = readLocalStatus()

/** Admin client for the local stack only (readLocalStatus refuses other addresses). */
export const admin = createClient(local.apiUrl, local.secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** The local API address, to recognise API responses in the browser. */
export const API_URL = local.apiUrl

/** The repository's actions.json, as the app should show it. */
export const ACTIONS = JSON.parse(readFileSync(join(REPO_ROOT, 'actions.json'), 'utf8'))

/** The repository's privacy_text.txt, as the app should show it. */
export const PRIVACY = parsePrivacyText(readFileSync(join(REPO_ROOT, 'privacy_text.txt'), 'utf8'))

let counter = 0

/**
 * A new fake student with unique email and nickname, and a random throwaway password.
 * @param {object} [changes]
 * @returns {{ email: string, password: string, nickname: string, firstName: string, lastName: string,
 *   birthDate: string, university: string }}
 */
export function newStudent(changes = {}) {
  counter += 1
  const id = `${Date.now().toString(36).slice(-6)}${Math.random().toString(36).slice(2, 7)}${counter}`
  return {
    email: `e2e.${id}@greenie.test`,
    password: `pw-${id}-${Math.random().toString(36).slice(2, 8)}`,
    nickname: `e2e_${id}`.slice(0, 20),
    firstName: 'Testfirst',
    lastName: 'Testlast',
    birthDate: '15.03.2001',
    university: 'ETH Zurich',
    ...changes,
  }
}

/**
 * Creates a student directly through the local admin API (faster than the form).
 * @param {ReturnType<typeof newStudent>} student
 * @returns {Promise<string>} The new user id.
 */
export async function createStudent(student) {
  const [day, month, year] = student.birthDate.split('.')
  const { data, error } = await admin.auth.admin.createUser({
    email: student.email,
    password: student.password,
    email_confirm: true,
    user_metadata: {
      nickname: student.nickname,
      first_name: student.firstName,
      last_name: student.lastName,
      date_of_birth: `${year}-${month}-${day}`,
      university: student.university,
    },
  })
  if (error) throw new Error(`createStudent: ${error.message}`)
  return data.user.id
}

/**
 * Inserts a past log directly (tests that need history).
 * @param {string} userId
 * @param {string} actionKey
 * @param {string} loggedAtIso - UTC timestamp.
 * @returns {Promise<void>}
 */
export async function insertLog(userId, actionKey, loggedAtIso) {
  const action = ACTIONS.find((entry) => entry.key === actionKey)
  const { error } = await admin.from('action_logs').insert({
    user_id: userId, action_key: actionKey, points: action.points, co2_g: action.co2_g, logged_at_utc: loggedAtIso,
  })
  if (error) throw new Error(`insertLog: ${error.message}`)
}

/**
 * Fills the registration form (does not tick the box or submit).
 * @param {import('@playwright/test').Page} page
 * @param {ReturnType<typeof newStudent>} student
 * @returns {Promise<void>}
 */
export async function fillRegistration(page, student) {
  await page.getByLabel('Email', { exact: true }).fill(student.email)
  await page.getByLabel('Password', { exact: true }).fill(student.password)
  await page.getByLabel('Nickname', { exact: true }).fill(student.nickname)
  await page.getByLabel('First name', { exact: true }).fill(student.firstName)
  await page.getByLabel('Last name', { exact: true }).fill(student.lastName)
  await page.getByLabel('Date of birth', { exact: true }).fill(student.birthDate)
  await page.getByLabel('University', { exact: true }).fill(student.university)
}

/**
 * Logs in through the login screen and waits for Home.
 * @param {import('@playwright/test').Page} page
 * @param {{ email: string, password: string, nickname: string }} student
 * @returns {Promise<void>}
 */
export async function logInThroughUi(page, student) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill(student.email)
  await page.getByLabel('Password', { exact: true }).fill(student.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `Hi, ${student.nickname}` })).toBeVisible()
}

/**
 * Reads the three Home values.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ total: string, streak: string, today: string }>}
 */
export async function homeValues(page) {
  await expect(page.getByTestId('total-points')).toBeVisible()
  return {
    total: (await page.getByTestId('total-points').innerText()).trim(),
    streak: (await page.getByTestId('streak').innerText()).trim(),
    today: (await page.getByTestId('today-points').innerText()).trim(),
  }
}
