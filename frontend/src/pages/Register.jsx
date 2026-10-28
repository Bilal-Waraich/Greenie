/**
 * S1 Register (US-01): seven required fields, the privacy text with a consent checkbox, and "Create
 * account", which stays disabled until the box is ticked. Every error appears next to its field.
 * The database checks everything again and creates no account if anything is invalid. After success
 * the student is logged in and the route guard opens Home with 0 points and streak 0.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import { AuthLayout } from '../components/AuthLayout.jsx'
import { FormField } from '../components/FormField.jsx'
import { isNicknameAvailable, signUp } from '../lib/api.js'
import { messageFor } from '../lib/errors.js'
import { zurichToday } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'
import { validateRegistration } from '../lib/validation.js'

/** Field order: the order of the inputs on the page and of keyboard focus. */
const FIELD_ORDER = ['email', 'password', 'nickname', 'firstName', 'lastName', 'birthDate', 'university']

/**
 * The privacy text shown with the consent checkbox (US-01 AC5), word for word from the Figma
 * registration frame. If Bean Co. supplies a different privacy text, replace it here.
 */
const PRIVACY_TEXT = 'I agree to the privacy notice: my name and date of birth stay private; others see only my nickname and university.'

/**
 * Field errors for the codes the sign-up can return.
 * @param {string} code - From lib/errors.js.
 * @returns {Record<string, string> | null} Errors by field, or null if the code isn't about one field.
 */
function fieldErrorsFor(code) {
  switch (code) {
    case 'email_taken':
      return { email: MESSAGES.emailTaken }
    case 'email_address_invalid':
    case 'validation_failed':
      return { email: MESSAGES.emailInvalid }
    case 'weak_password':
      return { password: MESSAGES.passwordTooShort }
    case 'nickname_taken':
      return { nickname: MESSAGES.nicknameTaken }
    case 'invalid_input: nickname':
      return { nickname: MESSAGES.nicknameInvalid }
    case 'invalid_input: first_name':
      return { firstName: MESSAGES.nameInvalid }
    case 'invalid_input: last_name':
      return { lastName: MESSAGES.nameInvalid }
    case 'invalid_input: date_of_birth':
      return { birthDate: MESSAGES.birthDateInvalid }
    case 'too_young':
      return { birthDate: MESSAGES.tooYoung }
    case 'invalid_input: university':
      return { university: MESSAGES.universityInvalid }
    default:
      return null
  }
}

/**
 * The registration screen.
 * @returns {import('react').JSX.Element}
 */
export default function Register() {
  const headingRef = usePageSetup('Create account')
  const [values, setValues] = useState({
    email: '', password: '', nickname: '', firstName: '', lastName: '', birthDate: '', university: '',
  })
  const [errors, setErrors] = useState({})
  const [consent, setConsent] = useState(false)
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
   * Shows field errors and moves focus to the first invalid field.
   * @param {Record<string, string>} found
   */
  function showErrors(found) {
    setErrors(found)
    const firstInvalid = FIELD_ORDER.find((name) => found[name])
    if (firstInvalid) document.getElementById(firstInvalid)?.focus()
  }

  /**
   * Validates, checks the nickname, then creates the account.
   * @param {import('react').FormEvent<HTMLFormElement>} event
   */
  async function handleSubmit(event) {
    event.preventDefault()
    if (!consent || submitting) return
    setFormError('')
    const found = validateRegistration(values, zurichToday())
    if (Object.keys(found).length > 0) {
      showErrors(found)
      return
    }

    setSubmitting(true)
    try {
      if (!(await isNicknameAvailable(values.nickname))) {
        showErrors({ nickname: MESSAGES.nicknameTaken })
        setSubmitting(false)
        return
      }
      const { hasSession } = await signUp(values)
      if (!hasSession) {
        setFormError(MESSAGES.signedUpWithoutSession)
        setSubmitting(false)
      }
      // With a session, the route guard moves to Home.
    } catch (error) {
      const forField = fieldErrorsFor(error.code)
      if (forField) {
        showErrors(forField)
      } else if (error.code === 'unknown' && !(await isNicknameAvailable(values.nickname).catch(() => true))) {
        // The database refused the sign-up without a readable reason: most likely the nickname was
        // taken in the meantime.
        showErrors({ nickname: MESSAGES.nicknameTaken })
      } else {
        setFormError(messageFor(error.code))
      }
      setSubmitting(false)
    }
  }

  /**
   * Props shared by every field.
   * @param {string} name
   * @returns {object}
   */
  function fieldProps(name) {
    return { id: name, area: name, value: values[name], onChange: handleChange, error: errors[name] }
  }

  return (
    <AuthLayout variant="register">
      <p className="auth-brand auth-brand--small auth-mobile-only">
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Greenie
      </p>
      <h1 className="auth-title" ref={headingRef} tabIndex={-1}>
        Create your account
      </h1>
      <p className="auth-pitch auth-pitch--small auth-mobile-only">Log actions, earn points, climb the leaderboard.</p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="register-grid">
          <FormField {...fieldProps('email')} label="Email" type="email" inputMode="email" autoComplete="email"
            autoCapitalize="none" spellCheck={false} placeholder="you@university.ch" />
          <FormField {...fieldProps('password')} label="Password" type="password" autoComplete="new-password"
            placeholder="At least 8 characters" />
          <FormField {...fieldProps('nickname')} label="Nickname" autoComplete="username" autoCapitalize="none"
            spellCheck={false} placeholder="3–20 characters, letters, digits, _" />
          <FormField {...fieldProps('firstName')} label="First name" autoComplete="given-name" placeholder="Alex" />
          <FormField {...fieldProps('lastName')} label="Last name" autoComplete="family-name" placeholder="Meier" />
          <FormField {...fieldProps('birthDate')} label="Date of birth" autoComplete="bday" placeholder="DD.MM.YYYY" />
          <FormField {...fieldProps('university')} label="University" autoComplete="organization" placeholder="e.g. ETH Zurich" />
        </div>

        <label className="consent">
          <input
            className="consent__box"
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>{PRIVACY_TEXT}</span>
        </label>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <button className="button" type="submit" disabled={!consent || submitting}>
          Create account
        </button>
      </form>

      <div className="auth-links">
        <p>
          Already registered?
          <Link to="/login" className="text-link">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
