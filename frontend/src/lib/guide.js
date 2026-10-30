/**
 * The "Which bin in Zürich?" text filter (US-07 AC2). The entries themselves come from Bean Co.'s
 * guide.json (lib/guideEntries.js); this module has no imports, so the unit tests can run it in Node.
 */

/**
 * Text prepared for matching: lower case, without accents, so "zuri" finds "Züri-Sack".
 * @param {string} text
 * @returns {string}
 */
export function foldText(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/**
 * The entries whose item, place or note contains every word of the filter text, in file order.
 * An empty filter returns every entry.
 * @param {Array<{ item: string, where: string, note: string }>} entries
 * @param {string} filterText - What the student typed.
 * @returns {Array<{ item: string, where: string, note: string }>}
 */
export function filterGuide(entries, filterText) {
  const words = foldText(filterText).split(/\s+/).filter(Boolean)
  if (words.length === 0) return entries
  return entries.filter((entry) => {
    const text = foldText(`${entry.item} ${entry.where} ${entry.note}`)
    return words.every((word) => text.includes(word))
  })
}

/**
 * The second line of a guide entry, as in Figma S6: "where · note" (just "where" without a note).
 * @param {{ where: string, note: string }} entry
 * @returns {string}
 */
export function guideDetails(entry) {
  return entry.note.trim() ? `${entry.where} · ${entry.note}` : entry.where
}
