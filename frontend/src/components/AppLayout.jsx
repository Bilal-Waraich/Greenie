/**
 * Frame for logged-in pages: the desktop header (with navigation on the four main pages), the page
 * column, and the mobile tab bar (Home, Log, Leaderboard, Guide; brief section 11).
 */
import { Link, NavLink } from 'react-router'
import { SPRITES } from '../lib/sprites.js'

/** The four main pages, in tab bar order. */
const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/log', label: 'Log', icon: 'log', end: false },
  { to: '/leaderboard', label: 'Leaderboard', icon: 'leaderboard', end: false },
  { to: '/guide', label: 'Guide', icon: 'guide', end: false },
]

/**
 * Desktop header: logo and name, plus navigation when withNav is set.
 * @param {{ withNav: boolean }} props
 * @returns {import('react').JSX.Element}
 */
function SiteHeader({ withNav }) {
  return (
    <header className="site-header">
      <Link className="brand" to="/">
        <img src={SPRITES.leaf} alt="" className="pixelated" />
        Greenie
      </Link>
      {withNav && (
        <nav className="site-nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}

/**
 * Mobile tab bar with pixel icons.
 * @returns {import('react').JSX.Element}
 */
function TabBar() {
  return (
    <nav className="tab-bar" aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end}>
          {({ isActive }) => (
            <>
              <img src={SPRITES.tabs[item.icon][isActive ? 'active' : 'idle']} alt="" className="pixelated" />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * Wraps a logged-in page.
 * @param {{ withNav?: boolean, children: import('react').ReactNode }} props - withNav shows the desktop
 *   navigation and the mobile tab bar (the Home, Log, Leaderboard and Guide pages).
 * @returns {import('react').JSX.Element}
 */
export function AppLayout({ withNav = false, children }) {
  return (
    <>
      <SiteHeader withNav={withNav} />
      <main className={withNav ? 'page page--with-tabs' : 'page'}>{children}</main>
      {withNav && <TabBar />}
    </>
  )
}
