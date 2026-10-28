/**
 * Helpers for scripts that work with the LOCAL Supabase stack only (db-reset.mjs, seed-local.mjs and the
 * end-to-end tests).
 *
 * Values come from `supabase status -o env` at run time, so no key is ever stored in a file. Every
 * helper refuses any address that isn't 127.0.0.1 or localhost, so these scripts can never touch the
 * hosted project.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

/** The repository root (the folder that contains supabase/). */
export const REPO_ROOT = join(import.meta.dirname, '..', '..')

/**
 * Throws unless the URL points at this computer.
 * @param {string} url - An http(s) or postgresql URL.
 * @returns {string} The same URL.
 */
export function assertLocalUrl(url) {
  const host = new URL(url).hostname
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`Refusing to use a non-local Supabase address (${host}). These scripts are for the local stack only.`)
  }
  return url
}

/**
 * Reads the local stack's URLs and keys from `supabase status -o env`.
 * @returns {{ apiUrl: string, dbUrl: string, publishableKey: string, secretKey: string, mailUrl: string }}
 */
export function readLocalStatus() {
  let output
  try {
    output = execFileSync('supabase', ['status', '-o', 'env'], { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    throw new Error('Could not read the local Supabase status. Is the stack running? Run `supabase start` in the repository root.')
  }
  const values = {}
  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/)
    if (match) values[match[1]] = match[2]
  }
  const status = {
    apiUrl: values.API_URL,
    dbUrl: values.DB_URL,
    publishableKey: values.PUBLISHABLE_KEY || values.ANON_KEY,
    secretKey: values.SECRET_KEY || values.SERVICE_ROLE_KEY,
    mailUrl: values.MAILPIT_URL || values.INBUCKET_URL,
  }
  if (!status.apiUrl || !status.dbUrl || !status.publishableKey || !status.secretKey) {
    throw new Error('`supabase status` did not return the expected values. Is the local stack running?')
  }
  assertLocalUrl(status.apiUrl)
  assertLocalUrl(status.dbUrl)
  return status
}
