/**
 * Unit tests for the actions.json rules (scripts/lib/actions-rules.mjs) and the SQL generator
 * (scripts/actions-to-sql.mjs). Run with `npm run test:unit` in frontend/.
 * The database applies the same rules (supabase/tests/actions_sync.test.sql).
 */
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildActionsSql } from '../actions-to-sql.mjs'
import { trimEdges, validateActions } from '../lib/actions-rules.mjs'
import { readJsonFile } from '../lib/read-json.mjs'

/**
 * Returns a valid action, with optional changes.
 * @param {object} [changes]
 * @returns {object}
 */
function action(changes = {}) {
  return { key: 'test_action', label: 'Test action', points: 10, daily_limit: 2, co2_g: 40, ...changes }
}

test('a valid list passes', () => {
  assert.deepEqual(validateActions([action(), action({ key: 'other', co2_g: 0 })]), [])
})

test('the repository actions.json passes', () => {
  const result = readJsonFile(join(import.meta.dirname, '..', '..', 'actions.json'))
  assert.equal(result.ok, true)
  assert.deepEqual(validateActions(result.value), [])
})

test('the top level must be a non-empty array', () => {
  assert.equal(validateActions({}).length, 1)
  assert.equal(validateActions([]).length, 1)
  assert.equal(validateActions(null).length, 1)
})

test('entries must be objects', () => {
  assert.match(validateActions(['x'])[0], /entry 1 must be an object/)
  assert.match(validateActions([[1]])[0], /entry 1 must be an object/)
})

test('missing and unknown fields are reported', () => {
  const missing = action()
  delete missing.co2_g
  assert.match(validateActions([missing]).join(), /missing the field "co2_g"/)
  assert.match(validateActions([action({ extra: 1 })]).join(), /unknown field "extra"/)
})

test('keys must match the pattern and be unique', () => {
  assert.match(validateActions([action({ key: 'Bad-Key' })]).join(), /"key" must be/)
  assert.match(validateActions([action({ key: '' })]).join(), /"key" must be/)
  assert.match(validateActions([action({ key: 'a'.repeat(51) })]).join(), /"key" must be/)
  assert.deepEqual(validateActions([action({ key: 'a'.repeat(50) })]), [])
  assert.match(validateActions([action(), action()]).join(), /used more than once/)
})

test('labels must be 1 to 200 characters after trimming', () => {
  assert.match(validateActions([action({ label: '   ' })]).join(), /"label"/)
  assert.match(validateActions([action({ label: 5 })]).join(), /"label"/)
  assert.match(validateActions([action({ label: 'x'.repeat(201) })]).join(), /"label"/)
  assert.deepEqual(validateActions([action({ label: ' ' + 'x'.repeat(200) + '\n' })]), [])
})

test('points and daily_limit must be whole numbers of at least 1', () => {
  for (const field of ['points', 'daily_limit']) {
    for (const bad of [0, -1, 1.5, '10', null, true, 2147483648]) {
      assert.match(validateActions([action({ [field]: bad })]).join(), new RegExp(`"${field}"`), `${field}=${bad}`)
    }
    assert.deepEqual(validateActions([action({ [field]: 1 })]), [])
  }
})

test('co2_g must be a whole number, 0 or more', () => {
  for (const bad of [-1, 2.5, '40', null]) {
    assert.match(validateActions([action({ co2_g: bad })]).join(), /"co2_g"/, `co2_g=${bad}`)
  }
  assert.deepEqual(validateActions([action({ co2_g: 0 })]), [])
})

test('errors name the entry number and key', () => {
  assert.match(validateActions([action(), action({ key: 'second', points: 0 })])[0], /entry 2 \("second"\)/)
})

test('trimEdges removes ASCII whitespace only', () => {
  assert.equal(trimEdges(' \t\n a b \r\f\v'), 'a b')
  assert.equal(trimEdges(' a '), ' a ')
})

test('buildActionsSql wraps the JSON in one sync call', () => {
  const sql = buildActionsSql([action()])
  assert.match(sql, /^-- Generated/)
  assert.match(sql, /select private\.sync_actions\(\$greenie\$\[\{"key":"test_action".*\}\]\$greenie\$::jsonb\);/)
})

test('buildActionsSql refuses JSON containing the quote tag', () => {
  assert.throws(() => buildActionsSql([action({ label: 'a $greenie$ b' })]), /must not contain/)
})
