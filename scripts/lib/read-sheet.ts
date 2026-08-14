/**
 * Reads Master_Database_Komersial_Compiled from Google Sheets.
 *
 * The Sheet is the source of truth. It was rewritten by hand and no longer matches
 * the .xlsx this project was normalised from, so the workbook reader it replaces is
 * kept only for the record.
 *
 * Authenticates with the same service account as the mirror, so `GOOGLE_*` in
 * `.env.local` is all it needs. Nothing here writes: this file only reads.
 */
import { createSign } from 'node:crypto'

export const BUSINESS_LINES = [
  'Ground Handling',
  'Cargo Handling',
  'Ancillary Business',
] as const
export type BusinessLine = (typeof BUSINESS_LINES)[number]

export type RfmStatus = 'HIGH' | 'MEDIUM' | 'LOW'
export type CaseStatus = 'OPEN' | 'CLOSED'

export interface SourceCustomer {
  customerId: string
  nama: string
  rfmStatus: RfmStatus
  frequencyScore: number | null
  monetaryScore: number | null
  recencyScore: number | null
}

/**
 * One contract line — one row of `Compiled_Contracts`, already split by station.
 *
 * A Sheet row reading "MDC, BTH" becomes two of these. That is not an invention: the
 * Sheet already writes K-010 as two rows, one for CGK and one for DPS, priced
 * differently at each. A station-scoped GM sees exactly the lines at their own
 * airport, and `cabang: null` — the Sheet's "All Station" — is portfolio-wide work
 * visible to everyone unconfined.
 */
export interface SourceContract {
  contractNo: string
  customerId: string
  /** IATA code, or null for "All Station". */
  cabang: string | null
  businessLine: BusinessLine
  contractStartDate: string | null
  contractEndDate: string
  tarif: number
  cost: number
  picNama: string | null
  picTelepon: string | null
  picEmail: string | null
  remarks: string | null
  latestContract: string | null
}

export interface SourceCase {
  customerId: string
  description: string
  status: CaseStatus
}

export interface SheetSource {
  customers: SourceCustomer[]
  contracts: SourceContract[]
  cases: SourceCase[]
}

/** A cell as the Sheets API returns it with raw rendering. */
type Cell = string | number | boolean | null | undefined

const asText = (raw: Cell): string => (raw === null || raw === undefined ? '' : String(raw))

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set — see .env.example`)
  return value
}

const base64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Read-only scope: this reader must never be able to write over the source. */
const getAccessToken = async (): Promise<string> => {
  const clientEmail = required('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = required('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
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

/**
 * A number, however the cell holds it. Blank is null, not zero.
 *
 * Raw rendering gives numbers as numbers, but a cell someone typed as text still
 * arrives as `"22,000,000"`, so the separator strip stays.
 */
const toNumber = (raw: Cell): number | null => {
  if (typeof raw === 'number') return raw
  const text = asText(raw).replace(/[,\s]/g, '')
  if (text === '') return null
  const value = Number(text)
  if (Number.isNaN(value)) throw new Error(`not a number: ${JSON.stringify(raw)}`)
  return value
}

const trimmed = (raw: Cell): string | null => {
  const text = asText(raw).trim()
  return text === '' ? null : text
}

/**
 * A date cell as an ISO `YYYY-MM-DD`.
 *
 * A real date cell arrives as a Sheets serial: days since 1899-12-30, the epoch
 * Sheets inherited from Lotus 1-2-3. That is unambiguous, which a locale-formatted
 * `01/09/2026` is not. A cell typed as text still arrives as a string, and only the
 * unambiguous ISO form is accepted there — a slashed date is refused rather than
 * guessed at, because guessing wrong silently moves a contract's expiry by months.
 */
const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30)

const toIsoDate = (raw: Cell): string | null => {
  if (typeof raw === 'number') {
    const ms = SHEETS_EPOCH_UTC + Math.round(raw) * 86_400_000
    return new Date(ms).toISOString().slice(0, 10)
  }
  const text = asText(raw).trim()
  if (text === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10)
  throw new Error(
    `unrecognised date ${JSON.stringify(raw)} — write it as YYYY-MM-DD, or format the ` +
      'cell as a real date so it arrives as a serial number',
  )
}

/**
 * "All Station" → `[null]`; "MDC, BTH" → `['MDC', 'BTH']`.
 *
 * Null rather than a code, because a null `cabang` already means "every station" to
 * the RLS policies — the same convention that lets a null business line mean every
 * line. Nothing new had to be invented to express "All Station".
 */
const splitStations = (raw: Cell): (string | null)[] => {
  const text = asText(raw).trim()
  if (text === '' || /^all station$/i.test(text)) return [null]
  return text
    .split(',')
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part !== '')
}

const asRfm = (raw: Cell): RfmStatus => {
  const value = asText(raw).trim().toUpperCase()
  if (value === 'HIGH' || value === 'MEDIUM' || value === 'LOW') return value
  throw new Error(`unrecognised RFM_Status: ${JSON.stringify(raw)}`)
}

const asBusinessLine = (raw: Cell): BusinessLine => {
  const value = asText(raw).trim()
  const match = BUSINESS_LINES.find((line) => line.toLowerCase() === value.toLowerCase())
  if (!match) {
    throw new Error(
      `unrecognised BusinessLine ${JSON.stringify(raw)} — expected one of ${BUSINESS_LINES.join(', ')}`,
    )
  }
  return match
}

/** Indexes a header row so a reordered column does not silently shift the data. */
const columnFinder = (header: Cell[], tab: string) => (name: string): number => {
  const index = header.findIndex((cell) => asText(cell).trim().toLowerCase() === name.toLowerCase())
  if (index === -1) throw new Error(`${tab} has no "${name}" column; found: ${header.map(asText).join(', ')}`)
  return index
}

export const readSheet = async (): Promise<SheetSource> => {
  const spreadsheetId = required('GOOGLE_SHEET_ID')
  const token = await getAccessToken()

  /**
   * Raw cell values, not the display strings.
   *
   * `UNFORMATTED_VALUE` matters for correctness, not tidiness: with the default
   * rendering a date arrives formatted to the spreadsheet's locale, and `01/09/2026`
   * is 1 September or 9 January depending on a setting nobody here controls. Raw
   * values give a date as a serial number, which is unambiguous. Numbers likewise
   * arrive as numbers rather than "22,000,000".
   */
  const values = async (range: string): Promise<Cell[][]> => {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}` +
        '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok) throw new Error(`could not read ${range}: ${await response.text()}`)
    return ((await response.json()) as { values?: Cell[][] }).values ?? []
  }

  // ── CRM_Data → customers
  const crm = await values('CRM_Data!A1:Z1000')
  const crmAt = columnFinder(crm[0] ?? [], 'CRM_Data')
  const [crmId, crmNama, crmRfm, crmF, crmM, crmR] = [
    crmAt('CustomerID'),
    crmAt('CustomerName'),
    crmAt('RFM_Status'),
    crmAt('Frequency Score'),
    crmAt('Monetary Score'),
    crmAt('Recency Score'),
  ]
  const customers: SourceCustomer[] = crm
    .slice(1)
    .filter((row) => asText(row[crmId]).trim() !== '')
    .map((row) => ({
      customerId: asText(row[crmId]).trim(),
      nama: asText(row[crmNama]).trim(),
      rfmStatus: asRfm(row[crmRfm]),
      frequencyScore: toNumber(row[crmF]),
      monetaryScore: toNumber(row[crmM]),
      recencyScore: toNumber(row[crmR]),
    }))

  // ── Compiled_Contracts → contracts, one row per station
  const cc = await values('Compiled_Contracts!A1:AJ1000')
  const ccAt = columnFinder(cc[0] ?? [], 'Compiled_Contracts')
  const col = {
    no: ccAt('ContractID'),
    customer: ccAt('CustomerID'),
    station: ccAt('Station'),
    line: ccAt('BusinessLine'),
    start: ccAt('ContractStartDate'),
    end: ccAt('ContractEndDate'),
    tarif: ccAt('Tarif/Handling'),
    cost: ccAt('Cost/Handling'),
    pic: ccAt('PIC Customer'),
    phone: ccAt('Number PIC'),
    email: ccAt('Email PIC'),
    remarks: ccAt('Remarks'),
    latest: ccAt('Latest Contract'),
  }

  const contracts: SourceContract[] = []
  for (const row of cc.slice(1)) {
    if (asText(row[col.customer]).trim() === '') continue
    const contractNo = asText(row[col.no]).trim()
    const tarif = toNumber(row[col.tarif])
    const cost = toNumber(row[col.cost])
    const end = toIsoDate(row[col.end])
    // A row missing any of these cannot be stored, and a silently skipped contract is
    // worse than a failed import: nobody notices a contract that never arrived.
    if (contractNo === '' || tarif === null || cost === null || end === null) {
      throw new Error(
        `Compiled_Contracts row for ${JSON.stringify(asText(row[col.customer]))} is missing ` +
          'ContractID, tarif, cost or end date',
      )
    }
    for (const cabang of splitStations(row[col.station])) {
      contracts.push({
        contractNo,
        customerId: asText(row[col.customer]).trim(),
        cabang,
        businessLine: asBusinessLine(row[col.line]),
        contractStartDate: toIsoDate(row[col.start]),
        contractEndDate: end,
        tarif,
        cost,
        picNama: trimmed(row[col.pic]),
        picTelepon: trimmed(row[col.phone]),
        picEmail: trimmed(row[col.email]),
        remarks: trimmed(row[col.remarks]),
        latestContract: trimmed(row[col.latest]),
      })
    }
  }

  // ── CS_Data → cases
  const cs = await values('CS_Data!A1:Z1000')
  const csAt = columnFinder(cs[0] ?? [], 'CS_Data')
  const [csId, csDesc, csStatus] = [
    csAt('CustomerID'),
    csAt('CaseDescription'),
    csAt('CaseStatus'),
  ]
  const cases: SourceCase[] = cs
    .slice(1)
    .filter((row) => asText(row[csId]).trim() !== '')
    .map((row) => {
      const status = asText(row[csStatus]).trim().toUpperCase()
      if (status !== 'OPEN' && status !== 'CLOSED') {
        throw new Error(`unrecognised CaseStatus: ${JSON.stringify(row[csStatus])}`)
      }
      return {
        customerId: asText(row[csId]).trim(),
        description: asText(row[csDesc]).trim(),
        status,
      }
    })

  // Referential integrity, checked here rather than discovered as a failed insert.
  const known = new Set(customers.map((c) => c.customerId))
  for (const contract of contracts) {
    if (!known.has(contract.customerId)) {
      throw new Error(`contract ${contract.contractNo} references unknown customer ${contract.customerId}`)
    }
  }
  for (const kasus of cases) {
    if (!known.has(kasus.customerId)) {
      throw new Error(`a case references unknown customer ${kasus.customerId}`)
    }
  }

  return { customers, contracts, cases }
}
