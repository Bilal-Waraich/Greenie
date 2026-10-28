/**
 * S4 Success (US-03 AC3, US-04): "+N points", the new total and the streak, with "Streak increased!"
 * when this log raised it, and the buttons "Back to Home" and "Log another".
 *
 * The result comes from the Log screen as navigation state. It is cleared from the browser history at
 * once, so a reload or a direct visit goes back to the Log screen instead of showing an old result.
 */
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { formatNumber, streakDaysLabel } from '../lib/format.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/** Decorative squares around the check mark, placed as in the mobile Figma frame (390 px wide). */
const CONFETTI = [
  { x: 20, y: 40, size: 12, color: 'var(--color-sage)' },
  { x: 60, y: 12, size: 8, color: 'var(--color-green)' },
  { x: 300, y: 30, size: 12, color: 'var(--color-gold)' },
  { x: 330, y: 70, size: 8, color: 'var(--color-orange)' },
  { x: 40, y: 120, size: 12, color: 'var(--color-forest)' },
  { x: 310, y: 140, size: 8, color: 'var(--color-sage)' },
  { x: 90, y: 180, size: 12, color: 'var(--color-green)' },
  { x: 270, y: 200, size: 8, color: 'var(--color-gold)' },
  { x: 18, y: 250, size: 12, color: 'var(--color-orange)' },
  { x: 340, y: 260, size: 8, color: 'var(--color-forest)' },
  { x: 150, y: 20, size: 12, color: 'var(--color-sage)' },
  { x: 230, y: 50, size: 8, color: 'var(--color-green)' },
]

/**
 * The success screen.
 * @returns {import('react').JSX.Element}
 */
export default function Success() {
  const headingRef = usePageSetup('Action logged')
  const location = useLocation()
  const navigate = useNavigate()
  const [outcome] = useState(location.state?.result ?? null)

  useEffect(() => {
    if (outcome && location.state) navigate(location.pathname, { replace: true, state: null })
  }, [outcome, location.state, location.pathname, navigate])

  if (!outcome) return <Navigate to="/log" replace />

  return (
    <AppLayout>
      <div className="success">
        <div className="confetti" aria-hidden="true">
          {CONFETTI.map((square) => (
            <span
              key={`${square.x}-${square.y}`}
              style={{
                left: `${(square.x / 390) * 100}%`,
                top: `${square.y}px`,
                width: `${square.size}px`,
                height: `${square.size}px`,
                background: square.color,
              }}
            />
          ))}
        </div>
        <div className="success__check">
          <img src={SPRITES.check} alt="" className="pixelated" />
        </div>
        <h1 ref={headingRef} tabIndex={-1}>+{formatNumber(outcome.points_added)} points</h1>
        <p className="success__total">New total: {formatNumber(outcome.total_points)}</p>
        <div className="success__streak">
          <p className="streak">
            <img src={SPRITES.flame} alt="" className="pixelated" />
            {streakDaysLabel(outcome.streak)}
          </p>
          {outcome.streak_increased && <p className="badge">Streak increased!</p>}
        </div>
        <div className="button-stack">
          <Link className="button" to="/">
            Back to Home
          </Link>
          <Link className="button button--secondary" to="/log">
            Log another
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
