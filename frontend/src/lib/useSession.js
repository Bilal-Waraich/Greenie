/**
 * The login state context and the hook pages and route guards use to read it.
 * The provider that fills it is in session.jsx.
 */
import { createContext, useContext } from 'react'

/** `{ session, loading }`; loading is true until the stored session has been read. */
export const SessionContext = createContext({ session: null, loading: true })

/**
 * Returns `{ session, loading }`.
 * @returns {{ session: import('@supabase/supabase-js').Session | null, loading: boolean }}
 */
export function useSession() {
  return useContext(SessionContext)
}
