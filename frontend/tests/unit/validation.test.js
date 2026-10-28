/**
 * Unit tests for src/lib/validation.js (US-01 AC1 to AC4). The same boundaries are tested in the
 * database (supabase/tests/database/signup.test.sql), so browser and database agree.
 * Run with `npm run test:unit`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  charLength, normaliseEmail, parseBirthDate, signUpMetadata, sixteenthBirthday, trimEdges,
  validateLogin, validateRegistration,
} from '../../src/lib/validation.js'
import { MESSAGES } from '../../src/lib/messages.js'

const TODAY = '2026-10-28'

/**
 * A valid registration, with optional changes.
 * @param {object} [changes]
 * @returns {object}
 */
function form(changes = {}) {
  return {
    email: 'alex@uni.ch', password: 'secret12', nickname: 'eco_alex', firstName: 'Alex',
    lastName: 'Meier', birthDate: '12.05.2000', university: 'ETH Zurich', ...changes,
  }
}

test('a valid form has no errors', () => {
  assert.deepEqual(validateRegistration(form(), TODAY), {})
})

test('email must look like an address; it is trimmed and lowercased', () => {
  assert.equal(validateRegistration(form({ email: 'alex' }), TODAY).email, MESSAGES.emailInvalid)
  assert.equal(validateRegistration(form({ email: '' }), TODAY).email, MESSAGES.emailInvalid)
  assert.equal(validateRegistration(form({ email: ' Alex@Uni.CH ' }), TODAY).email, undefined)
  assert.equal(normaliseEmail(' Alex@Uni.CH\t'), 'alex@uni.ch')
})

test('password needs at least 8 characters', () => {
  assert.equal(validateRegistration(form({ password: '1234567' }), TODAY).password, MESSAGES.passwordTooShort)
  assert.equal(validateRegistration(form({ password: '12345678' }), TODAY).password, undefined)
})

test('nickname: 3 to 20 letters A-Z, digits, underscore', () => {
  for (const bad of ['ab', 'a'.repeat(21), 'eco-alex', 'eco alex', 'zoë_1', '']) {
    assert.equal(validateRegistration(form({ nickname: bad }), TODAY).nickname, MESSAGES.nicknameInvalid, bad)
  }
  for (const good of ['abc', 'Abc_20_chars_long_xy', ' eco_alex ']) {
    assert.equal(validateRegistration(form({ nickname: good }), TODAY).nickname, undefined, good)
  }
})

test('first and last name: 1 to 50 characters after trimming', () => {
  assert.equal(validateRegistration(form({ firstName: '   ' }), TODAY).firstName, MESSAGES.nameInvalid)
  assert.equal(validateRegistration(form({ firstName: 'a'.repeat(51) }), TODAY).firstName, MESSAGES.nameInvalid)
  assert.equal(validateRegistration(form({ firstName: 'é'.repeat(50) }), TODAY).firstName, undefined)
  assert.equal(validateRegistration(form({ lastName: '' }), TODAY).lastName, MESSAGES.nameInvalid)
  assert.equal(validateRegistration(form({ lastName: 'b'.repeat(51) }), TODAY).lastName, MESSAGES.nameInvalid)
})

test('university: 2 to 60 characters after trimming', () => {
  assert.equal(validateRegistration(form({ university: ' E ' }), TODAY).university, MESSAGES.universityInvalid)
  assert.equal(validateRegistration(form({ university: 'u'.repeat(61) }), TODAY).university, MESSAGES.universityInvalid)
  assert.equal(validateRegistration(form({ university: 'UZ' }), TODAY).university, undefined)
})

test('date of birth: DD.MM.YYYY, a real date, from 1900, not in the future', () => {
  for (const bad of ['2000-05-12', '31.02.2001', '12/05/2000', '1.1.85', '31.12.1899', '29.10.2026', '']) {
    assert.equal(validateRegistration(form({ birthDate: bad }), TODAY).birthDate, MESSAGES.birthDateInvalid, bad)
  }
  assert.equal(validateRegistration(form({ birthDate: '01.01.1900' }), TODAY).birthDate, undefined)
  assert.equal(validateRegistration(form({ birthDate: '1.2.2000' }), TODAY).birthDate, undefined)
})

test('date of birth: at least 16 on today\'s date', () => {
  assert.equal(validateRegistration(form({ birthDate: '28.10.2010' }), TODAY).birthDate, undefined, 'exactly 16')
  assert.equal(validateRegistration(form({ birthDate: '29.10.2010' }), TODAY).birthDate, MESSAGES.tooYoung, '15 years 364 days')
  assert.equal(validateRegistration(form({ birthDate: '12.05.2012' }), TODAY).birthDate, MESSAGES.tooYoung, 'Figma example')
})

test('sixteenthBirthday matches Postgres for 29 February', () => {
  assert.equal(sixteenthBirthday('2008-02-29'), '2024-02-29')
  assert.equal(sixteenthBirthday('2084-02-29'), '2100-02-28')
  assert.equal(sixteenthBirthday('2000-05-12'), '2016-05-12')
})

test('parseBirthDate returns ISO dates', () => {
  assert.equal(parseBirthDate('12.05.2000'), '2000-05-12')
  assert.equal(parseBirthDate(' 1.2.2000 '), '2000-02-01')
  assert.equal(parseBirthDate('29.02.2001'), null)
  assert.equal(parseBirthDate('29.02.2004'), '2004-02-29')
})

test('trimming and length match the database', () => {
  assert.equal(trimEdges(' \t\n Alex \r\f\v'), 'Alex')
  assert.equal(trimEdges(' Alex'), ' Alex', 'non-breaking space is kept, as in Postgres')
  assert.equal(charLength('😀a'), 2, 'counts code points like char_length')
})

test('signUpMetadata trims fields and converts the date', () => {
  assert.deepEqual(signUpMetadata(form({ nickname: ' eco_alex ', firstName: '\tAlex', university: ' ETH Zurich ' })), {
    nickname: 'eco_alex', first_name: 'Alex', last_name: 'Meier', date_of_birth: '2000-05-12', university: 'ETH Zurich',
  })
})

test('login form needs an email and a password', () => {
  assert.deepEqual(validateLogin({ email: 'a@b.ch', password: 'x' }), {})
  assert.equal(validateLogin({ email: '', password: 'x' }).email, MESSAGES.emailInvalid)
  assert.equal(validateLogin({ email: 'a@b.ch', password: '' }).password, MESSAGES.passwordMissing)
})
