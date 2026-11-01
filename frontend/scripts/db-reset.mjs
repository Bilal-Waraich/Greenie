/**
 * `npm run db:reset`: rebuilds the LOCAL database from the migrations and loads actions.json and
 * badges.json into it.
 *
 * This is the local equivalent of a restart after editing actions.json or badges.json (US-08 AC1). It
 * wipes all local data (accounts, logs). Run `npm run seed:local` afterwards for demo data.
 * Requires the local stack (`supabase start`) and psql.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { readLocalStatus, REPO_ROOT } from './local-supabase.mjs'

/**
 * Runs the reset and loads both files, stopping at the first failure.
 * @returns {void}
 */
function main() {
  const { dbUrl } = readLocalStatus()

  console.log('Resetting the local database (supabase db reset)...')
  execFileSync('supabase', ['db', 'reset', '--local'], { cwd: REPO_ROOT, stdio: 'inherit' })

  for (const [file, script] of [['actions.json', 'actions-to-sql.mjs'], ['badges.json', 'badges-to-sql.mjs']]) {
    console.log(`Loading ${file}...`)
    const sql = execFileSync('node', [join(REPO_ROOT, 'scripts', script)], { encoding: 'utf8' })
    execFileSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '--quiet', '--no-psqlrc'], {
      input: sql,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  }
  console.log('Done: local database reset, actions.json and badges.json loaded.')
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
