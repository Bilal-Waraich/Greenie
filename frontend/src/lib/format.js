/**
 * Display formatting: numbers, CO2 estimates, streak labels and Zürich dates and times.
 * All dates use the Europe/Zurich calendar (brief section 9 "Time"), never the browser's time zone.
 */

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const kilogramFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const zurichDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
const zurichTimeFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const zurichDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short', day: 'numeric', month: 'short' })

/**
 * Formats a whole number with thousands separators, as in Figma ("1,240").
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return numberFormat.format(value)
}

/**
 * Formats a CO2 estimate (US-14 AC2, AC6): always with "≈"; grams below 1000, otherwise kilograms with
 * at most one decimal ("≈ 40 g CO₂", "≈ 1.5 kg CO₂", "≈ 1 kg CO₂").
 * @param {number} grams - Whole grams, 0 or more.
 * @returns {string}
 */
export function formatCo2(grams) {
  if (grams < 1000) return `≈ ${grams} g CO₂`
  // Round to tenths of a kilogram in whole numbers first, so 1050 g is 1.1 kg (no floating-point surprises).
  return `≈ ${kilogramFormat.format(Math.round(grams / 100) / 10)} kg CO₂`
}

/**
 * A CO2 total or the CO2 of one log, as on Home and the success screen (US-14 AC3, AC4; Figma S2, S4):
 * "≈ 4.2 kg CO₂ saved", "≈ 0 g CO₂ saved".
 * @param {number} grams
 * @returns {string}
 */
export function formatCo2Saved(grams) {
  return `${formatCo2(grams)} saved`
}

/**
 * The second line of an action on the Log screen, as in Figma S3:
 * "Limit 5 per day · ≈ 40 g CO₂", plus " · 1 logged today" once the action was logged today.
 * @param {{ daily_limit: number, co2_g: number, used_today: number }} action
 * @returns {string}
 */
export function actionDetails(action) {
  const parts = [`Limit ${action.daily_limit} per day`, formatCo2(action.co2_g)]
  if (action.used_today > 0) parts.push(`${action.used_today} logged today`)
  return parts.join(' · ')
}

/**
 * Home streak label, as in Figma S2 ("7-day streak", "0-day streak").
 * @param {number} days
 * @returns {string}
 */
export function streakLabel(days) {
  return `${days}-day streak`
}

/**
 * A number of days, as on the profile in Figma S9 ("12 days"; "1 day").
 * @param {number} days
 * @returns {string}
 */
export function daysLabel(days) {
  return `${formatNumber(days)} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Success screen streak label, as in Figma S4 ("Streak: 8 days"; "Streak: 1 day").
 * @param {number} days
 * @returns {string}
 */
export function streakDaysLabel(days) {
  return `Streak: ${daysLabel(days)}`
}

/**
 * Today's date in Zürich as YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
export function zurichToday(now = new Date()) {
  return zurichDateFormat.format(now)
}

/**
 * When a log was made, in Zürich time, as in Figma S7 (US-05 AC1): "Today, 12:41",
 * "Yesterday, 18:03", otherwise "Mon 19 Oct, 17:45".
 * @param {string} loggedAtUtc - ISO timestamp from the database.
 * @param {Date} [now]
 * @returns {string}
 */
export function formatLogTime(loggedAtUtc, now = new Date()) {
  const when = new Date(loggedAtUtc)
  const time = zurichTimeFormat.format(when)
  const day = zurichDateFormat.format(when)
  const today = zurichToday(now)
  // Noon UTC is the same calendar day in Zürich, so stepping back 24 hours from there gives yesterday.
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  if (day === today) return `Today, ${time}`
  if (day === yesterday) return `Yesterday, ${time}`
  return `${zurichDayFormat.format(when).replace(',', '')}, ${time}`
}
