/**
 * `npm run seed:local`: fills the LOCAL database with demo students, logs and follows.
 *
 * Creates 25 fake students (demo01@greenie.test to demo25@greenie.test) through the local Auth admin
 * API, so the normal sign-up trigger creates their profiles, then adds action logs spread over the last
 * three weeks (within each action's daily limit) and some follows. The random choices use a fixed
 * seed, so every run produces the same pattern relative to today.
 *
 * Existing demo accounts are deleted first. Every account gets the same random password, printed at
 * the end, so you can log in as any of them locally. Refuses to run against anything but 127.0.0.1 or
 * localhost. Needs the local stack and loaded actions (`npm run db:reset`).
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readLocalStatus } from './local-supabase.mjs'

const STUDENT_COUNT = 25
const DAYS_BACK = 20
const EMAIL_DOMAIN = 'greenie.test'
const NICKNAMES = [
  'zuri_leaf', 'greenmia', 'bike_nora', 'eco_alex', 'planty_p', 'loop_lena', 'recycleron', 'carbonless',
  'eco_mia', 'ecoleo', 'neco_p', 'tram_tim', 'reuse_rita', 'compost_kai', 'solar_sam', 'veggie_vic',
  'paperless_pia', 'thrift_theo', 'green_gus', 'cup_carla', 'bag_ben', 'limmat_lou', 'uetli_ula',
  'glass_gio', 'sorted_sven',
]
const UNIVERSITIES = ['ETH Zurich', 'University of Zurich', 'ZHAW', 'ZHdK', 'PHZH']

/**
 * Small deterministic random number generator (mulberry32).
 * @param {number} seed
 * @returns {() => number} A function returning numbers in [0, 1).
 */
function makeRandom(seed) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The UTC instant for a Zürich date (days before today) and a local hour and minute.
 * @param {number} daysAgo
 * @param {number} hour - Local Zürich hour.
 * @param {number} minute
 * @returns {string} ISO timestamp.
 */
function zurichInstant(daysAgo, hour, minute) {
  const todayZurich = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date())
  const day = new Date(`${todayZurich}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - daysAgo)
  const datePart = day.toISOString().slice(0, 10)
  // Find the UTC offset Zürich has on that date at that hour (CET +1 or CEST +2).
  for (const offset of [1, 2]) {
    const candidate = new Date(`${datePart}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`)
    candidate.setUTCHours(candidate.getUTCHours() - offset)
    const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' }).format(candidate))
    if (localHour === hour) return candidate.toISOString()
  }
  throw new Error(`Could not place ${datePart} ${hour}:${minute} in Zürich time.`)
}

/**
 * Throws if a Supabase call returned an error.
 * @param {{ error: unknown }} result
 * @param {string} what - Description for the message.
 * @returns {any} The result's data.
 */
function check(result, what) {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data
}

/**
 * Deletes old demo accounts, then creates students, logs and follows.
 * @returns {Promise<void>}
 */
async function main() {
  const { apiUrl, secretKey } = readLocalStatus()
  const admin = createClient(apiUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const random = makeRandom(20261031)
  const password = randomBytes(9).toString('base64url')

  const actions = check(await admin.from('actions').select('key, points, daily_limit, co2_g').eq('active', true).order('position'), 'Reading actions')
  if (actions.length === 0) throw new Error('No actions found. Run `npm run db:reset` first.')

  const existing = check(await admin.auth.admin.listUsers({ perPage: 1000 }), 'Listing accounts').users
  for (const user of existing.filter((u) => /^demo\d+@/.test(u.email ?? '') && u.email.endsWith(`@${EMAIL_DOMAIN}`))) {
    check(await admin.auth.admin.deleteUser(user.id), `Deleting ${user.email}`)
  }

  const students = []
  for (let index = 0; index < STUDENT_COUNT; index += 1) {
    const number = String(index + 1).padStart(2, '0')
    const created = check(await admin.auth.admin.createUser({
      email: `demo${number}@${EMAIL_DOMAIN}`,
      password,
      email_confirm: true,
      user_metadata: {
        nickname: NICKNAMES[index],
        first_name: 'Demo',
        last_name: `Student ${number}`,
        date_of_birth: `${1995 + (index % 9)}-0${1 + (index % 9)}-1${index % 9}`,
        university: UNIVERSITIES[index % UNIVERSITIES.length],
      },
    }), `Creating demo${number}`)
    students.push({ id: created.user.id, nickname: NICKNAMES[index], activity: 0.15 + random() * 0.75 })
  }

  const logs = []
  for (const student of students) {
    for (let daysAgo = DAYS_BACK; daysAgo >= 0; daysAgo -= 1) {
      if (random() > student.activity) continue
      for (const action of actions) {
        if (random() > 0.3) continue
        const times = 1 + Math.floor(random() * action.daily_limit)
        for (let n = 0; n < times; n += 1) {
          const loggedAt = zurichInstant(daysAgo, 7 + Math.floor(random() * 15), Math.floor(random() * 60))
          if (new Date(loggedAt) > new Date()) continue
          logs.push({ user_id: student.id, action_key: action.key, points: action.points, co2_g: action.co2_g, logged_at_utc: loggedAt })
        }
      }
    }
  }
  for (let start = 0; start < logs.length; start += 500) {
    check(await admin.from('action_logs').insert(logs.slice(start, start + 500)), 'Inserting logs')
  }

  const follows = []
  for (const [index, student] of students.entries()) {
    for (let step = 1; step <= 3; step += 1) {
      if (random() < 0.5) follows.push({ follower_id: student.id, followed_id: students[(index + step * 4) % students.length].id })
    }
  }
  check(await admin.from('follows').insert(follows), 'Inserting follows')

  console.log(`Seeded ${students.length} demo students, ${logs.length} logs and ${follows.length} follows.`)
  console.log(`Log in locally as demo01@${EMAIL_DOMAIN} (${students[0].nickname}) to demo${STUDENT_COUNT}@${EMAIL_DOMAIN}.`)
  console.log(`Password for every demo account (local only, new on each run): ${password}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
