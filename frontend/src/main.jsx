/**
 * Entry point: loads the self-hosted fonts and styles, then renders the app, or a clear message if
 * the Supabase address or key is missing from the build.
 */
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/pixelify-sans/500.css'
import '@fontsource/pixelify-sans/700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pages.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MESSAGES } from './lib/messages.js'
import { isConfigured } from './lib/supabase.js'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isConfigured ? (
      <App />
    ) : (
      <main className="config-error">
        <h1>Greenie</h1>
        <p className="simple-page__text">{MESSAGES.notConfigured}</p>
      </main>
    )}
  </StrictMode>,
)
