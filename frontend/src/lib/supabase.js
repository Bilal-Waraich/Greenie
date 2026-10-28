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
