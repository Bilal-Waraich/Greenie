/**
 * S2 Home (US-02, US-04, US-13 AC5, US-14 AC4, US-09): total points, current streak, points earned
 * today and the estimated CO2 saved, all computed by the database from the student's logs; a
 * prominent "Log an action" button; links to "My history", "My badges" and "Find students"; "Log out";
 * and "Delete my account", which asks for confirmation first (US-09 AC1).
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { deleteMyAccount, getMyBadges, getMyStatus, logOut } from '../lib/api.js'
import { earnedSummary } from '../lib/badges.js'
import { messageFor } from '../lib/errors.js'
import { formatCo2Saved, formatNumber, streakLabel } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * "Delete my account" with an inline confirmation (US-09 AC1). After deleting, the session on this
 * device ends and the login screen opens.
 * @returns {import('react').JSX.Element}
 */
function DeleteAccount() {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const questionRef = useRef(null)

  useEffect(() => {
    if (confirming) questionRef.current?.focus()
  }, [confirming])

  /**
   * Deletes the account and all its data, then opens the login screen.
   * @returns {Promise<void>}
   */
  async function handleDelete() {
    setDeleting(true)
    setError('')
    try {
      await deleteMyAccount()
      navigate('/login', { replace: true })
    } catch (deleteError) {
      setError(messageFor(deleteError.code))
      setDeleting(false)
    }
  }

  if (!confirming) {
    return (
      <button type="button" className="text-link danger-link" onClick={() => setConfirming(true)}>
        Delete my account
      </button>
    )
  }
  return (
    <section className="confirm-box" aria-labelledby="delete-question" aria-describedby="delete-explanation">
      <h2 id="delete-question" ref={questionRef} tabIndex={-1}>
        {MESSAGES.deleteQuestion}
      </h2>
      <p id="delete-explanation">{MESSAGES.deleteExplanation}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="button-row">
        <button type="button" className="button button--danger" onClick={handleDelete} disabled={deleting}>
          Delete my account
        </button>
        <button type="button" className="button button--secondary" onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </button>
      </div>
    </section>
  )
}

/**
 * The Home screen.
 * @returns {import('react').JSX.Element}
 */
export default function Home() {
  const headingRef = usePageSetup('Home')
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [badges, setBadges] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getMyStatus()
      .then((data) => active && setStatus(data))
      .catch(() => active && setLoadError(true))
    // The badge count is extra information: if it fails, the row simply has no count.
    getMyBadges()
      .then((rows) => active && setBadges(rows))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  /**
   * Logs out on this device and opens the login screen.
   * @returns {Promise<void>}
   */
  async function handleLogOut() {
    try {
      await logOut()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <AppLayout withNav>
      <div className="home-greeting">
        <h1 ref={headingRef} tabIndex={-1}>
          {status ? `Hi, ${status.nickname}` : 'Hi'}
        </h1>
        <button type="button" className="text-link" onClick={handleLogOut}>
          Log out
        </button>
      </div>
      <img className="scenery scenery--mobile pixelated" src={SPRITES.sceneryMobile} alt="" />
      <img className="scenery scenery--desktop pixelated" src={SPRITES.sceneryDesktop} alt="" />

      <section className="points-card" aria-label="Your points" aria-busy={!status && !loadError}>
        {loadError && (
          <p className="form-error" role="alert">
            {MESSAGES.loadFailed}
          </p>
        )}
        {status && (
          <>
            <p className="points-card__label" id="total-points-label">
              Total points
            </p>
            <p className="points-card__total" aria-describedby="total-points-label" data-testid="total-points">
              <img src={SPRITES.coin} alt="" className="pixelated" />
              {formatNumber(status.total_points)}
            </p>
            <div className="points-card__meta">
              <p className="streak" data-testid="streak">
                <img src={SPRITES.flame} alt="" className="pixelated" />
                {streakLabel(status.streak)}
              </p>
              <p className="badge" data-testid="today-points">
                Today: +{formatNumber(status.today_points)}
              </p>
            </div>
            <p className="co2-line" data-testid="co2-saved">
              <img src={SPRITES.leaf} alt="" className="pixelated" />
              {formatCo2Saved(status.co2_saved_g)}
            </p>
          </>
        )}
      </section>

      <Link className="button home-log-button" to="/log">
        Log an action
      </Link>

      <nav className="row-list home-links" aria-label="More">
        <Link className="row-link" to="/history">
          <span>
            <span className="row-link__title">My history</span>
            <span className="row-link__subtitle">Your last 20 logs</span>
          </span>
          <span className="row-link__chevron" aria-hidden="true">›</span>
        </Link>
        <Link className="row-link" to="/badges">
          <span>
            <span className="row-link__title">My badges</span>
            <span className="row-link__subtitle" data-testid="home-badges-summary">
              {badges ? earnedSummary(badges) : ' '}
            </span>
          </span>
          <span className="row-link__chevron" aria-hidden="true">›</span>
        </Link>
        <Link className="row-link" to="/students">
          <span>
            <span className="row-link__title">Find students</span>
            <span className="row-link__subtitle">Follow others to compare points</span>
          </span>
          <span className="row-link__chevron" aria-hidden="true">›</span>
        </Link>
      </nav>

      <div className="home-account">
        <DeleteAccount />
      </div>
    </AppLayout>
  )
}
