/**
 * Checks the client's configuration files before a deploy: actions.json, badges.json and guide.json
 * (fields and values) and privacy_text.txt (the structure the app reads it by: Part A with the
 * checkbox label, Part B).
 *
 * Usage: node scripts/check-config.mjs [path/to/actions.json]
 * Exits with code 1 and one line per problem if a file is invalid, so the GitHub Actions workflow
 * stops before anything is published. No dependencies: plain Node.js.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parsePrivacyText } from '../frontend/src/lib/privacyText.js'
import { validateActions } from './lib/actions-rules.mjs'
import { validateBadges } from './lib/badges-rules.mjs'
import { validateGuide } from './lib/guide-rules.mjs'
import { readJsonFile } from './lib/read-json.mjs'

const root = join(import.meta.dirname, '..')

/** The JSON files, each with its rules. The actions file can be given on the command line. */
const JSON_FILES = [
  { name: 'actions.json', path: process.argv[2] || join(root, 'actions.json'), validate: validateActions, noun: 'actions' },
  { name: 'badges.json', path: join(root, 'badges.json'), validate: validateBadges, noun: 'badges' },
  { name: 'guide.json', path: join(root, 'guide.json'), validate: validateGuide, noun: 'entries' },
]
const privacyPath = join(root, 'privacy_text.txt')

const errors = []
const summary = []
for (const file of JSON_FILES) {
  const result = readJsonFile(file.path)
  const problems = result.ok ? file.validate(result.value) : [result.error]
  errors.push(...problems)
  if (problems.length === 0) summary.push(`${file.name} is valid: ${result.value.length} ${file.noun}.`)
}

try {
  parsePrivacyText(readFileSync(privacyPath, 'utf8'))
  summary.push('privacy_text.txt is valid.')
} catch (error) {
  errors.push(error.code === 'ENOENT' ? `Could not find ${privacyPath}.` : error.message)
}

if (errors.length > 0) {
  console.error('Configuration check failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
for (const line of summary) console.log(line)
