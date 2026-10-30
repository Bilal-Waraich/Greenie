/**
 * Validation rules for actions.json, the client's list of eco-actions (brief section 7.1, US-08, US-14).
 *
 * The same rules are enforced again inside the database by private.sync_actions
 * (supabase/migrations/*_actions_sync.sql), so a file that passes here also loads there.
 * Keep the two in step when a rule changes.
 */
import { checkKey, isWholeNumberFrom, trimmedLength, validateList } from './list-rules.mjs'

export { trimEdges } from './list-rules.mjs'

/** Fields every entry must have, and no others. */
export const ACTION_FIELDS = ['key', 'label', 'points', 'daily_limit', 'co2_g']

/**
 * Validates the parsed content of actions.json.
 * @param {unknown} actions - The value returned by JSON.parse on the file.
 * @returns {string[]} One message per problem, naming the entry. Empty when the file is valid.
 */
export function validateActions(actions) {
  const seenKeys = new Set()
  return validateList(actions, {
    file: 'actions.json',
    noun: 'action',
    nouns: 'actions',
    fields: ACTION_FIELDS,
    nameField: 'key',
    checkEntry(entry, label, errors) {
      checkKey(entry, label, seenKeys, errors)
      if ('label' in entry) {
        const length = trimmedLength(entry.label)
        if (length < 1 || length > 200) errors.push(`${label}: "label" must be text of 1 to 200 characters.`)
      }
      if ('points' in entry && !isWholeNumberFrom(entry.points, 1)) {
        errors.push(`${label}: "points" must be a whole number of at least 1.`)
      }
      if ('daily_limit' in entry && !isWholeNumberFrom(entry.daily_limit, 1)) {
        errors.push(`${label}: "daily_limit" must be a whole number of at least 1.`)
      }
      if ('co2_g' in entry && !isWholeNumberFrom(entry.co2_g, 0)) {
        errors.push(`${label}: "co2_g" must be a whole number of grams, 0 or more.`)
      }
    },
  })
}
