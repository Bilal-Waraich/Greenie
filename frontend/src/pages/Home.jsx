/**
 * S2 Home (US-02, US-04, US-13 AC5): total points, current streak and points earned today, all
 * computed by the database from the student's logs; a prominent "Log an action" button; links to
 * "My history" and "Find students" (milestone 2 pages) and "Log out".
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { getMyStatus, logOut } from '../lib/api.js'
import { formatNumber, streakLabel } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The Home screen.
 * @returns {import('react').JSX.Element}
 */
export default function Home() {
  const headingRef = usePageSetup('Home')
  const navigate = useNavigate()
  const [status, setStatus] = useState(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true
    getMyStatus()
      .then((data) => active && setStatus(data))
      .catch(() => active && setLoadError(true))
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
        <Link className="row-link" to="/students">
          <span>
            <span className="row-link__title">Find students</span>
            <span className="row-link__subtitle">Follow others to compare points</span>
          </span>
          <span className="row-link__chevron" aria-hidden="true">›</span>
        </Link>
      </nav>
    </AppLayout>
  )
}
