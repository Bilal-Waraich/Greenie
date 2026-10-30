/**
 * S10 Set a new password (US-10 AC2, AC3): opened from the link in the reset email. Supabase Auth reads
 * the link and starts a password recovery session; the student types a new password of at least 8
 * characters and saves it. The old password stops working at once. The page then logs out on this
 * device and offers "Log in", so the student logs in with the new password.
 *
 * The form only shows when this tab was opened from a reset link (lib/supabase.js), never for a normal
 * login, so nobody can change a password just by opening this address on a logged-in device. An expired
 * or used link shows a message and a way to ask for a new one (the link's lifetime is Supabase's default).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { FormField } from '../components/FormField.jsx'
import { saveNewPassword } from '../lib/api.js'
import { messageFor } from '../lib/errors.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { cameFromRecoveryLink, clearRecoveryLink, recoveryLinkFailed } from '../lib/supabase.js'
import { usePageSetup } from '../lib/usePageSetup.js'
import { useSession } from '../lib/useSession.js'
import { validateNewPassword } from '../lib/validation.js'

/**
 * The message for a failed save.
 * @param {string} code - AppError code.
 * @returns {string}
 */
function saveErrorMessage(code) {
  if (code === 'weak_password') return MESSAGES.passwordTooShort
  if (code === 'same_password') return MESSAGES.samePassword
  if (code === 'session_not_found' || code === 'not_authenticated' || code === 'bad_jwt') return MESSAGES.resetLinkInvalid
  return messageFor(code)
}

/**
 * The Set a new password screen.
 * @returns {import('react').JSX.Element}
 */
export default function ResetPassword() {
  const headingRef = usePageSetup('Set a new password')
  const { session, loading } = useSession()
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const linkUsable = !recoveryLinkFailed && cameFromRecoveryLink()

  /**
   * Checks the length, then saves the new password.
   * @param {import('react').FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const error = validateNewPassword(password)
    setPasswordError(error)
    if (error) {
      document.getElementById('new-password')?.focus()
      return
    }
    setSubmitting(true)
    try {
      await saveNewPassword(password)
      clearRecoveryLink()
      setSaved(true)
    } catch (saveError) {
      const message = saveErrorMessage(saveError.code)
      if (message === MESSAGES.passwordTooShort || message === MESSAGES.samePassword) setPasswordError(message)
      else setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  let content
  if (saved) {
    content = (
      <>
        <p className="notice" role="status">
          {MESSAGES.passwordSaved}
        </p>
        <Link className="button notice-button" to="/login">
          Log in
        </Link>
      </>
    )
  } else if (!linkUsable || (!loading && !session)) {
    content = (
      <>
        <p className="form-error page-message" role="alert">
          {MESSAGES.resetLinkInvalid}
        </p>
        <Link className="button notice-button" to="/forgot-password">
          Reset password
        </Link>
      </>
    )
  } else if (session) {
    content = (
      <>
        <p className="page-intro">{MESSAGES.newPasswordIntro}</p>
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <FormField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setPasswordError('')
            }}
            error={passwordError}
          />
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <button className="button" type="submit" disabled={submitting}>
            Save password
          </button>
        </form>
      </>
    )
  }

  return (
    <AuthLayout variant="reset">
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Set a new password
      </h1>
      {content}
    </AuthLayout>
  )
}
