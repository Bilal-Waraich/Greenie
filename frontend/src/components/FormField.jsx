/**
 * A labelled text input with its error message directly below it (US-01 AC4), linked for screen
 * readers with aria-invalid and aria-describedby.
 */

/**
 * @param {{ id: string, label: string, error?: string, area?: string } & import('react').InputHTMLAttributes<HTMLInputElement>} props
 *   - id: input id (also used for the error's id); area: grid area name on the registration form.
 * @returns {import('react').JSX.Element}
 */
export function FormField({ id, label, error, area, ...inputProps }) {
  const errorId = `${id}-error`
  return (
    <div className="field" data-area={area}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="field__input"
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}
