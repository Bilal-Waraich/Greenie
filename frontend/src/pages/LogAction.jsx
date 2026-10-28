/**
 * S3 Log action (US-03, US-14 AC2): every active action from actions.json with its label, points,
 * daily limit and CO2 estimate. One tap logs the action once: the buttons are disabled while the
 * request runs, so a double tap can't log twice. The database adds the points and enforces the daily
 * limit; beyond it the screen shows "Daily limit reached for this action" and nothing is added.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { getLogActions, logAction } from '../lib/api.js'
import { messageFor } from '../lib/errors.js'
import { actionDetails, formatNumber } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { actionSprite, SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The Log action screen.
 * @returns {import('react').JSX.Element}
 */
export default function LogAction() {
  const headingRef = usePageSetup('Log an action')
  const navigate = useNavigate()
  const [actions, setActions] = useState(null)
  const [pendingKey, setPendingKey] = useState(null)
  const [notice, setNotice] = useState(null)
  const busy = useRef(false)
  const statusRef = useRef(null)

  /**
   * Reloads the action list with today's use (after a refused log).
   * @returns {Promise<void>}
   */
  const reloadActions = useCallback(async () => {
    try {
      setActions(await getLogActions())
    } catch {
      setNotice({ kind: 'error', text: MESSAGES.loadFailed })
    }
  }, [])

  useEffect(() => {
    let active = true
    getLogActions()
      .then((list) => active && setActions(list))
      .catch(() => active && setNotice({ kind: 'error', text: MESSAGES.loadFailed }))
    return () => {
      active = false
    }
  }, [])

  /**
   * Logs one action and opens the success screen, or shows why it wasn't logged.
   * @param {{ key: string, label: string }} action
   * @returns {Promise<void>}
   */
  async function handleTap(action) {
    if (busy.current) return
    busy.current = true
    setPendingKey(action.key)
    setNotice(null)
    try {
      const result = await logAction(action.key)
      navigate('/log/success', { state: { result, label: action.label } })
    } catch (error) {
      const text = error.code === 'daily_limit_reached' ? MESSAGES.dailyLimitReached : messageFor(error.code)
      setNotice({ kind: error.code === 'daily_limit_reached' ? 'limit' : 'error', text })
      statusRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      if (error.code === 'daily_limit_reached' || error.code === 'unknown_action') await reloadActions()
    } finally {
      busy.current = false
      setPendingKey(null)
    }
  }

  return (
    <AppLayout withNav>
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.plus} alt="" className="pixelated" />
        Log an action
      </h1>

      <div className="log-status" ref={statusRef} aria-live="assertive">
        {notice ? (
          <p className="alert" role="alert">
            {notice.text}
          </p>
        ) : (
          <p className="page-intro">Tap an action to log it once.</p>
        )}
      </div>

      {actions && (
        <ul className="action-list">
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                className="action"
                onClick={() => handleTap(action)}
                disabled={pendingKey !== null}
                aria-busy={pendingKey === action.key}
                data-action-key={action.key}
              >
                <span className="action__icon">
                  <img src={actionSprite(action.key)} alt="" className="pixelated" />
                </span>
                <span className="action__card">
                  <span>
                    <span className="action__label">{action.label}</span>
                    <span className="action__details">{actionDetails(action)}</span>
                  </span>
                  <span className="action__points">+{formatNumber(action.points)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  )
}
