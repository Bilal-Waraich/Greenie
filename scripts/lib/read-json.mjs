/**
 * Reads a JSON file and explains clearly what went wrong if it can't be read or parsed.
 */
import { readFileSync } from 'node:fs'

/**
 * Reads and parses a JSON file.
 * @param {string} filePath - Path of the file.
 * @returns {{ ok: true, value: unknown } | { ok: false, error: string }}
 */
export function readJsonFile(filePath) {
  let text
  try {
    text = readFileSync(filePath, 'utf8')
  } catch (error) {
    return { ok: false, error: `Could not read ${filePath}: ${error.message}` }
  }
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (error) {
    return { ok: false, error: `${filePath} is not valid JSON: ${error.message}` }
  }
}
