/**
 * The "‹ Back" link at the top of the secondary screens (Figma S7 to S11). It goes back one step in
 * the browser history when the student came from another page of the app (for example from the
 * leaderboard to a profile), otherwise to the given page.
 */
import { Link, useNavigate } from 'react-router'

/**
 * @param {{ fallback: string }} props - Where to go when there is no earlier page of the app.
 * @returns {import('react').JSX.Element}
 */
export function BackLink({ fallback }) {
  const navigate = useNavigate()

  /**
   * Goes back in the history if the previous entry belongs to the app.
   * @param {import('react').MouseEvent<HTMLAnchorElement>} event
   */
  function handleClick(event) {
    // React Router numbers the app's own history entries; 0 is the first page opened in this tab.
    if (window.history.state?.idx > 0) {
      event.preventDefault()
      navigate(-1)
    }
  }

  return (
    <Link className="text-link back-link" to={fallback} onClick={handleClick}>
      ‹ Back
    </Link>
  )
}
