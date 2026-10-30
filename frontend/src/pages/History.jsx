/**
 * S7 My history (US-05): the student's last 20 logged actions, newest first, each with the action's
 * label, the points and the date and time in Zürich ("Today, 12:41"). Empty state: "Nothing logged yet."
 */
import { useEffect, useState } from 'react'
import { AppLayout } from '../components/AppLayout.jsx'
import { BackLink } from '../components/BackLink.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { getMyHistory } from '../lib/api.js'
import { formatLogTime, formatNumber } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The My history screen.
 * @returns {import('react').JSX.Element}
 */
export default function History() {
  const headingRef = usePageSetup('My history')
  const [entries, setEntries] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getMyHistory()
      .then((rows) => active && setEntries(rows))
      .catch(() => active && setLoadError(true))
    return () => {
      active = false
    }
  }, [])

  return (
    <AppLayout>
      <BackLink fallback="/" />
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.star} alt="" className="pixelated" />
        My history
      </h1>
      {loadError && (
        <p className="form-error page-message" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}
      {entries && entries.length === 0 && <EmptyState icon={SPRITES.box} text={MESSAGES.historyEmpty} />}
      {entries && entries.length > 0 && (
        <ol className="row-list card-list" data-testid="history-list">
          {entries.map((entry) => (
            <li key={entry.id} className="row-card row-card--with-value">
              <span>
                <span className="row-link__title">{entry.label}</span>
                <span className="row-link__subtitle">{formatLogTime(entry.logged_at_utc)}</span>
              </span>
              <span className="row-card__value">
                +{formatNumber(entry.points)}
                <span className="visually-hidden"> points</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </AppLayout>
  )
}
