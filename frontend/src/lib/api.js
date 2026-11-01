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
 *   streak_increased: boolean, used_today: number, daily_limit: number, co2_g: number,
 *   new_badges: Array<{ key: string, label: string }> }>}
 */
export async function logAction(actionKey) {
  const rows = await rpc('log_action', { p_action_key: actionKey })
  return rows[0]
}

/**
 * Students whose nickname contains the search text (up to 20, alphabetical).
 * @param {string} query
 * @returns {Promise<Array<{ id: string, nickname: string, university: string }>>}
 */
export async function searchStudents(query) {
  return rpc('search_students', { p_query: query })
}

/**
 * A student's public profile. Throws AppError('not_found') for an unknown student.
 * @param {string} studentId
 * @returns {Promise<{ id: string, nickname: string, university: string, total_points: number,
 *   week_points: number, streak: number, is_following: boolean, is_me: boolean,
 *   badges: Array<{ key: string, label: string }> }>}
 */
export async function getStudentProfile(studentId) {
  const rows = await rpc('get_student_profile', { p_id: studentId })
  if (!rows?.length) throw new AppError('not_found')
  return rows[0]
}

/**
 * Follows or unfollows a student.
 * @param {string} studentId
 * @param {boolean} follow - true to follow, false to unfollow.
 * @returns {Promise<boolean>} Whether the caller now follows the student.
 */
export async function setFollowing(studentId, follow) {
  return rpc(follow ? 'follow_student' : 'unfollow_student', { p_id: studentId })
}

/**
 * One weekly leaderboard.
 * @param {'everyone' | 'following'} tab
 * @returns {Promise<Array<{ rank: number, user_id: string, nickname: string, week_points: number,
 *   is_me: boolean, is_pinned: boolean }>>}
 */
export async function getLeaderboard(tab) {
  return rpc('get_leaderboard', { p_tab: tab })
}

/**
 * The caller's last 20 log entries, newest first.
 * @returns {Promise<Array<{ id: number, label: string, points: number, co2_g: number, logged_at_utc: string }>>}
 */
export async function getMyHistory() {
  return rpc('get_my_history')
}

/**
 * Every badge, with whether the caller has earned it.
 * @returns {Promise<Array<{ key: string, label: string, rule: 'logs' | 'points' | 'streak', threshold: number,
 *   earned: boolean }>>}
 */
export async function getMyBadges() {
  return rpc('get_my_badges')
}

/**
 * Deletes the caller's account and all their data, then ends the session on this device.
 * @returns {Promise<void>}
 */
export async function deleteMyAccount() {
  await rpc('delete_my_account')
  await supabase.auth.signOut({ scope: 'local' })
}

/**
 * Asks Supabase Auth to email a password reset link. The link opens the app's "Set a new password"
 * page (/reset-password), which must be among the redirect URLs in Supabase's URL configuration.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email) {
  const redirectTo = new URL(`${import.meta.env.BASE_URL}reset-password`, window.location.origin).href
  const { error } = await supabase.auth.resetPasswordForEmail(normaliseEmail(email), { redirectTo })
  if (error) throw toAppError(error)
}

/**
 * Sets a new password for the account of the current (password recovery) session, then logs out on
 * this device, so the student logs in again with the new password.
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function saveNewPassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw toAppError(error)
  await supabase.auth.signOut({ scope: 'local' })
}
