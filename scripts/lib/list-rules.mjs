/**
 * Shared checks for the client's JSON list files (actions.json, badges.json, guide.json): each file is
 * a non-empty list of objects with exactly the expected fields. Each file's own rules
 * (actions-rules.mjs, badges-rules.mjs, guide-rules.mjs) then check the values of the fields.
 */

/** Largest value a Postgres integer column can hold. */
const MAX_INT = 2147483647

/** Whitespace removed at both ends of text, matching the database's trimming exactly. */
const EDGE_WHITESPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g

/** Keys of actions and badges: 1 to 50 lowercase letters, digits or underscores. */
const KEY_PATTERN = /^[a-z0-9_]{1,50}$/

/**
 * Removes spaces, tabs and line breaks at both ends of a string.
 * @param {string} text
 * @returns {string}
 */
export function trimEdges(text) {
  return text.replace(EDGE_WHITESPACE, '')
}

/**
 * The length of a text after trimming, counted in characters as Postgres does.
 * @param {unknown} value
 * @returns {number} The length, or -1 if the value isn't text.
 */
export function trimmedLength(value) {
  return typeof value === 'string' ? [...trimEdges(value)].length : -1
}

/**
 * Checks that a value is a whole number from min up to the largest database integer.
 * @param {unknown} value
 * @param {number} min
 * @returns {boolean}
 */
export function isWholeNumberFrom(value, min) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= MAX_INT
}

/**
 * Checks an entry's "key": the pattern, and that no earlier entry used it.
 * @param {object} entry
 * @param {string} label - How errors name the entry.
 * @param {Set<string>} seenKeys - Keys of the earlier entries; the key is added to it.
 * @param {string[]} errors - Problems found so far; new ones are added.
 * @returns {void}
 */
export function checkKey(entry, label, seenKeys, errors) {
  if (!('key' in entry)) return
  if (typeof entry.key !== 'string' || !KEY_PATTERN.test(entry.key)) {
    errors.push(`${label}: "key" must be 1 to 50 characters: lowercase letters, digits or underscore.`)
  } else if (seenKeys.has(entry.key)) {
    errors.push(`${label}: the key "${entry.key}" is used more than once.`)
  } else {
    seenKeys.add(entry.key)
  }
}

/**
 * Checks a parsed list file: a non-empty array of objects with exactly the given fields, then each
 * entry's values with checkEntry.
 * @param {unknown} list - The value returned by JSON.parse on the file.
 * @param {{ file: string, noun: string, nouns: string, fields: string[], nameField: string,
 *   checkEntry: (entry: object, label: string, errors: string[]) => void }} options
 *   - file: file name for messages; noun and nouns: what one entry is, and the plural ("action",
 *   "actions"); nameField: the field shown in messages to identify an entry ("key"); checkEntry: adds
 *   problems with the entry's values.
 * @returns {string[]} One message per problem, naming the entry. Empty when the file is valid.
 */
export function validateList(list, { file, noun, nouns, fields, nameField, checkEntry }) {
  if (!Array.isArray(list)) {
    return [`${file} must be a list (a JSON array) of ${nouns}.`]
  }
  if (list.length === 0) {
    return [`${file} must contain at least one ${noun}.`]
  }

  const errors = []
  list.forEach((entry, index) => {
    const name = `${file} entry ${index + 1}`
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${name} must be an object with the fields ${fields.join(', ')}.`)
      return
    }
    const label = typeof entry[nameField] === 'string' ? `${name} ("${entry[nameField]}")` : name

    for (const field of fields) {
      if (!(field in entry)) errors.push(`${label} is missing the field "${field}".`)
    }
    for (const field of Object.keys(entry)) {
      if (!fields.includes(field)) errors.push(`${label} has an unknown field "${field}".`)
    }
    checkEntry(entry, label, errors)
  })
  return errors
}
