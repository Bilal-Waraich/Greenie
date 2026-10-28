/**
 * Bean Co.'s privacy text, read from privacy_text.txt at the repository root when the app is built
 * (Vite's "?raw" import), so the app always shows the file word for word. Editing the file and
 * deploying updates the registration screen and the Privacy page.
 */
import raw from '../../../privacy_text.txt?raw'
import { parsePrivacyText } from './privacyText.js'

/** Part A (short text and checkbox label) and Part B (the full notice). */
export const PRIVACY = parsePrivacyText(raw)
