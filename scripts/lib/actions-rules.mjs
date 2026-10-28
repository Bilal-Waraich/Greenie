/**
 * Validation rules for actions.json, the client's list of eco-actions (brief section 7.1, US-08, US-14).
 *
 * The same rules are enforced again inside the database by private.sync_actions
 * (supabase/migrations/*_actions_sync.sql), so a file that passes here also loads there.
 * Keep the two in step when a rule changes.
 */

/** Fields every entry must have, and no others. */
export const ACTION_FIELDS = ['key', 'label', 'points', 'daily_limit', 'co2_g']

/** Largest value a Postgres integer column can hold. */
const MAX_INT = 2147483647

/** Whitespace removed at both ends of text, matching the database's trimming exactly. */
const EDGE_WHITESPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g

/**
 * Removes spaces, tabs and line breaks at both ends of a string.
 * @param {string} text
 * @returns {string}
 */
export function trimEdges(text) {
  return text.replace(EDGE_WHITESPACE, '')
}

/**
 * Checks that a value is a whole number within a range.
 * @param {unknown} value
 * @param {number} min
 * @returns {boolean}
 */
function isWholeNumberFrom(value, min) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= MAX_INT
}

/**
 * Validates the parsed content of actions.json.
 * @param {unknown} actions - The value returned by JSON.parse on the file.
 * @returns {string[]} One message per problem, naming the entry. Empty when the file is valid.
 */
export function validateActions(actions) {
  if (!Array.isArray(actions)) {
    return ['actions.json must be a list (a JSON array) of actions.']
  }
  if (actions.length === 0) {
    return ['actions.json must contain at least one action.']
  }

  const errors = []
  const seenKeys = new Set()

  actions.forEach((entry, index) => {
    const name = `actions.json entry ${index + 1}`
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${name} must be an object with the fields ${ACTION_FIELDS.join(', ')}.`)
      return
    }
    const label = typeof entry.key === 'string' ? `${name} ("${entry.key}")` : name

    for (const field of ACTION_FIELDS) {
      if (!(field in entry)) errors.push(`${label} is missing the field "${field}".`)
    }
    for (const field of Object.keys(entry)) {
      if (!ACTION_FIELDS.includes(field)) errors.push(`${label} has an unknown field "${field}".`)
    }

    if ('key' in entry) {
      if (typeof entry.key !== 'string' || !/^[a-z0-9_]{1,50}$/.test(entry.key)) {
        errors.push(`${label}: "key" must be 1 to 50 characters: lowercase letters, digits or underscore.`)
      } else if (seenKeys.has(entry.key)) {
        errors.push(`${label}: the key "${entry.key}" is used more than once.`)
      } else {
        seenKeys.add(entry.key)
      }
    }
    if ('label' in entry) {
      const length = typeof entry.label === 'string' ? [...trimEdges(entry.label)].length : 0
      if (typeof entry.label !== 'string' || length < 1 || length > 200) {
        errors.push(`${label}: "label" must be text of 1 to 200 characters.`)
      }
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
  })

  return errors
}
