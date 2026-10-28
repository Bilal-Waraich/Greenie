/**
 * `npm run db:reset`: rebuilds the LOCAL database from the migrations and loads actions.json into it.
 *
 * This is the local equivalent of a restart after editing actions.json (US-08 AC1). It wipes all local
 * data (accounts, logs). Run `npm run seed:local` afterwards for demo data.
 * Requires the local stack (`supabase start`) and psql.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { readLocalStatus, REPO_ROOT } from './local-supabase.mjs'

/**
 * Runs the reset and the actions load, stopping at the first failure.
 * @returns {void}
 */
function main() {
  const { dbUrl } = readLocalStatus()

  console.log('Resetting the local database (supabase db reset)...')
  execFileSync('supabase', ['db', 'reset', '--local'], { cwd: REPO_ROOT, stdio: 'inherit' })

  console.log('Loading actions.json...')
  const sql = execFileSync('node', [join(REPO_ROOT, 'scripts', 'actions-to-sql.mjs')], { encoding: 'utf8' })
  execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc'], {
    input: sql,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  console.log('Done: local database reset and actions.json loaded.')
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
