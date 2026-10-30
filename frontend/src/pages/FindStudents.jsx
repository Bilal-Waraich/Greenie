/**
 * S8 Find students (US-11 AC1, AC2): a search field that finds students by part of their nickname,
 * ignoring letter case, and lists up to 20 results with nickname and university. Each result opens the
 * student's profile (S9). "No student found" when nothing matches.
 *
 * The search runs as the student types (a quarter of a second after the last key). The search text is
 * kept in the address (?q=eco), so going back from a profile shows the same results.
 */
import { useEffect, useId, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { BackLink } from '../components/BackLink.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { searchStudents } from '../lib/api.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'
import { trimEdges } from '../lib/validation.js'

/** Milliseconds to wait after the last key before searching. */
const SEARCH_DELAY = 250

/**
 * The Find students screen.
 * @returns {import('react').JSX.Element}
 */
export default function FindStudents() {
  const headingRef = usePageSetup('Find students')
  const [searchParams, setSearchParams] = useSearchParams()
  const [text, setText] = useState(searchParams.get('q') ?? '')
  const [result, setResult] = useState({ query: null, rows: null, failed: false })
  const inputId = useId()
  const query = trimEdges(text)

  useEffect(() => {
    if (!query) return undefined
    let active = true
    const timer = setTimeout(() => {
      searchStudents(query)
        .then((rows) => active && setResult({ query, rows, failed: false }))
        .catch(() => active && setResult({ query, rows: null, failed: true }))
    }, SEARCH_DELAY)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  /**
   * Updates the search text and the address.
   * @param {import('react').ChangeEvent<HTMLInputElement>} event
   */
  function handleChange(event) {
    const value = event.target.value
    setText(value)
    setSearchParams(trimEdges(value) ? { q: value } : {}, { replace: true })
  }

  const current = result.query === query ? result : null
  let content
  if (!query) {
    content = <EmptyState icon={SPRITES.magnifier} text={MESSAGES.searchPrompt} />
  } else if (current?.failed) {
    content = (
      <p className="form-error page-message" role="alert">
        {MESSAGES.loadFailed}
      </p>
    )
  } else if (current?.rows.length === 0) {
    content = <EmptyState icon={SPRITES.magnifier} text={MESSAGES.noStudentFound} />
  } else if (current) {
    content = (
      <ul className="row-list card-list" data-testid="search-results">
        {current.rows.map((student) => (
          <li key={student.id}>
            <Link className="row-link" to={`/students/${student.id}`}>
              <span>
                <span className="row-link__title">{student.nickname}</span>
                <span className="row-link__subtitle">{student.university}</span>
              </span>
              <span className="row-link__chevron" aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <AppLayout>
      <BackLink fallback="/" />
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Find students
      </h1>
      <div className="field page-field" role="search">
        <label className="field__label" htmlFor={inputId}>
          Search
        </label>
        <input
          id={inputId}
          className="field__input"
          type="search"
          placeholder="Search by nickname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={text}
          onChange={handleChange}
        />
      </div>
      <p className="visually-hidden" role="status">
        {current && !current.failed && current.rows.length > 0 ? `${current.rows.length} found` : ''}
      </p>
      <div aria-busy={Boolean(query) && !current}>{content}</div>
    </AppLayout>
  )
}
