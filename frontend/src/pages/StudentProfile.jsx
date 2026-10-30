/**
 * S9 Student profile (US-11 AC3, AC4; US-12 AC1; US-15 AC5): nickname, university, total points, points
 * this week, current streak and earned badges, with a "Follow" or "Unfollow" button. Nothing else about
 * the student is ever loaded (no email, names or date of birth). The follow state comes from the
 * database, so it is still correct after a page refresh. The student's own profile has no button.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { BackLink } from '../components/BackLink.jsx'
import { getStudentProfile, setFollowing } from '../lib/api.js'
import { messageFor } from '../lib/errors.js'
import { daysLabel, formatNumber } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { badgeSprite } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The Student profile screen.
 * @returns {import('react').JSX.Element}
 */
export default function StudentProfile() {
  const { id } = useParams()
  const [state, setState] = useState({ id: null, profile: null, error: null })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const loaded = state.id === id ? state : { profile: null, error: null }
  // The title changes once the profile arrives, which also moves focus to the heading then.
  const headingRef = usePageSetup(
    loaded.profile ? loaded.profile.nickname : loaded.error === 'not_found' ? 'Student not found' : 'Student profile',
  )

  useEffect(() => {
    let active = true
    getStudentProfile(id)
      .then((profile) => active && setState({ id, profile, error: null }))
      .catch((error) => active && setState({ id, profile: null, error: error.code }))
    return () => {
      active = false
    }
  }, [id])

  /**
   * Follows or unfollows the student, then shows the stored state.
   * @returns {Promise<void>}
   */
  async function handleToggle() {
    if (busy) return
    setBusy(true)
    setActionError('')
    try {
      const isFollowing = await setFollowing(id, !loaded.profile.is_following)
      setState((current) => ({ ...current, profile: { ...current.profile, is_following: isFollowing } }))
    } catch (error) {
      setActionError(messageFor(error.code))
    } finally {
      setBusy(false)
    }
  }

  const profile = loaded.profile

  return (
    <AppLayout>
      <BackLink fallback="/students" />
      {loaded.error === 'not_found' && (
        <>
          <h1 className="page-title" ref={headingRef} tabIndex={-1}>
            Student not found
          </h1>
          <p className="simple-page__text">{MESSAGES.studentNotFound}</p>
        </>
      )}
      {loaded.error && loaded.error !== 'not_found' && (
        <p className="form-error page-message" role="alert">
          {MESSAGES.loadFailed}
        </p>
      )}
      {profile && (
        <>
          <section className="profile-card" aria-labelledby="profile-name">
            <h1 id="profile-name" className="profile-card__name" ref={headingRef} tabIndex={-1}>
              {profile.nickname}
            </h1>
            <p className="profile-card__university">{profile.university}</p>
            <dl className="profile-card__stats">
              <div>
                <dt>Total points</dt>
                <dd data-testid="profile-total">{formatNumber(profile.total_points)}</dd>
              </div>
              <div>
                <dt>Points this week</dt>
                <dd data-testid="profile-week">{formatNumber(profile.week_points)}</dd>
              </div>
              <div>
                <dt>Current streak</dt>
                <dd data-testid="profile-streak">{daysLabel(profile.streak)}</dd>
              </div>
            </dl>
            <h2 className="profile-card__badges-title">Badges</h2>
            {profile.badges.length === 0 ? (
              <p className="profile-card__no-badges">{MESSAGES.noBadgesYet}</p>
            ) : (
              <ul className="profile-card__badges">
                {profile.badges.map((badge) => (
                  <li key={badge.key} className="badge-icon" title={badge.label}>
                    <img src={badgeSprite(badge)} alt={badge.label} className="pixelated" />
                  </li>
                ))}
              </ul>
            )}
          </section>
          {profile.is_me ? (
            <p className="simple-page__text">{MESSAGES.ownProfile}</p>
          ) : (
            <button
              type="button"
              className={profile.is_following ? 'button button--secondary profile-button' : 'button profile-button'}
              onClick={handleToggle}
              disabled={busy}
            >
              {profile.is_following ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {actionError && (
            <p className="form-error page-message" role="alert">
              {actionError}
            </p>
          )}
        </>
      )}
    </AppLayout>
  )
}
