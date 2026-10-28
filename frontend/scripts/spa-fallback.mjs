/**
 * Copies dist/index.html to dist/404.html after a production build.
 *
 * GitHub Pages has no rewrite rules: a reload or a direct visit to a deep link such as /Greenie/log
 * gets the site's 404.html. Making 404.html a copy of the app lets the app's router handle the path.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(import.meta.dirname, '..', 'dist')
const indexFile = join(distDir, 'index.html')

if (!existsSync(indexFile)) {
  console.error('spa-fallback: dist/index.html not found. Run the Vite build first.')
  process.exit(1)
}
copyFileSync(indexFile, join(distDir, '404.html'))
console.log('spa-fallback: wrote dist/404.html')
