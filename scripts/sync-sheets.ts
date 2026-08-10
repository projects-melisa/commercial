/**
 * Mirrors the database into Google Sheets by hand. One-way, Supabase → Sheets.
 *
 *   pnpm sheets:sync            write to the configured spreadsheet
 *   pnpm sheets:sync --dry-run  print what would be written, needing no Google account
 *
 * The writing itself lives in `src/lib/sheets/sync.ts`, shared with the scheduled
 * endpoint, so a hand-run mirror cannot behave differently from the daily one.
 *
 * Not an input path: whatever is in the sheet is replaced on every run, so the
 * database remains the single source of truth. Edits made in the sheet are lost.
 */
import { config } from 'dotenv'

import { buildMirror } from '../src/lib/sheets/mirror.ts'
import { readSource, recordRun, syncToSheets } from '../src/lib/sheets/sync.ts'

config({ path: '.env.local', quiet: true })

const startedAt = new Date().toISOString()

if (process.argv.includes('--dry-run')) {
  const { contracts, cases } = await readSource()
  for (const sheet of buildMirror(contracts, cases)) {
    console.log(`\n=== ${sheet.name} — ${sheet.values.length - 1} data rows ===`)
    for (const row of sheet.values.slice(0, 4)) console.log(' ', JSON.stringify(row))
    if (sheet.values.length > 4) console.log(`  … ${sheet.values.length - 4} more`)
  }
  console.log('\nDry run: nothing was written to Google, and no run was recorded.')
} else {
  try {
    const result = await syncToSheets()
    await recordRun({ status: 'ok', rowsWritten: result.rowsWritten }, 'manual', startedAt)
    for (const sheet of result.sheets) console.log(`Wrote ${sheet.rows} rows to ${sheet.name}`)
    console.log(`\nhttps://docs.google.com/spreadsheets/d/${result.spreadsheetId}/edit`)
  } catch (error) {
    await recordRun({ status: 'failed', error: (error as Error).message }, 'manual', startedAt)
    throw error
  }
}
