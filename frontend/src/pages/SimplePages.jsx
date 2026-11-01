/**
 * Simple pages: "Page not found" for logged-in students who open an address that doesn't exist.
 */
import { Link } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * Shown to logged-in students for an address that doesn't exist. (Visitors are sent to Log in.)
 * @returns {import('react').JSX.Element}
 */
export function NotFound() {
  const headingRef = usePageSetup('Page not found')
  return (
    <AppLayout withNav>
      <div className="simple-page">
        <h1 className="page-title" ref={headingRef} tabIndex={-1}>
          Page not found
        </h1>
        <p className="simple-page__text">This page doesn’t exist.</p>
        <Link className="button" to="/">
          Back to Home
        </Link>
      </div>
    </AppLayout>
  )
}
