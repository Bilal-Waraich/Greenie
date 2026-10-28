/**
 * Reads Bean Co.'s privacy text (privacy_text.txt at the repository root) into the parts the app
 * shows, without changing a word:
 * - Part A: the short text and the checkbox label on the registration screen (US-01 AC5);
 * - Part B: the full privacy notice on the Privacy page.
 *
 * The file is plain text wrapped at about 70 characters. Lines of "=" frame the part headings, a blank
 * line separates paragraphs, "1. Title" starts a section, "- " starts a list item and indented lines
 * continue it. Wrapped lines are joined with one space.
 *
 * Used by the front end (lib/privacy.js) and by scripts/check-config.mjs, which stops a deploy if the
 * file no longer has this structure. Plain JavaScript with no imports, so Node can run it too.
 */

/** The words in the checkbox label that link to the Privacy page. */
export const NOTICE_LINK_WORDS = 'privacy notice'

/**
 * @typedef {{ type: 'title' | 'heading' | 'paragraph', text: string } | { type: 'list', items: string[] }} NoticeBlock
 * @typedef {{ shortText: string[], checkboxLabel: string, notice: NoticeBlock[] }} PrivacyText
 */

/** ASCII whitespace at either end of a line: the same set the rest of the app trims. */
const EDGE_SPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g

/**
 * A line without the whitespace at its ends.
 * @param {string} line
 * @returns {string}
 */
function clean(line) {
  return line.replace(EDGE_SPACE, '')
}

/**
 * Groups lines into blocks separated by blank lines.
 * @param {string[]} lines
 * @returns {string[][]} Blocks of non-blank lines.
 */
function toBlocks(lines) {
  const blocks = []
  let current = []
  for (const line of lines) {
    if (clean(line) === '') {
      if (current.length > 0) blocks.push(current)
      current = []
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

/**
 * Joins wrapped lines into one line of text.
 * @param {string[]} lines
 * @returns {string}
 */
function joinLines(lines) {
  return lines.map(clean).join(' ')
}

/**
 * Turns the lines of a section into paragraphs and lists: "- " starts a list item, an indented line
 * continues the item before it, any other line belongs to a paragraph.
 * @param {string[]} lines
 * @returns {NoticeBlock[]}
 */
function bodyBlocks(lines) {
  const blocks = []
  let paragraph = null
  let list = null
  for (const line of lines) {
    if (/^-[ \t]/.test(line)) {
      paragraph = null
      if (!list) {
        list = { type: 'list', items: [] }
        blocks.push(list)
      }
      list.items.push(clean(line.slice(1)))
    } else if (list && /^[ \t]/.test(line)) {
      list.items[list.items.length - 1] += ` ${clean(line)}`
    } else {
      list = null
      if (paragraph) {
        paragraph.text += ` ${clean(line)}`
      } else {
        paragraph = { type: 'paragraph', text: clean(line) }
        blocks.push(paragraph)
      }
    }
  }
  return blocks
}

/**
 * Parses privacy_text.txt.
 * @param {string} raw - The file's content.
 * @returns {PrivacyText}
 * @throws {Error} If a part, the checkbox label or the words that link to the notice are missing.
 */
export function parsePrivacyText(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => !/^=+$/.test(clean(line)))
  const partA = lines.findIndex((line) => /^PART A\b/.test(clean(line)))
  const partB = lines.findIndex((line) => /^PART B\b/.test(clean(line)))
  if (partA === -1 || partB === -1 || partB < partA) {
    throw new Error('privacy_text.txt: needs a line starting "PART A" and, after it, a line starting "PART B".')
  }

  const partALines = lines.slice(partA + 1, partB)
  const labelLine = partALines.findIndex((line) => clean(line) === 'Checkbox label:')
  if (labelLine === -1) {
    throw new Error('privacy_text.txt: Part A needs a "Checkbox label:" line followed by the label.')
  }
  const shortText = toBlocks(partALines.slice(0, labelLine)).map(joinLines)
  if (shortText.length === 0) {
    throw new Error('privacy_text.txt: Part A needs the short text before the "Checkbox label:" line.')
  }
  const checkboxLabel = toBlocks(partALines.slice(labelLine + 1)).map(joinLines).join(' ')
  if (!checkboxLabel.toLowerCase().includes(NOTICE_LINK_WORDS)) {
    throw new Error(`privacy_text.txt: the checkbox label must contain the words "${NOTICE_LINK_WORDS}" (they link to the Privacy page).`)
  }

  const [first, ...rest] = toBlocks(lines.slice(partB + 1))
  if (!first) {
    throw new Error('privacy_text.txt: Part B (the full privacy notice) is empty.')
  }
  const notice = [{ type: 'title', text: clean(first[0]) }, ...bodyBlocks(first.slice(1))]
  for (const block of rest) {
    if (/^\d+\.\s/.test(clean(block[0]))) {
      notice.push({ type: 'heading', text: clean(block[0]) }, ...bodyBlocks(block.slice(1)))
    } else {
      notice.push(...bodyBlocks(block))
    }
  }
  return { shortText, checkboxLabel, notice }
}
