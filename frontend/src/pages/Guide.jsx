/**
 * S6 Guide, "Which bin in Zürich?" (US-07): every entry of Bean Co.'s guide.json (item, where, note),
 * and a text filter that narrows the list as the student types (AC2). The content comes only from the
 * file, so changing guide.json and deploying changes the page without code changes (AC3).
 */
import { useId, useState } from 'react'
import { AppLayout } from '../components/AppLayout.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { filterGuide, guideDetails } from '../lib/guide.js'
import { GUIDE_ENTRIES } from '../lib/guideEntries.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/**
 * The Guide screen.
 * @returns {import('react').JSX.Element}
 */
export default function Guide() {
  const headingRef = usePageSetup('Which bin in Zürich?')
  const [filterText, setFilterText] = useState('')
  const inputId = useId()
  const shown = filterGuide(GUIDE_ENTRIES, filterText)

  return (
    <AppLayout withNav>
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.book} alt="" className="pixelated" />
        Which bin in Zürich?
      </h1>
      <div className="field page-field">
        <label className="field__label" htmlFor={inputId}>
          Filter
        </label>
        <input
          id={inputId}
          className="field__input"
          type="search"
          placeholder="Type to filter…"
          autoComplete="off"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
        />
      </div>
      <p className="visually-hidden" role="status">
        {shown.length} of {GUIDE_ENTRIES.length} entries
      </p>
      {shown.length === 0 ? (
        <EmptyState icon={SPRITES.magnifier} text={MESSAGES.guideNoResults} />
      ) : (
        <ul className="row-list card-list" data-testid="guide-list">
          {shown.map((entry) => (
            <li key={`${entry.item}|${entry.where}|${entry.note}`} className="row-card">
              <span className="row-link__title">{entry.item}</span>
              <span className="row-link__subtitle">{guideDetails(entry)}</span>
            </li>
          ))}
        </ul>
      )}
    </AppLayout>
  )
}
