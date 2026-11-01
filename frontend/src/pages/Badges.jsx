/**
 * S11 My badges (US-15 AC3): every badge from badges.json with its name and rule. Earned badges are in
 * colour; the others are greyed out and marked "Locked". The line under the title counts them
 * ("0 of 6 earned"). Which badges are earned is computed by the database from the student's logs.
 */
import { useEffect, useState } from 'react'
import { AppLayout } from '../components/AppLayout.jsx'
import { BackLink } from '../components/BackLink.jsx'
import { getMyBadges } from '../lib/api.js'
import { badgeRuleText, earnedSummary } from '../lib/badges.js'
import { MESSAGES } from '../lib/messages.js'
import { badgeSprite, SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The My badges screen.
 * @returns {import('react').JSX.Element}
 */
export default function Badges() {
  const headingRef = usePageSetup('My badges')
  const [badges, setBadges] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getMyBadges()
      .then((rows) => active && setBadges(rows))
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [])

  return (
    <AppLayout>
      <BackLink fallback="/" />
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.trophy} alt="" className="pixelated" />
        My badges
      </h1>
      {loadError && (
        <p className="form-error page-message" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}
      {badges && (
        <>
          <p className="page-intro" data-testid="badges-summary">
            {earnedSummary(badges)}
          </p>
          <ul className="badge-grid">
            {badges.map((badge) => (
              <li
                key={badge.key}
                className={badge.earned ? 'badge-tile badge-tile--earned' : 'badge-tile'}
                data-testid="badge-tile"
                data-earned={badge.earned}
              >
                <span className="badge-icon badge-icon--large">
                  <img src={badgeSprite(badge)} alt="" className="pixelated" />
                </span>
                <span className="badge-tile__name">{badge.label}</span>
                <span className="badge-tile__rule">
                  {badge.earned ? badgeRuleText(badge) : `${MESSAGES.locked} · ${badgeRuleText(badge)}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppLayout>
  )
}
