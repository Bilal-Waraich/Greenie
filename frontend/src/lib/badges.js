/**
 * Badge texts (US-15): how a badge's rule is described, as in the brief's table 7.3 and Figma S11
 * ("Log your first action", "Reach 1,000 total points", "Log 7 days in a row"), and the "N of M earned"
 * line. Which badges exist and which are earned comes from the database (badges.json).
 */
import { formatNumber } from './format.js'

/**
 * The rule of a badge in words.
 * @param {{ rule: 'logs' | 'points' | 'streak', threshold: number }} badge
 * @returns {string}
 */
export function badgeRuleText({ rule, threshold }) {
  if (rule === 'logs') return threshold === 1 ? 'Log your first action' : `Log ${formatNumber(threshold)} actions`
  if (rule === 'points') return `Reach ${formatNumber(threshold)} total points`
  return `Log ${formatNumber(threshold)} days in a row`
}

/**
 * "3 of 6 earned" (Figma S2 and S11; US-15 AC3).
 * @param {Array<{ earned: boolean }>} badges
 * @returns {string}
 */
export function earnedSummary(badges) {
  return `${badges.filter((badge) => badge.earned).length} of ${badges.length} earned`
}
