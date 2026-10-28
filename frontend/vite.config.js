/**
 * Vite configuration for the Greenie front end.
 *
 * - `base` comes from the BASE_PATH environment variable, which the GitHub Pages workflow sets to the
 *   repository's sub-path (for example "/Greenie/"). Locally it defaults to "/".
 * - The dev server and the preview server always run on 127.0.0.1:5273, so the browser, the tests and
 *   the local Supabase redirect URLs all use the same address.
 */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5273, strictPort: true },
  preview: { host: '127.0.0.1', port: 5273, strictPort: true },
})
