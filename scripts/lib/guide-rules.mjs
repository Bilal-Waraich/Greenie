/**
 * Validation rules for guide.json, the client's "Which bin in Zürich?" content (brief section 7.2,
 * US-07). The app shows the file as it is; these checks only make sure the page can show every entry.
 */
import { trimmedLength, validateList } from './list-rules.mjs'

/** Fields every entry must have, and no others. */
export const GUIDE_FIELDS = ['item', 'where', 'note']

/**
 * Validates the parsed content of guide.json: "item" and "where" are non-empty text, "note" is text
 * (it may be empty).
 * @param {unknown} entries - The value returned by JSON.parse on the file.
 * @returns {string[]} One message per problem, naming the entry. Empty when the file is valid.
 */
export function validateGuide(entries) {
  return validateList(entries, {
    file: 'guide.json',
    noun: 'entry',
    nouns: 'entries',
    fields: GUIDE_FIELDS,
    nameField: 'item',
    checkEntry(entry, label, errors) {
      if ('item' in entry && trimmedLength(entry.item) < 1) errors.push(`${label}: "item" must be text, not empty.`)
      if ('where' in entry && trimmedLength(entry.where) < 1) errors.push(`${label}: "where" must be text, not empty.`)
      if ('note' in entry && typeof entry.note !== 'string') errors.push(`${label}: "note" must be text.`)
    },
  })
}
