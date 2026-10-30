/**
 * Validation rules for badges.json, the client's list of badges (brief section 7.3, US-15).
 *
 * The same rules are enforced again inside the database by private.sync_badges
 * (supabase/migrations/*_badges.sql), so a file that passes here also loads there.
 * Keep the two in step when a rule changes.
 */
import { checkKey, isWholeNumberFrom, trimmedLength, validateList } from './list-rules.mjs'

/** Fields every entry must have, and no others. */
export const BADGE_FIELDS = ['key', 'label', 'rule', 'threshold']

/** logs: number of logged actions; points: total points; streak: longest streak ever (brief 7.3). */
export const BADGE_RULES = ['logs', 'points', 'streak']

/**
 * Validates the parsed content of badges.json.
 * @param {unknown} badges - The value returned by JSON.parse on the file.
 * @returns {string[]} One message per problem, naming the entry. Empty when the file is valid.
 */
export function validateBadges(badges) {
  const seenKeys = new Set()
  return validateList(badges, {
    file: 'badges.json',
    noun: 'badge',
    nouns: 'badges',
    fields: BADGE_FIELDS,
    nameField: 'key',
    checkEntry(entry, label, errors) {
      checkKey(entry, label, seenKeys, errors)
      if ('label' in entry) {
        const length = trimmedLength(entry.label)
        if (length < 1 || length > 100) errors.push(`${label}: "label" must be text of 1 to 100 characters.`)
      }
      if ('rule' in entry && !BADGE_RULES.includes(entry.rule)) {
        errors.push(`${label}: "rule" must be "logs", "points" or "streak".`)
      }
      if ('threshold' in entry && !isWholeNumberFrom(entry.threshold, 1)) {
        errors.push(`${label}: "threshold" must be a whole number of at least 1.`)
      }
    },
  })
}
