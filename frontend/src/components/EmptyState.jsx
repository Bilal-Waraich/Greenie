/**
 * A centred pixel icon with a short message, for empty lists and "nothing found" states
 * (Figma S5, S6, S7, S8). Extra content, such as a button, goes below the message.
 */

/**
 * @param {{ icon: string, text: string, children?: import('react').ReactNode }} props
 *   - icon: sprite URL (decorative); text: the message.
 * @returns {import('react').JSX.Element}
 */
export function EmptyState({ icon, text, children }) {
  return (
    <div className="empty-state">
      <img src={icon} alt="" className="pixelated" />
      <p className="empty-state__text">{text}</p>
      {children}
    </div>
  )
}
