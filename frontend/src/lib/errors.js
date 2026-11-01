/**
 * Turns errors from Supabase (Auth and database functions) into one short code each, and codes into
 * the text the user sees. The database functions raise fixed messages (supabase/migrations/*_api.sql
 * and *_signup.sql); Supabase Auth returns error codes such as invalid_credentials.
 */
import { MESSAGES } from './messages.js'

/** Messages raised by the Greenie database functions and the sign-up trigger. */
const DATABASE_CODES = [
  'not_authenticated',
  'not_found',
  'unknown_action',
  'daily_limit_reached',
  'email_taken',
  'nickname_taken',
  'too_young',
  'cannot_follow_self',
]

/**
 * Returns a short code for any error from supabase-js.
 * @param {any} error - An AuthError, a PostgrestError or a thrown Error.
 * @returns {string} One of the codes in DATABASE_CODES, 'invalid_input: <field>', an Auth error code,
 *   'rate_limited', 'network' or 'unknown'.
 */
export function errorCode(error) {
  if (!error) return 'unknown'
  const message = typeof error.message === 'string' ? error.message.trim() : ''
  if (DATABASE_CODES.includes(message)) return message
  if (message.startsWith('invalid_input: ')) return message
  // A malformed id in an address (for example /students/abc) is an unknown student.
  if (error.code === '22P02') return 'not_found'
  if (error.status === 429 || /rate_limit/.test(error.code ?? '')) return 'rate_limited'
  if (error.code === 'user_already_exists' || error.code === 'email_exists') return 'email_taken'
  if (typeof error.code === 'string' && /^[a-z_]+$/.test(error.code)) return error.code
  if (error.name === 'AuthRetryableFetchError' || error.name === 'TypeError' || /fetch/i.test(message)) return 'network'
  return 'unknown'
}

/**
 * The text to show for an error code that isn't tied to one form field.
 * @param {string} code
 * @returns {string}
 */
export function messageFor(code) {
  switch (code) {
    case 'invalid_credentials':
      return MESSAGES.loginFailed
    case 'daily_limit_reached':
      return MESSAGES.dailyLimitReached
    case 'rate_limited':
      return MESSAGES.rateLimited
    case 'network':
      return MESSAGES.network
    default:
      return MESSAGES.generic
  }
}

/** An error carrying one of the codes above. */
export class AppError extends Error {
  /**
   * @param {string} code - Code from errorCode().
   * @param {any} [cause] - The original error.
   */
  constructor(code, cause) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.cause = cause
  }
}

/**
 * Wraps any supabase-js error in an AppError.
 * @param {any} error
 * @returns {AppError}
 */
export function toAppError(error) {
  return error instanceof AppError ? error : new AppError(errorCode(error), error)
}
