/**
 * Unit tests for src/lib/format.js and src/lib/errors.js. Run with `npm run test:unit`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  actionDetails, daysLabel, formatCo2, formatCo2Saved, formatLogTime, formatNumber, streakDaysLabel, streakLabel, zurichToday,
} from '../../src/lib/format.js'
import { errorCode, messageFor } from '../../src/lib/errors.js'
import { MESSAGES } from '../../src/lib/messages.js'

test('numbers use thousands separators as in Figma', () => {
  assert.equal(formatNumber(0), '0')
  assert.equal(formatNumber(1240), '1,240')
  assert.equal(formatNumber(1234567), '1,234,567')
})

test('CO2: grams below 1000, then kg with at most one decimal (US-14 AC2)', () => {
  assert.equal(formatCo2(0), '≈ 0 g CO₂')
  assert.equal(formatCo2(40), '≈ 40 g CO₂')
  assert.equal(formatCo2(999), '≈ 999 g CO₂')
  assert.equal(formatCo2(1000), '≈ 1 kg CO₂')
  assert.equal(formatCo2(1500), '≈ 1.5 kg CO₂')
  assert.equal(formatCo2(1050), '≈ 1.1 kg CO₂')
  assert.equal(formatCo2(4200), '≈ 4.2 kg CO₂')
  assert.equal(formatCo2(5000), '≈ 5 kg CO₂')
  assert.equal(formatCo2(1234567), '≈ 1,234.6 kg CO₂')
})

test('Log screen details line matches Figma S3', () => {
  assert.equal(actionDetails({ daily_limit: 5, co2_g: 40, used_today: 0 }), 'Limit 5 per day · ≈ 40 g CO₂')
  assert.equal(actionDetails({ daily_limit: 1, co2_g: 5000, used_today: 1 }), 'Limit 1 per day · ≈ 5 kg CO₂ · 1 logged today')
})

test('streak labels match Figma S2 and S4', () => {
  assert.equal(streakLabel(7), '7-day streak')
  assert.equal(streakLabel(0), '0-day streak')
  assert.equal(streakDaysLabel(8), 'Streak: 8 days')
  assert.equal(streakDaysLabel(1), 'Streak: 1 day')
})

test('CO2 saved on Home and the success screen, as in Figma S2 and S4 (US-14 AC3, AC4)', () => {
  assert.equal(formatCo2Saved(0), '≈ 0 g CO₂ saved')
  assert.equal(formatCo2Saved(40), '≈ 40 g CO₂ saved')
  assert.equal(formatCo2Saved(4200), '≈ 4.2 kg CO₂ saved')
})

test('profile streak in days, as in Figma S9', () => {
  assert.equal(daysLabel(12), '12 days')
  assert.equal(daysLabel(1), '1 day')
  assert.equal(daysLabel(0), '0 days')
})

test('history times in Zürich: Today, Yesterday, otherwise weekday and date (US-05 AC1, Figma S7)', () => {
  const now = new Date('2026-10-30T10:00:00Z') // Friday 30 Oct, 11:00 in Zürich
  assert.equal(formatLogTime('2026-10-30T11:41:00Z', now), 'Today, 12:41')
  assert.equal(formatLogTime('2026-10-29T17:03:00Z', now), 'Yesterday, 18:03')
  assert.equal(formatLogTime('2026-10-19T16:45:00Z', now), 'Mon 19 Oct, 18:45') // summer time, UTC+2
  assert.equal(formatLogTime('2026-10-29T22:59:00Z', now), 'Yesterday, 23:59')
  assert.equal(formatLogTime('2026-10-29T23:01:00Z', now), 'Today, 00:01') // midnight in Zürich, not UTC
  assert.equal(formatLogTime('2026-11-02T00:30:00Z', new Date('2026-11-02T08:00:00Z')), 'Today, 01:30') // winter time
})

test('zurichToday uses the Zürich calendar, not the computer\'s', () => {
  assert.equal(zurichToday(new Date('2026-11-02T22:59:00Z')), '2026-11-02')
  assert.equal(zurichToday(new Date('2026-11-02T23:01:00Z')), '2026-11-03')
  assert.equal(zurichToday(new Date('2026-10-24T22:01:00Z')), '2026-10-25')
})

test('errors from the database and Supabase Auth map to codes', () => {
  assert.equal(errorCode({ code: 'P0001', message: 'daily_limit_reached' }), 'daily_limit_reached')
  assert.equal(errorCode({ message: 'too_young', status: 500 }), 'too_young')
  assert.equal(errorCode({ message: 'invalid_input: nickname' }), 'invalid_input: nickname')
  assert.equal(errorCode({ code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }), 'invalid_credentials')
  assert.equal(errorCode({ code: 'user_already_exists', status: 422 }), 'email_taken')
  assert.equal(errorCode({ code: 'weak_password', status: 422 }), 'weak_password')
  assert.equal(errorCode({ code: 'over_request_rate_limit', status: 429 }), 'rate_limited')
  assert.equal(errorCode({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), 'network')
  assert.equal(errorCode({ message: 'Database error saving new user', status: 500 }), 'unknown')
  assert.equal(errorCode({ code: 'P0001', message: 'cannot_follow_self' }), 'cannot_follow_self')
  assert.equal(errorCode({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }), 'not_found')
  assert.equal(errorCode({ code: 'same_password', status: 422 }), 'same_password')
})

test('codes map to the brief\'s wording', () => {
  assert.equal(messageFor('invalid_credentials'), 'Email or password is incorrect')
  assert.equal(messageFor('daily_limit_reached'), 'Daily limit reached for this action')
  assert.equal(messageFor('rate_limited'), MESSAGES.rateLimited)
  assert.equal(messageFor('anything_else'), MESSAGES.generic)
})
