/**
 * S10 Reset password, first step (US-10 AC1): the student enters their email and taps "Send link".
 * The answer is always "If this email has an account, we sent a link", whether or not the account
 * exists, so the page never tells anyone which emails are registered. Only a network failure shows a
 * different message, because then nothing was sent at all.
 */
import { useState } from 'react'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { BackLink } from '../components/BackLink.jsx'
import { FormField } from '../components/FormField.jsx'
import { requestPasswordReset } from '../lib/api.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'
import { validateResetEmail } from '../lib/validation.js'

/**
 * The Reset password screen.
 * @returns {import('react').JSX.Element}
 */
export default function ForgotPassword() {
  const headingRef = usePageSetup('Reset password')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /**
   * Checks the address, then asks Supabase Auth to send the link.
   * @param {import('react').FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setSent(false)
    const error = validateResetEmail(email)
    setEmailError(error)
    if (error) {
      document.getElementById('email')?.focus()
      return
    }
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (requestError) {
      if (requestError.code === 'network') setFormError(MESSAGES.network)
      else setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout variant="reset">
      <BackLink fallback="/login" />
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Reset password
      </h1>
      {!sent && <p className="page-intro">{MESSAGES.resetIntro}</p>}
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <FormField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@university.ch"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            setEmailError('')
          }}
          error={emailError}
        />
        <div className="form-status" role="status">
          {sent && <p className="notice">{MESSAGES.resetLinkSent}</p>}
        </div>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button className="button" type="submit" disabled={submitting}>
          Send link
        </button>
      </form>
    </AuthLayout>
  )
}
