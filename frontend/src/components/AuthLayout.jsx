/**
 * Frame for the login, registration and password reset screens. On wide screens (1024 px and up) a
 * dark green brand panel sits on the left, as in the desktop Figma frames; on smaller screens only the
 * form shows.
 */
import { SPRITES } from '../lib/sprites.js'

/**
 * @param {{ variant: 'login' | 'register' | 'reset', children: import('react').ReactNode }} props
 * @returns {import('react').JSX.Element}
 */
export function AuthLayout({ variant, children }) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <img className="auth__panel-logo pixelated" src={SPRITES.leafLight} alt="" />
        <p className="auth__panel-name">Greenie</p>
        <p className="auth__panel-pitch">Log eco-friendly actions, earn points and climb the leaderboard.</p>
        <img className="auth__panel-scenery pixelated" src={SPRITES.sceneryPanel} alt="" />
      </div>
      <main className={`auth__main auth__main--${variant}`}>{children}</main>
    </div>
  )
}
