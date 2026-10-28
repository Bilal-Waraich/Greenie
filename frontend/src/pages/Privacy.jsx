/**
 * The Privacy page: Bean Co.'s full privacy notice (Part B of privacy_text.txt), word for word. Open to
 * everyone, logged in or not, because the registration form links to it. Email addresses in the text
 * become email links.
 */
import { Fragment } from 'react'
import { AppLayout } from '../components/AppLayout.jsx'
import { PRIVACY } from '../lib/privacy.js'
import { usePageSetup } from '../lib/usePageSetup.js'

/** An email address inside the text (the capture group keeps it in String.split's result). */
const EMAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/

/**
 * Text with each email address as an email link.
 * @param {{ text: string }} props
 * @returns {import('react').JSX.Element}
 */
function LinkedText({ text }) {
  return (
    <>
      {text.split(EMAIL).map((part, index) =>
        // split() puts the matched addresses at the odd positions.
        index % 2 === 1 ? (
          <a key={index} className="text-link" href={`mailto:${part}`}>
            {part}
          </a>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * One block of the notice after its title: a numbered heading, a paragraph or a list.
 * @param {{ block: import('../lib/privacyText.js').NoticeBlock }} props
 * @returns {import('react').JSX.Element}
 */
function NoticeBlock({ block }) {
  if (block.type === 'heading') return <h2>{block.text}</h2>
  if (block.type === 'list') {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>
            <LinkedText text={item} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p>
      <LinkedText text={block.text} />
    </p>
  )
}

/**
 * The Privacy page.
 * @returns {import('react').JSX.Element}
 */
export default function Privacy() {
  const headingRef = usePageSetup('Privacy')
  const [title, ...blocks] = PRIVACY.notice
  return (
    <AppLayout>
      <article className="privacy">
        <h1 className="page-title privacy__title" ref={headingRef} tabIndex={-1}>
          {title.text}
        </h1>
        {blocks.map((block, index) => (
          <NoticeBlock key={index} block={block} />
        ))}
      </article>
    </AppLayout>
  )
}
