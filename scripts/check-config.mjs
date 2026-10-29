/**
 * Checks the client's configuration files before a deploy: actions.json (fields and values) and
 * privacy_text.txt (the structure the app reads it by: Part A with the checkbox label, Part B).
 *
 * Usage: node scripts/check-config.mjs [path/to/actions.json]
 * Exits with code 1 and one line per problem if a file is invalid, so the GitHub Actions workflow
 * stops before anything is published. No dependencies: plain Node.js.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePrivacyText } from '../frontend/src/lib/privacyText.js'
import { validateActions } from './lib/actions-rules.mjs'
import { readJsonFile } from './lib/read-json.mjs'

const actionsPath = process.argv[2] || join(import.meta.dirname, '..', 'actions.json')
const privacyPath = join(import.meta.dirname, '..', 'privacy_text.txt')

const result = readJsonFile(actionsPath)
const errors = result.ok ? validateActions(result.value) : [result.error]

try {
  parsePrivacyText(readFileSync(privacyPath, 'utf8'))
} catch (error) {
  errors.push(error.code === 'ENOENT' ? `Could not find ${privacyPath}.` : error.message)
}

if (errors.length > 0) {
  console.error(`Configuration check failed (${actionsPath}, ${privacyPath}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`actions.json is valid: ${result.value.length} actions.`)
console.log('privacy_text.txt is valid.')
