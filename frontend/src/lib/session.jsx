/**
 * Login state for the whole app: provides the current Supabase session through SessionContext
 * (lib/useSession.js) and follows login, logout and token refreshes.
 *
 * `loading` stays true until the stored session has been read, so route guards don't redirect a
 * logged-in student to the login screen on a page reload.
 */
import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { SessionContext } from './useSession.js'

/**
 * Provides the session to its children.
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').JSX.Element}
 */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ session: null, loading: true })

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ session: data.session, loading: false })
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false })
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
