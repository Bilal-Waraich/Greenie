/**
 * S0 Log in (US-13 AC1, AC2, AC7): email, masked password, "Log in", links to registration and
 * "Forgot password?". Wrong credentials show one message, "Email or password is incorrect", without
 * saying which part was wrong. On success the session changes and the route guard opens Home.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { FormField } from '../components/FormField.jsx'
import { logIn } from '../lib/api.js'
import { messageFor } from '../lib/errors.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'
import { validateLogin } from '../lib/validation.js'

/**
 * The login screen.
 * @returns {import('react').JSX.Element}
 */
export default function Login() {
  usePageSetup('Log in')
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /**
   * Updates one field and clears its error.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event
   */
  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  /**
   * Validates, then logs in; maps Supabase errors to the brief's wording.
   * @param {import('react').FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const found = validateLogin(values)
    setErrors(found)
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
    }
    setSubmitting(true)
    try {
      await logIn(values.email, values.password)
    } catch (error) {
      if (error.code === 'invalid_credentials') {
        setErrors({ password: MESSAGES.loginFailed })
        document.getElementById('password')?.focus()
      } else {
        setFormError(messageFor(error.code))
      }
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout variant="login">
      <div className="auth-mobile-only">
        <h1 className="auth-brand">
          <img src={SPRITES.leaf} alt="" className="pixelated" />
          Greenie
        </h1>
        <p className="auth-pitch">Log eco-friendly actions, earn points and climb the leaderboard.</p>
      </div>
      <h2 className="auth-title auth-title--desktop">
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Log in
      </h2>

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
          value={values.email}
          onChange={handleChange}
          error={errors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
        />
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button className="button" type="submit" disabled={submitting}>
          Log in
        </button>
      </form>

      <div className="auth-links">
        <Link to="/forgot-password" className="text-link">
          Forgot password?
        </Link>
        <p>
          New here?
          <Link to="/register" className="text-link">
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
