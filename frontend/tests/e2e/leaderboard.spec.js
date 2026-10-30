/**
 * Weekly leaderboard tests (US-06, US-12 AC4): the two tabs, ranking by points this week with
 * alphabetical ties and consecutive ranks, the own row highlighted and pinned below the list when
 * outside the top 20, a new log and a new follow showing after a refresh, the "not following anyone"
 * state with "Find students", and rows opening profiles.
 *
 * Other tests and demo data share the local database, so these tests check the rules on whatever the
 * list contains, and use the "Following" tab (which only holds the student and whom they follow) for
 * exact rankings. The empty "Everyone" list is checked in the database tests (leaderboard.test.sql).
 */
import { expect, test } from '@playwright/test'
import {
  createStudent,
  createStudentsWithPoints,
  deleteStudentsByPrefix,
  follow,
  insertLog,
  logInThroughUi,
  newStudent,
} from './helpers.js'

/**
 * The rows of the visible leaderboard, as plain values.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{ rank: number, nickname: string, points: number, me: boolean, pinned: boolean }>>}
 */
async function boardRows(page) {
  await expect(page.getByTestId('board-row').first()).toBeVisible()
  return page.getByTestId('board-row').evaluateAll((rows) =>
    rows.map((row) => ({
      rank: Number(row.dataset.rank),
      nickname: row.querySelector('.board-row__name').firstChild.textContent,
      points: Number(row.querySelector('.board-row__points').textContent.replace(/\D/g, '')),
      me: row.dataset.me === 'true',
      pinned: Boolean(row.closest('.board--pinned')),
    })),
  )
}

/**
 * Checks the ranking rules on a list: ranks 1, 2, 3 … in order, points from highest to lowest, equal
 * points in alphabetical order of nickname (ignoring case).
 * @param {Array<{ rank: number, nickname: string, points: number }>} rows
 * @returns {void}
 */
function expectRanked(rows) {
  rows.forEach((row, index) => {
    expect(row.rank, `rank of ${row.nickname}`).toBe(index + 1)
    if (index === 0) return
    const before = rows[index - 1]
    expect(before.points, `${before.nickname} before ${row.nickname}`).toBeGreaterThanOrEqual(row.points)
    if (before.points === row.points) {
      expect(before.nickname.toLowerCase() < row.nickname.toLowerCase(), `${before.nickname} before ${row.nickname}`).toBe(true)
    }
  })
}

test('Everyone: the top 20 this week, ranked, and my row pinned below when outside it (US-06 AC1 to AC5)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'creates many students; runs once, in Chromium')
  const prefix = `lb${Math.random().toString(36).slice(2, 8)}`
  createStudentsWithPoints(Array.from({ length: 21 }, (_, index) => `${prefix}_${String(index).padStart(2, '0')}`), 5000)
  try {
    const me = newStudent()
    const myId = await createStudent(me)
    await insertLog(myId, 'reusable_bag', new Date().toISOString())
    await logInThroughUi(page, me)

    await page.getByRole('link', { name: 'Leaderboard' }).first().click()
    await expect(page.getByRole('tab', { name: 'Everyone' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Following' })).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByText('This week · resets Monday 00:00')).toBeVisible()

    const rows = await boardRows(page)
    const listed = rows.filter((row) => !row.pinned)
    expect(listed).toHaveLength(20)
    expectRanked(listed)
    expect(listed.slice(0, 20).every((row) => row.points >= 5000)).toBe(true)

    const pinned = rows.filter((row) => row.pinned)
    expect(pinned).toEqual([expect.objectContaining({ nickname: me.nickname, points: 5, me: true })])
    expect(pinned[0].rank).toBeGreaterThan(21)
    await expect(page.locator('.board-gap')).toBeVisible()
    await expect(page.locator('.board--pinned .board-row')).toHaveClass(/board-row--me/)
  } finally {
    deleteStudentsByPrefix(prefix)
  }
})

test('Following: me and everyone I follow, with ties alphabetical, a new log and a new follow after a refresh (US-06 AC3, AC5, AC6; US-12 AC4)', async ({ page }) => {
  const me = newStudent()
  const myId = await createStudent(me)
  const suffix = Math.random().toString(36).slice(2, 8)
  const anna = newStudent({ nickname: `Anna_${suffix}` })
  const bert = newStudent({ nickname: `bert_${suffix}` })
  const cleo = newStudent({ nickname: `cleo_${suffix}` })
  const annaId = await createStudent(anna)
  const bertId = await createStudent(bert)
  const cleoId = await createStudent(cleo)
  const today = new Date().toISOString()
  await insertLog(annaId, 'recycle_can', today) // 10 points
  await insertLog(bertId, 'recycle_bottle', today) // 10 points
  await follow(myId, annaId)
  await follow(myId, bertId)

  await logInThroughUi(page, me)
  await page.goto('/leaderboard?tab=following')
  await expect(page.getByText('This week · you and the people you follow')).toBeVisible()
  expect((await boardRows(page)).map(({ rank, nickname, points, me: isMe }) => ({ rank, nickname, points, isMe }))).toEqual([
    { rank: 1, nickname: anna.nickname, points: 10, isMe: false },
    { rank: 2, nickname: bert.nickname, points: 10, isMe: false },
    { rank: 3, nickname: me.nickname, points: 0, isMe: true },
  ])
  await expect(page.locator('[data-me="true"]')).toHaveClass(/board-row--me/)

  // A new log shows after a refresh (AC6).
  await page.goto('/log')
  await page.locator('[data-action-key="second_hand"]').click()
  await expect(page.getByRole('heading', { level: 1, name: '+20 points' })).toBeVisible()
  await page.goto('/leaderboard?tab=following')
  expect((await boardRows(page))[0]).toEqual(expect.objectContaining({ rank: 1, nickname: me.nickname, points: 20 }))

  // A new follow shows after a refresh (US-12 AC4), with 0 points.
  await follow(myId, cleoId)
  await page.reload()
  await expect(page.getByTestId('board-row')).toHaveCount(4)
  expect((await boardRows(page)).at(-1)).toEqual(expect.objectContaining({ rank: 4, nickname: cleo.nickname, points: 0 }))
})

test('Following nobody: "You are not following anyone yet" and "Find students" (US-06 AC7)', async ({ page }) => {
  const me = newStudent()
  await createStudent(me)
  await logInThroughUi(page, me)
  await page.goto('/leaderboard')
  await page.getByRole('tab', { name: 'Following' }).click()
  await expect(page).toHaveURL(/tab=following/)
  await expect(page.getByText('You are not following anyone yet')).toBeVisible()
  await page.getByRole('link', { name: 'Find students' }).click()
  await expect(page).toHaveURL(/\/students$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Find students' })).toBeVisible()
})

test('tapping a row opens that student\'s profile (US-06 AC8)', async ({ page }) => {
  const me = newStudent()
  const myId = await createStudent(me)
  const friend = newStudent()
  const friendId = await createStudent(friend)
  await follow(myId, friendId)
  await logInThroughUi(page, me)
  await page.goto('/leaderboard?tab=following')
  await page.getByTestId('board-row').filter({ hasText: friend.nickname }).click()
  await expect(page).toHaveURL(new RegExp(`/students/${friendId}$`))
  await expect(page.getByRole('heading', { level: 1, name: friend.nickname })).toBeVisible()
})
