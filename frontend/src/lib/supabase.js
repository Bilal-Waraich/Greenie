/**
 * The single Supabase client used by the whole app.
 *
 * The URL and publishable key come from Vite environment variables: locally from
 * frontend/.env.development.local, on GitHub Pages from the repository variables at build time.
 * Both are public by design; all access rules are enforced in the database.
 */
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** True when both values are present, so the app can show a clear message otherwise. */
export const isConfigured = Boolean(url && publishableKey)

/** Remembers, for this browser tab, that the page was opened from a password reset email. */
const RECOVERY_FLAG = 'greenie.passwordRecovery'

/**
 * Reads the address the page was opened with, before the Supabase client removes the login details
 * from it. A password reset link arrives as "#…&type=recovery"; an expired or used link arrives as
 * "#error=…". The flag survives a reload of the "Set a new password" page (US-10 AC2).
 */
const linkParams = new URLSearchParams(window.location.hash.slice(1))
if (linkParams.get('type') === 'recovery') {
  try {
    sessionStorage.setItem(RECOVERY_FLAG, '1')
  } catch {
    // Storage can be blocked; the page then simply needs the link again after a reload.
  }
}

/** True when the page was opened from a password reset link that Supabase refused (expired or used). */
export const recoveryLinkFailed = Boolean(linkParams.get('error_code') || linkParams.get('error'))

/**
 * Whether this tab was opened from a password reset link (and the password isn't saved yet).
 * @returns {boolean}
 */
export function cameFromRecoveryLink() {
  try {
    return sessionStorage.getItem(RECOVERY_FLAG) === '1'
  } catch {
    return linkParams.get('type') === 'recovery'
  }
}

/**
 * Forgets the reset link once the new password is saved.
 * @returns {void}
 */
export function clearRecoveryLink() {
  try {
    sessionStorage.removeItem(RECOVERY_FLAG)
  } catch {
    // Nothing stored.
  }
}

/**
 * Sessions are kept in the browser's local storage and refreshed automatically, so students stay
 * logged in until they log out (US-13 AC4). The implicit flow lets a password reset link work on
 * another device than the one that asked for it (milestone 2).
 */
export const supabase = isConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
    })
  : null
