/**
 * Simple pages: placeholders for the milestone 2 screens that milestone 1 already links to
 * (Leaderboard, Guide, My history, Find students, Reset password; decision D4), and "Page not found".
 */
import { Link } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * Title, icon and navigation for each placeholder, following the Figma frames: Leaderboard and Guide
 * have the tab bar; the others have a "‹ Back" link instead.
 */
const PLACEHOLDERS = {
  leaderboard: { title: 'Leaderboard', icon: SPRITES.tabs.leaderboard.active, withNav: true },
  guide: { title: 'Which bin in Zürich?', icon: SPRITES.tabs.guide.active, withNav: true },
  history: { title: 'My history', icon: null, withNav: false, back: '/' },
  students: { title: 'Find students', icon: SPRITES.leaf, withNav: false, back: '/' },
  resetPassword: { title: 'Reset password', icon: SPRITES.leaf, withNav: false, back: '/login' },
}

/**
 * A "Coming in Milestone 2." page.
 * @param {{ kind: keyof typeof PLACEHOLDERS }} props
 * @returns {import('react').JSX.Element}
 */
export function Placeholder({ kind }) {
  const page = PLACEHOLDERS[kind]
  const headingRef = usePageSetup(page.title)
  return (
    <AppLayout withNav={page.withNav}>
      <div className="simple-page">
        {page.back && (
          <Link className="text-link back-link" to={page.back}>
            ‹ Back
          </Link>
        )}
        <h1 className="page-title" ref={headingRef} tabIndex={-1}>
          {page.icon && <img src={page.icon} alt="" className="pixelated" />}
          {page.title}
        </h1>
        <p className="simple-page__text">{MESSAGES.comingSoon}</p>
      </div>
    </AppLayout>
  )
}

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
