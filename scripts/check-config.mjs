/**
 * Checks the client's configuration files before a deploy.
 *
 * Usage: node scripts/check-config.mjs [path/to/actions.json]
 * Exits with code 1 and one line per problem if the file is invalid, so the GitHub Actions workflow
 * stops before anything is published. No dependencies: plain Node.js.
 */
import { join } from 'node:path'
import { validateActions } from './lib/actions-rules.mjs'
import { readJsonFile } from './lib/read-json.mjs'

const actionsPath = process.argv[2] || join(import.meta.dirname, '..', 'actions.json')

const result = readJsonFile(actionsPath)
const errors = result.ok ? validateActions(result.value) : [result.error]

if (errors.length > 0) {
  console.error(`Configuration check failed (${actionsPath}):`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
console.log(`actions.json is valid: ${result.value.length} actions.`)
