/**
 * Shared helpers for the end-to-end tests: fake students, direct data set-up through the LOCAL admin
 * API (refused for any non-local address), and common UI steps.
 */
import { createClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertLocalUrl, readLocalStatus, REPO_ROOT } from '../../scripts/local-supabase.mjs'
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

/** The repository's guide.json, as the Guide page should show it. */
export const GUIDE = JSON.parse(readFileSync(join(REPO_ROOT, 'guide.json'), 'utf8'))

/** The repository's badges.json. */
export const BADGES = JSON.parse(readFileSync(join(REPO_ROOT, 'badges.json'), 'utf8'))

/**
 * Runs SQL against the LOCAL database (for fast test data, such as many students at once).
 * @param {string} sql
 * @returns {string} psql's output, one row per line, columns separated by "|".
 */
export function runSql(sql) {
  return execFileSync('psql', [assertLocalUrl(local.dbUrl), '-v', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc', '-At'], {
    input: sql,
    encoding: 'utf8',
  })
}

/**
 * Creates students directly in the local database (the sign-up trigger creates their profiles), each
 * with one log worth the given points today. They can't log in (no password).
 * @param {string[]} nicknames
 * @param {number} pointsToday
 * @returns {void}
 */
export function createStudentsWithPoints(nicknames, pointsToday) {
  const values = nicknames.map((nickname) => `('${nickname}')`).join(', ')
  runSql(`
    with new_students as (
      insert into auth.users (id, email, raw_user_meta_data)
      select gen_random_uuid(), lower(n.nickname) || '@greenie.test',
        jsonb_build_object('nickname', n.nickname, 'first_name', 'Bulk', 'last_name', 'Student',
                           'date_of_birth', '2000-01-01', 'university', 'Test University')
      from (values ${values}) as n(nickname)
      returning id
    )
    insert into public.action_logs (user_id, action_key, points, co2_g)
    select id, 'recycle_can', ${Number(pointsToday)}, 100 from new_students;
  `)
}

/**
 * Deletes local students whose nickname starts with a prefix (with their logs and follows).
 * @param {string} prefix - Letters, digits and underscores only.
 * @returns {void}
 */
export function deleteStudentsByPrefix(prefix) {
  if (!/^[A-Za-z0-9_]+$/.test(prefix)) throw new Error('deleteStudentsByPrefix: unsafe prefix')
  runSql(`delete from auth.users where id in (select id from public.users where nickname like '${prefix}%');`)
}

/**
 * Makes one student follow another, directly in the local database.
 * @param {string} followerId
 * @param {string} followedId
 * @returns {Promise<void>}
 */
export async function follow(followerId, followedId) {
  const { error } = await admin.from('follows').insert({ follower_id: followerId, followed_id: followedId })
  if (error) throw new Error(`follow: ${error.message}`)
}

/**
 * Waits for the newest email to an address in the local mail viewer (Mailpit) and returns the first
 * link in it that points at the local Supabase Auth server.
 * @param {string} email
 * @param {number} [sentAfter] - Only emails received after this time (ms since 1970).
 * @returns {Promise<string>} The link, with HTML entities decoded.
 */
export async function emailedLink(email, sentAfter = 0) {
  const mailUrl = assertLocalUrl(local.mailUrl)
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const search = await fetch(`${mailUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((response) => response.json())
    const message = (search.messages ?? []).find((entry) => Date.parse(entry.Created) >= sentAfter - 1000)
    if (message) {
      const full = await fetch(`${mailUrl}/api/v1/message/${message.ID}`).then((response) => response.json())
      const href = full.HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)
      if (href) return href[1].replaceAll('&amp;', '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No email with a link arrived for ${email}`)
}

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
