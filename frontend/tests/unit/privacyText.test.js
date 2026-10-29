/**
 * Unit tests for src/lib/privacyText.js against Bean Co.'s real privacy_text.txt: the app must show
 * every word of it, in order, and a file without the expected structure must be refused with a clear
 * message. Run with `npm run test:unit`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { NOTICE_LINK_WORDS, parsePrivacyText } from '../../src/lib/privacyText.js'

const RAW = readFileSync(new URL('../../../privacy_text.txt', import.meta.url), 'utf8')

/**
 * The words of a text, split on whitespace.
 * @param {string} text
 * @returns {string[]}
 */
function words(text) {
  return text.split(/\s+/).filter(Boolean)
}

/**
 * The words the app should show: the whole file without the "=" lines, the PART headings, the
 * "Checkbox label:" line and the "-" list markers, which are layout, not text.
 * @param {string} raw
 * @returns {string[]}
 */
function wordsToShow(raw) {
  const lines = raw.split('\n').filter((line) => !/^=+$|^PART [AB]\b|^Checkbox label:$/.test(line.trim()))
  return words(lines.join('\n')).filter((word) => word !== '-')
}

/**
 * Every word the parser returns, in reading order.
 * @param {import('../../src/lib/privacyText.js').PrivacyText} parsed
 * @returns {string[]}
 */
function wordsShown(parsed) {
  const notice = parsed.notice.flatMap((block) => (block.type === 'list' ? block.items : [block.text]))
  return words([...parsed.shortText, parsed.checkboxLabel, ...notice].join(' '))
}

test('the real privacy_text.txt is shown word for word, in order (US-01 AC5)', () => {
  const parsed = parsePrivacyText(RAW)
  assert.deepEqual(wordsShown(parsed), wordsToShow(RAW))
})

test('Part A: the short text and the checkbox label with the words that link to the notice', () => {
  const parsed = parsePrivacyText(RAW)
  assert.equal(parsed.shortText.length, 1)
  assert.match(parsed.shortText[0], /^Greenie stores your email, password /)
  assert.equal(parsed.checkboxLabel, 'I have read the privacy notice and agree to the processing of my data.')
  assert.ok(parsed.checkboxLabel.includes(NOTICE_LINK_WORDS))
})

test('Part B: title, date, 11 numbered sections and the lists', () => {
  const { notice } = parsePrivacyText(RAW)
  assert.deepEqual(notice[0], { type: 'title', text: 'GREENIE PRIVACY NOTICE' })
  assert.deepEqual(notice[1], { type: 'paragraph', text: 'Last updated: 28 October 2026' })
  const headings = notice.filter((block) => block.type === 'heading').map((block) => block.text)
  assert.equal(headings.length, 11)
  assert.equal(headings[0], '1. Who is responsible')
  assert.equal(headings[10], '11. Changes')
  const lists = notice.filter((block) => block.type === 'list')
  assert.deepEqual(lists.map((list) => list.items.length), [3, 6, 3])
  // An indented line continues the list item above it.
  assert.equal(lists[0].items[0], 'Account data: your email address and your password. The password is stored only as a salted hash. We cannot read it.')
})

test('Windows line endings give the same result', () => {
  assert.deepEqual(parsePrivacyText(RAW.replaceAll('\n', '\r\n')), parsePrivacyText(RAW))
})

test('a file without the expected structure is refused with a clear message', () => {
  assert.throws(() => parsePrivacyText(RAW.replace('PART B', 'SECOND PART')), /needs a line starting "PART A"/)
  assert.throws(() => parsePrivacyText(RAW.replace('Checkbox label:', 'Label:')), /"Checkbox label:" line/)
  assert.throws(() => parsePrivacyText(RAW.replace('the privacy notice and agree', 'the notice and agree')), /must contain the words "privacy notice"/)
  assert.throws(() => parsePrivacyText(RAW.slice(0, RAW.indexOf('GREENIE PRIVACY NOTICE'))), /Part B .* is empty/)
  assert.throws(() => parsePrivacyText('PART A\n\nCheckbox label:\nI agree to the privacy notice.\nPART B\nNotice'), /short text/)
})
