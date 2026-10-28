/**
 * One function per server call. Pages use these instead of calling Supabase directly, so every call
 * returns plain data or throws an AppError (lib/errors.js).
 */
import { AppError, toAppError } from './errors.js'
import { supabase } from './supabase.js'
import { normaliseEmail, signUpMetadata } from './validation.js'

/**
 * Calls a database function and returns its rows.
 * @param {string} name - Function name in the public schema.
 * @param {object} [params]
 * @returns {Promise<any>}
 */
async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw toAppError(error)
  return data
}

/**
 * Checks whether a nickname is free (case-insensitive).
 * @param {string} nickname
 * @returns {Promise<boolean>}
 */
export async function isNicknameAvailable(nickname) {
  return rpc('nickname_available', { p_nickname: nickname })
}

/**
 * Creates an account and logs in. The profile fields travel as sign-up metadata; the database trigger
 * validates them and creates the profile, or cancels the sign-up.
 * @param {{ email: string, password: string, nickname: string, firstName: string, lastName: string,
 *   birthDate: string, university: string }} values - Already validated form values.
 * @returns {Promise<{ hasSession: boolean }>}
 */
export async function signUp(values) {
  const { data, error } = await supabase.auth.signUp({
    email: normaliseEmail(values.email),
    password: values.password,
    options: { data: signUpMetadata(values) },
  })
  if (error) throw toAppError(error)
  return { hasSession: Boolean(data.session) }
}

/**
 * Logs in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function logIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: normaliseEmail(email), password })
  if (error) throw toAppError(error)
}

/**
 * Logs out on this device only (other devices stay logged in, US-13 AC3).
 * @returns {Promise<void>}
 */
export async function logOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw toAppError(error)
}

/**
 * Home values for the logged-in student.
 * @returns {Promise<{ nickname: string, total_points: number, today_points: number, week_points: number,
 *   streak: number, co2_saved_g: number }>}
 */
export async function getMyStatus() {
  const rows = await rpc('get_my_status')
  if (!rows?.length) throw new AppError('not_found')
  return rows[0]
}

/**
 * The actions for the Log screen, in actions.json order, with today's use.
 * @returns {Promise<Array<{ key: string, label: string, points: number, daily_limit: number,
 *   co2_g: number, used_today: number }>>}
 */
export async function getLogActions() {
  return rpc('get_log_actions')
}

/**
 * Logs one action. Throws AppError('daily_limit_reached') at the limit.
 * @param {string} actionKey
 * @returns {Promise<{ points_added: number, total_points: number, today_points: number, streak: number,
 *   streak_increased: boolean, used_today: number, daily_limit: number, co2_g: number }>}
 */
export async function logAction(actionKey) {
  const rows = await rpc('log_action', { p_action_key: actionKey })
  return rows[0]
}
