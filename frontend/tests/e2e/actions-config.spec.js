/**
 * Editing actions.json changes the app without code changes (US-08 AC1).
 *
 * Loads an edited copy of actions.json into the LOCAL database with the same script the deploy uses
 * (scripts/actions-to-sql.mjs), reloads the Log screen and checks the change; then loads the real file
 * again. Runs on its own after the other tests, because it changes the shared action list.
 */
import { expect, test } from '@playwright/test'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLocalStatus, REPO_ROOT } from '../../scripts/local-supabase.mjs'
import { ACTIONS, createStudent, logInThroughUi, newStudent } from './helpers.js'

const { dbUrl } = readLocalStatus()

test.describe.configure({ mode: 'serial' })

/**
 * Loads an actions file into the local database, as the deploy and `npm run db:reset` do.
 * @param {string} filePath
 * @returns {void}
 */
function loadActions(filePath) {
  const sql = execFileSync('node', [join(REPO_ROOT, 'scripts', 'actions-to-sql.mjs'), filePath], { encoding: 'utf8' })
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc'], { input: sql })
}

test.afterAll(() => {
  loadActions(join(REPO_ROOT, 'actions.json'))
})

test('a changed label, points and limit, and a removed action, show after reloading (US-08 AC1)', async ({ page }) => {
  const student = newStudent()
  await createStudent(student)
  await logInThroughUi(page, student)

  const edited = ACTIONS.slice(0, -1).map((action, index) =>
    index === 0 ? { ...action, label: 'Recycled a glass bottle', points: 12, daily_limit: 4 } : action,
  )
  const folder = mkdtempSync(join(tmpdir(), 'greenie-actions-'))
  const editedFile = join(folder, 'actions.json')
  writeFileSync(editedFile, JSON.stringify(edited, null, 2))
  loadActions(editedFile)

  await page.goto('/log')
  const first = page.locator('.action').first()
  await expect(first.locator('.action__label')).toHaveText('Recycled a glass bottle')
  await expect(first.locator('.action__points')).toHaveText('+12')
  await expect(first.locator('.action__details')).toContainText('Limit 4 per day')
  await expect(page.locator('.action')).toHaveCount(ACTIONS.length - 1)
  await expect(page.locator(`[data-action-key="${ACTIONS.at(-1).key}"]`)).toHaveCount(0)

  await first.click()
  await expect(page.getByRole('heading', { level: 1, name: '+12 points' })).toBeVisible()
})

test('an invalid actions.json is refused before anything is loaded', () => {
  const folder = mkdtempSync(join(tmpdir(), 'greenie-actions-'))
  const badFile = join(folder, 'actions.json')
  writeFileSync(badFile, JSON.stringify([{ ...ACTIONS[0], points: 0 }]))
  const check = spawnSync('node', [join(REPO_ROOT, 'scripts', 'check-config.mjs'), badFile], { encoding: 'utf8' })
  expect(check.status).toBe(1)
  expect(check.stderr).toContain('"points" must be a whole number of at least 1')
  const toSql = spawnSync('node', [join(REPO_ROOT, 'scripts', 'actions-to-sql.mjs'), badFile], { encoding: 'utf8' })
  expect(toSql.status).toBe(1)
  expect(toSql.stdout).toBe('')
})
