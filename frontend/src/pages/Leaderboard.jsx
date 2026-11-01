/**
 * S5 Leaderboard (US-06, US-12 AC4): two tabs, "Everyone" and "Following", ranking students by points
 * earned this week (Monday to Sunday, Zürich). The database does the ranking (get_leaderboard).
 *
 * - Everyone: the top 20 with points this week; the student's own row is highlighted, and shown below
 *   the list with its rank when they are outside it (AC4). Empty state when nobody has points yet.
 * - Following: the student and everyone they follow; "You are not following anyone yet" with a "Find
 *   students" button when they follow nobody (AC7).
 * Each row opens that student's profile (AC8). The chosen tab is kept in the address (?tab=following),
 * so a page refresh shows the same tab with fresh data (AC6, US-12 AC4).
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AppLayout } from '../components/AppLayout.jsx'
import { EmptyState } from '../components/EmptyState.jsx'
import { getLeaderboard } from '../lib/api.js'
import { formatNumber } from '../lib/format.js'
import { MESSAGES } from '../lib/messages.js'
import { SPRITES } from '../lib/sprites.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/** The two tabs, in order. */
const TABS = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'following', label: 'Following' },
]

/**
 * The colour of a rank box: gold, silver and bronze for the first three (Figma S5), then the
 * student's own row, then the rest.
 * @param {{ rank: number, is_me: boolean }} row
 * @returns {string} A modifier for the board-row__rank class.
 */
function rankStyle(row) {
  if (row.rank <= 3) return ['first', 'second', 'third'][row.rank - 1]
  return row.is_me ? 'me' : 'other'
}

/**
 * One leaderboard row, linking to the student's profile.
 * @param {{ row: { rank: number, user_id: string, nickname: string, week_points: number, is_me: boolean } }} props
 * @returns {import('react').JSX.Element}
 */
function BoardRow({ row }) {
  return (
    <li>
      <Link
        className={row.is_me ? 'board-row board-row--me' : 'board-row'}
        to={`/students/${row.user_id}`}
        data-testid="board-row"
        data-rank={row.rank}
        data-me={row.is_me || undefined}
      >
        <span className={`board-row__rank board-row__rank--${rankStyle(row)}`}>
          <span className="visually-hidden">Rank </span>
          {row.rank}
        </span>
        <span className="board-row__name">
          {row.nickname}
          {row.is_me && <span className="visually-hidden"> (you)</span>}
        </span>
        <span className="board-row__points">
          <img src={SPRITES.coin} alt="" className="pixelated" />
          {formatNumber(row.week_points)}
          <span className="visually-hidden"> points</span>
        </span>
      </Link>
    </li>
  )
}

/**
 * The Leaderboard screen.
 * @returns {import('react').JSX.Element}
 */
export default function Leaderboard() {
  const headingRef = usePageSetup('Leaderboard')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'following' ? 'following' : 'everyone'
  const [result, setResult] = useState({ tab: null, rows: null, failed: false })
  const tabRefs = useRef({})

  useEffect(() => {
    let active = true
    getLeaderboard(tab)
      .then((rows) => active && setResult({ tab, rows, failed: false }))
      .catch(() => active && setResult({ tab, rows: null, failed: true }))
    return () => {
      active = false
    }
  }, [tab])

  /**
   * Shows a tab and keeps it in the address.
   * @param {string} id
   */
  function selectTab(id) {
    setSearchParams(id === 'everyone' ? {} : { tab: id }, { replace: true })
  }

  /**
   * Arrow keys move between the tabs, as in the usual tab pattern.
   * @param {import('react').KeyboardEvent<HTMLButtonElement>} event
   */
  function handleTabKey(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const next = TABS.find((entry) => entry.id !== tab).id
    selectTab(next)
    tabRefs.current[next]?.focus()
  }

  const loaded = result.tab === tab ? result : { rows: null, failed: false }
  const listed = loaded.rows?.filter((row) => !row.is_pinned) ?? []
  const pinned = loaded.rows?.find((row) => row.is_pinned)
  // "· · ·" only when ranks are skipped between the list and the pinned row.
  const gap = pinned && listed.length > 0 && pinned.rank > listed[listed.length - 1].rank + 1

  let content = null
  if (loaded.failed) {
    content = (
      <p className="form-error" role="alert">
        {MESSAGES.loadFailed}
      </p>
    )
  } else if (loaded.rows && loaded.rows.length === 0 && tab === 'following') {
    content = (
      <EmptyState icon={SPRITES.tree} text={MESSAGES.notFollowingAnyone}>
        <Link className="button" to="/students">
          Find students
        </Link>
      </EmptyState>
    )
  } else if (loaded.rows) {
    content = (
      <>
        <p className="page-intro">{tab === 'everyone' ? MESSAGES.leaderboardEveryoneNote : MESSAGES.leaderboardFollowingNote}</p>
        {loaded.rows.length === 0 ? (
          <EmptyState icon={SPRITES.trophy} text={MESSAGES.leaderboardEmpty} />
        ) : (
          <>
            <ol className="board" aria-label={`${TABS.find((entry) => entry.id === tab).label}, this week`}>
              {listed.map((row) => (
                <BoardRow key={row.user_id} row={row} />
              ))}
            </ol>
            {pinned && (
              <>
                {gap && (
                  <p className="board-gap" aria-hidden="true">
                    · · ·
                  </p>
                )}
                <ol className="board board--pinned" aria-label="Your rank">
                  <BoardRow row={pinned} />
                </ol>
              </>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <AppLayout withNav>
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        <img src={SPRITES.trophy} alt="" className="pixelated" />
        Leaderboard
      </h1>
      <div className="tabs" role="tablist" aria-label="Leaderboards">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            ref={(element) => {
              tabRefs.current[entry.id] = element
            }}
            type="button"
            role="tab"
            id={`tab-${entry.id}`}
            className="tabs__tab"
            aria-selected={tab === entry.id}
            aria-controls="leaderboard-panel"
            tabIndex={tab === entry.id ? 0 : -1}
            onClick={() => selectTab(entry.id)}
            onKeyDown={handleTabKey}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div id="leaderboard-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} aria-busy={!loaded.rows && !loaded.failed}>
        {content}
      </div>
    </AppLayout>
  )
}
