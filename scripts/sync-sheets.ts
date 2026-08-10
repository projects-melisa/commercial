/**
 * Mirrors the database into Google Sheets. One-way, Supabase → Sheets.
 *
 *   pnpm sheets:sync            write to the configured spreadsheet
 *   pnpm sheets:sync --dry-run  print what would be written, needing no Google account
 *
 * Not an input path: whatever is in the sheet is replaced on every run, so the
 * database remains the single source of truth. Edits made in the sheet are lost.
 *
 * Authentication is a Google service account. Rather than pull in `googleapis`, the
 * service-account JWT is signed here with node:crypto and exchanged for an access
 * token — about thirty lines against a large dependency tree.
 */
import { createSign } from 'node:crypto'
import { config } from 'dotenv'

import { buildMirror, type MirrorCase, type MirrorContract } from '../src/lib/sheets/mirror.ts'

config({ path: '.env.local', quiet: true })

const dryRun = process.argv.includes('--dry-run')

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set — see .env.example`)
  return value
}

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Signs a service-account assertion and exchanges it for an OAuth access token. */
const getAccessToken = async (): Promise<string> => {
  const clientEmail = required('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  // Keys pasted into .env arrive with literal \n; restore the real newlines.
  const privateKey = required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify(claim),
  )}`
  const signature = base64url(createSign('RSA-SHA256').update(unsigned).sign(privateKey))

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })

  if (!response.ok) {
    throw new Error(`Google refused the service-account assertion: ${await response.text()}`)
  }
  return ((await response.json()) as { access_token: string }).access_token
}

/** Reads the rows to mirror, under the service role: the mirror is portfolio-wide. */
const readSource = async (): Promise<{ contracts: MirrorContract[]; cases: MirrorCase[] }> => {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const key = required('SUPABASE_SERVICE_ROLE_KEY')
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers })
    if (!response.ok) throw new Error(`${path}: ${await response.text()}`)
    return (await response.json()) as T
  }

  const rows = await get<
    {
      customer_id: string
      business_line: string
      service_type: string
      contract_end_date: string
      tarif: number
      cost: number
      min_gpm_target: number
      customers: { nama: string; rfm_status: string } | null
    }[]
  >(
    'contracts?select=customer_id,business_line,service_type,contract_end_date,tarif,cost,min_gpm_target,customers(nama,rfm_status)',
  )

  const cases = await get<MirrorCase[]>('cases?select=customer_id,description,status')

  return {
    contracts: rows.map((row) => ({
      customer_id: row.customer_id,
      customer_nama: row.customers?.nama ?? row.customer_id,
      business_line: row.business_line,
      service_type: row.service_type,
      contract_end_date: row.contract_end_date,
      tarif: Number(row.tarif),
      cost: Number(row.cost),
      min_gpm_target: Number(row.min_gpm_target),
      rfm_status: row.customers?.rfm_status ?? '',
    })),
    cases,
  }
}

const { contracts, cases } = await readSource()
const sheets = buildMirror(contracts, cases)

if (dryRun) {
  for (const sheet of sheets) {
    console.log(`\n=== ${sheet.name} — ${sheet.values.length - 1} data rows ===`)
    for (const row of sheet.values.slice(0, 4)) console.log(' ', JSON.stringify(row))
    if (sheet.values.length > 4) console.log(`  … ${sheet.values.length - 4} more`)
  }
  console.log('\nDry run: nothing was written to Google.')
} else {
  const spreadsheetId = required('GOOGLE_SHEET_ID')
  const token = await getAccessToken()
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Ensure every tab exists before writing; a missing tab fails the whole update.
  const meta = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers },
  )
  if (!meta.ok) throw new Error(`could not read the spreadsheet: ${await meta.text()}`)
  const existing = new Set(
    ((await meta.json()) as { sheets: { properties: { title: string } }[] }).sheets.map(
      (s) => s.properties.title,
    ),
  )

  const missing = sheets.filter((sheet) => !existing.has(sheet.name))
  if (missing.length > 0) {
    const created = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requests: missing.map((sheet) => ({ addSheet: { properties: { title: sheet.name } } })),
        }),
      },
    )
    if (!created.ok) throw new Error(`could not add tabs: ${await created.text()}`)
  }

  // Clear then write, so a shrinking dataset does not leave stale trailing rows.
  const cleared = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ ranges: sheets.map((sheet) => sheet.name) }),
    },
  )
  if (!cleared.ok) throw new Error(`could not clear the sheets: ${await cleared.text()}`)

  const written = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: sheets.map((sheet) => ({ range: `${sheet.name}!A1`, values: sheet.values })),
      }),
    },
  )
  if (!written.ok) throw new Error(`could not write the sheets: ${await written.text()}`)

  for (const sheet of sheets) {
    console.log(`Wrote ${sheet.values.length - 1} rows to ${sheet.name}`)
  }
  console.log(`\nhttps://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`)
}
