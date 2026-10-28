/**
 * Common set-up for every page: the browser tab title, scrolling to the top, and moving keyboard and
 * screen-reader focus to the page heading after navigation.
 */
import { useEffect, useRef } from 'react'

/**
 * Sets the document title and focuses the returned heading ref on mount.
 * @param {string} title - Page name shown before "· Greenie" in the browser tab.
 * @returns {import('react').RefObject<HTMLHeadingElement>} Attach to the page's h1 (with tabIndex={-1}).
 */
export function usePageSetup(title) {
  const headingRef = useRef(null)
  useEffect(() => {
    document.title = `${title} · Greenie`
    window.scrollTo(0, 0)
    headingRef.current?.focus({ preventScroll: true })
  }, [title])
  return headingRef
}
