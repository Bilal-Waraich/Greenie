/**
 * Unit tests for src/lib/guide.js (the guide filter, US-07) and src/lib/badges.js (badge texts, US-15).
 * Run with `npm run test:unit`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { badgeRuleText, earnedSummary } from '../../src/lib/badges.js'
import { filterGuide, foldText, guideDetails } from '../../src/lib/guide.js'

const ENTRIES = [
  { item: 'PET bottles', where: 'Back to the shop', note: 'Return PET drink bottles.' },
  { item: 'Drinking glasses', where: 'Household waste (Züri-Sack)', note: 'Not in the glass container.' },
  { item: 'Batteries', where: 'Point of sale', note: '' },
]

test('the filter matches item, place and note, ignoring case and accents (US-07 AC2)', () => {
  assert.deepEqual(filterGuide(ENTRIES, 'BATT').map((entry) => entry.item), ['Batteries'])
  assert.deepEqual(filterGuide(ENTRIES, 'zuri').map((entry) => entry.item), ['Drinking glasses'])
  assert.deepEqual(filterGuide(ENTRIES, 'glass').map((entry) => entry.item), ['Drinking glasses'])
  assert.deepEqual(filterGuide(ENTRIES, 'shop').map((entry) => entry.item), ['PET bottles'])
  assert.deepEqual(filterGuide(ENTRIES, 'xyz'), [])
})

test('several words must all match, in any order', () => {
  assert.deepEqual(filterGuide(ENTRIES, 'container glasses').map((entry) => entry.item), ['Drinking glasses'])
  assert.deepEqual(filterGuide(ENTRIES, 'glasses batteries'), [])
})

test('an empty filter shows every entry, in file order (US-07 AC1)', () => {
  assert.deepEqual(filterGuide(ENTRIES, ''), ENTRIES)
  assert.deepEqual(filterGuide(ENTRIES, '   '), ENTRIES)
})

test('foldText removes accents and letter case', () => {
  assert.equal(foldText('Züri-Sack ÉCOLE'), 'zuri-sack ecole')
})

test('an entry\'s second line is "where · note", or just "where" without a note (Figma S6)', () => {
  assert.equal(guideDetails(ENTRIES[0]), 'Back to the shop · Return PET drink bottles.')
  assert.equal(guideDetails(ENTRIES[2]), 'Point of sale')
})

test('every entry of the repository guide.json is listed with no filter', () => {
  const guide = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', '..', 'guide.json'), 'utf8'))
  assert.equal(filterGuide(guide, '').length, guide.length)
})

test('badge rules in words, as in the brief\'s table 7.3 and Figma S11', () => {
  assert.equal(badgeRuleText({ rule: 'logs', threshold: 1 }), 'Log your first action')
  assert.equal(badgeRuleText({ rule: 'logs', threshold: 50 }), 'Log 50 actions')
  assert.equal(badgeRuleText({ rule: 'points', threshold: 100 }), 'Reach 100 total points')
  assert.equal(badgeRuleText({ rule: 'points', threshold: 1000 }), 'Reach 1,000 total points')
  assert.equal(badgeRuleText({ rule: 'streak', threshold: 7 }), 'Log 7 days in a row')
})

test('the earned count, as in Figma S2 and S11 (US-15 AC3)', () => {
  assert.equal(earnedSummary([{ earned: false }, { earned: false }]), '0 of 2 earned')
  assert.equal(earnedSummary([{ earned: true }, { earned: false }, { earned: true }]), '2 of 3 earned')
})
