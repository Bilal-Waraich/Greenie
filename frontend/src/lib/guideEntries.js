/**
 * Bean Co.'s guide content: guide.json at the repository root, built into the site (US-07 AC1, AC3).
 * Editing the file and deploying changes the Guide page, with no code change. The deploy checks the
 * file first (scripts/check-config.mjs).
 */
import entries from '../../../guide.json'

/** The guide entries in file order: { item, where, note }. */
export const GUIDE_ENTRIES = entries
