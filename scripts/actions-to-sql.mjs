/**
 * Prints the SQL that loads actions.json into the database (US-08).
 *
 * Usage: node scripts/actions-to-sql.mjs [path/to/actions.json] | psql "<database url>" -v ON_ERROR_STOP=1
 *
 * The output is a single call to private.sync_actions(...) with the file's content as a dollar-quoted
 * JSON literal. The database function validates the list again, updates or adds every action, and
 * hides actions that are no longer in the file. The deploy workflow and `npm run db:reset` both use it.
 * No dependencies: plain Node.js.
 */
import { join } from 'node:path'
import { validateActions } from './lib/actions-rules.mjs'
import { buildSyncSql, printSyncSql } from './lib/sync-sql.mjs'

/**
 * Builds the SQL statement for a validated action list.
 * @param {unknown[]} actions - Parsed and validated actions.json content.
 * @returns {string} The SQL statement.
 */
export function buildActionsSql(actions) {
  return buildSyncSql({ file: 'actions.json', script: 'actions-to-sql.mjs', functionName: 'private.sync_actions', list: actions })
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  printSyncSql({
    path: process.argv[2] || join(import.meta.dirname, '..', 'actions.json'),
    file: 'actions.json',
    validate: validateActions,
    build: buildActionsSql,
  })
}
