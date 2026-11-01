/**
 * Form validation for registration and login (US-01 AC1 to AC4, US-13).
 *
 * These checks only give early, friendly messages. The database applies the same rules again in the
 * sign-up trigger (supabase/migrations/*_signup.sql), so the two must stay in step: trimming removes
 * exactly the same characters, and lengths count characters the way Postgres does (code points).
 */
import { MESSAGES } from './messages.js'

/** Nicknames: 3 to 20 letters A to Z (no accents, decision D1), digits or underscore. */
export const NICKNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/

/** Minimum password length (US-01 AC1; also set in Supabase Auth). */
export const MIN_PASSWORD_LENGTH = 8

/** Spaces, tabs and line breaks at either end; the same set the database trims. */
const EDGE_WHITESPACE = /^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g

/** A simple email shape check; Supabase Auth checks the address again. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Removes spaces, tabs and line breaks at both ends.
 * @param {string} text
 * @returns {string}
 */
export function trimEdges(text) {
  return String(text ?? '').replace(EDGE_WHITESPACE, '')
}

/**
 * Counts characters as Postgres char_length does (Unicode code points, not UTF-16 units).
 * @param {string} text
 * @returns {number}
 */
export function charLength(text) {
  return [...text].length
}

/**
 * Normalises an email for sign-up and login: trimmed and lowercased.
 * @param {string} email
 * @returns {string}
 */
export function normaliseEmail(email) {
  return trimEdges(email).toLowerCase()
}

/**
 * Checks that a year, month and day form a real calendar date.
 * @param {number} year
 * @param {number} month - 1 to 12.
 * @param {number} day
 * @returns {boolean}
 */
function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/**
 * Parses a date of birth typed as DD.MM.YYYY (one-digit day or month allowed).
 * @param {string} text
 * @returns {string | null} The date as YYYY-MM-DD, or null if it isn't a real date in that format.
 */
export function parseBirthDate(text) {
  const match = trimEdges(text).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) return null
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])]
  if (!isRealDate(year, month, day)) return null
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * The date 16 years after a birth date, as Postgres computes `date + interval '16 years'`:
 * 29 February moves to 28 February when the target year has no 29 February.
 * @param {string} isoDate - YYYY-MM-DD.
 * @returns {string} YYYY-MM-DD.
 */
export function sixteenthBirthday(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const targetYear = year + 16
  const lastDayOfMonth = new Date(Date.UTC(targetYear, month, 0)).getUTCDate()
  const targetDay = Math.min(day, lastDayOfMonth)
  return `${targetYear}-${String(month).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

/**
 * Validates the registration form.
 * @param {{ email: string, password: string, nickname: string, firstName: string, lastName: string,
 *   birthDate: string, university: string }} values - Raw field values (birthDate as typed, DD.MM.YYYY).
 * @param {string} todayIso - Today's date in Zürich, YYYY-MM-DD.
 * @returns {Record<string, string>} Error message per field name; empty when everything is valid.
 */
export function validateRegistration(values, todayIso) {
  const errors = {}

  if (!EMAIL_PATTERN.test(normaliseEmail(values.email))) errors.email = MESSAGES.emailInvalid
  if (charLength(values.password ?? '') < MIN_PASSWORD_LENGTH) errors.password = MESSAGES.passwordTooShort
  if (!NICKNAME_PATTERN.test(trimEdges(values.nickname))) errors.nickname = MESSAGES.nicknameInvalid

  const firstName = charLength(trimEdges(values.firstName))
  if (firstName < 1 || firstName > 50) errors.firstName = MESSAGES.nameInvalid
  const lastName = charLength(trimEdges(values.lastName))
  if (lastName < 1 || lastName > 50) errors.lastName = MESSAGES.nameInvalid

  const birthIso = parseBirthDate(values.birthDate)
  if (!birthIso || birthIso < '1900-01-01' || birthIso > todayIso) {
    errors.birthDate = MESSAGES.birthDateInvalid
  } else if (sixteenthBirthday(birthIso) > todayIso) {
    errors.birthDate = MESSAGES.tooYoung
  }

  const university = charLength(trimEdges(values.university))
  if (university < 2 || university > 60) errors.university = MESSAGES.universityInvalid

  return errors
}

/**
 * Validates the login form before calling Supabase Auth.
 * @param {{ email: string, password: string }} values
 * @returns {Record<string, string>} Error message per field name.
 */
export function validateLogin(values) {
  const errors = {}
  if (!EMAIL_PATTERN.test(normaliseEmail(values.email))) errors.email = MESSAGES.emailInvalid
  if (!values.password) errors.password = MESSAGES.passwordMissing
  return errors
}

/**
 * Validates the "Reset password" form (US-10 AC1).
 * @param {string} email
 * @returns {string} The error message, or '' when the address looks valid.
 */
export function validateResetEmail(email) {
  return EMAIL_PATTERN.test(normaliseEmail(email)) ? '' : MESSAGES.emailInvalid
}

/**
 * Validates a new password (US-10 AC2): at least 8 characters, as at registration.
 * @param {string} password
 * @returns {string} The error message, or '' when the password is long enough.
 */
export function validateNewPassword(password) {
  return charLength(password ?? '') < MIN_PASSWORD_LENGTH ? MESSAGES.passwordTooShort : ''
}

/**
 * Builds the sign-up metadata the database trigger reads (trimmed; date as YYYY-MM-DD).
 * Call only after validateRegistration returned no errors.
 * @param {{ nickname: string, firstName: string, lastName: string, birthDate: string, university: string }} values
 * @returns {{ nickname: string, first_name: string, last_name: string, date_of_birth: string, university: string }}
 */
export function signUpMetadata(values) {
  return {
    nickname: trimEdges(values.nickname),
    first_name: trimEdges(values.firstName),
    last_name: trimEdges(values.lastName),
    date_of_birth: parseBirthDate(values.birthDate),
    university: trimEdges(values.university),
  }
}
