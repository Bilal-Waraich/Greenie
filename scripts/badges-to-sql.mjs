/**
 * Prints the SQL that loads badges.json into the database (US-15).
 *
 * Usage: node scripts/badges-to-sql.mjs [path/to/badges.json] | psql "<database url>" -v ON_ERROR_STOP=1
 *
 * The output is a single call to private.sync_badges(...) with the file's content as a dollar-quoted
 * JSON literal. The database function validates the list again, updates or adds every badge, and
 * hides badges that are no longer in the file. The deploy workflow and `npm run db:reset` both use it.
 * No dependencies: plain Node.js.
 */
import { join } from 'node:path'
import { validateBadges } from './lib/badges-rules.mjs'
import { buildSyncSql, printSyncSql } from './lib/sync-sql.mjs'

/**
 * Builds the SQL statement for a validated badge list.
 * @param {unknown[]} badges - Parsed and validated badges.json content.
 * @returns {string} The SQL statement.
 */
export function buildBadgesSql(badges) {
  return buildSyncSql({ file: 'badges.json', script: 'badges-to-sql.mjs', functionName: 'private.sync_badges', list: badges })
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  printSyncSql({
    path: process.argv[2] || join(import.meta.dirname, '..', 'badges.json'),
    file: 'badges.json',
    validate: validateBadges,
    build: buildBadgesSql,
  })
}
