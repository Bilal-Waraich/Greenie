/**
 * Display formatting: numbers, CO2 estimates, streak labels and Zürich dates.
 * All dates use the Europe/Zurich calendar (brief section 9 "Time"), never the browser's time zone.
 */

const numberFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const kilogramFormat = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
const zurichDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })

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
 * Success screen streak label, as in Figma S4 ("Streak: 8 days"; "Streak: 1 day").
 * @param {number} days
 * @returns {string}
 */
export function streakDaysLabel(days) {
  return `Streak: ${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * Today's date in Zürich as YYYY-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
export function zurichToday(now = new Date()) {
  return zurichDateFormat.format(now)
}
