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
export type CustomerType = 'agent' | 'non_agent'
export type CaseStatus = 'OPEN' | 'CLOSED'

export interface SourceCustomer {
  customerId: string
  nama: string
  rfmStatus: RfmStatus
  frequencyScore: number | null
  monetaryScore: number | null
  recencyScore: number | null
  /** Agent or Non-Agent, or null where the Sheet has not said. Never inferred. */
  tipe: CustomerType | null
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

/**
 * `Customer Type` → agent or non-agent, and null for anything else.
 *
 * Null rather than a default: the B2B/B2C boards are built on this, and a blank cell
 * silently becoming "agent" would put a real person in the corporate list. The column
 * itself is optional, because it did not exist until this project asked for it.
 */
const asCustomerType = (raw: Cell): CustomerType | null => {
  const value = asText(raw).trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (value === 'agent') return 'agent'
  if (value === 'nonagent') return 'non_agent'
  return null
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

/**
 * Indexes a header row so a reordered column does not silently shift the data.
 *
 * Compared with inner whitespace collapsed, because the Sheet writes the header the
 * way it reads best in a narrow column — `PLAN / ACTUAL` where the documentation says
 * `PLAN/ACTUAL`. Spacing inside a heading is a formatting choice, not a rename.
 */
const norm = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, '')

const columnFinder = (header: Cell[], tab: string) => (name: string): number => {
  const index = header.findIndex((cell) => norm(asText(cell)) === norm(name))
  if (index === -1) throw new Error(`${tab} has no "${name}" column; found: ${header.map(asText).join(', ')}`)
  return index
}

export type ReadRange = (range: string) => Promise<Cell[][]>

/**
 * Rows past the end of the data, so a range can never quietly truncate a tab.
 *
 * Every reader here used to name its own row cap — `A1:Z1000`, `A1:Z5000` — and the
 * day `Ancillary_Data` grew to 8,155 rows the pull read 4,999 of them and reported
 * success. A short read is indistinguishable from a small tab, which is why the
 * assertion below matters more than the number does.
 */
const BATAS_BARIS = 200_000

/**
 * Reads a whole tab and refuses to return a result that fills the range.
 *
 * A full range means the tab may extend past it, and the caller has no way to tell.
 * Failing here costs one tab of one nightly run; returning short costs a total that
 * looks plausible and is wrong.
 */
const readTab = async (
  values: ReadRange,
  tab: string,
  kolomTerakhir = 'Z',
): Promise<Cell[][]> => {
  const rows = await values(`${tab}!A1:${kolomTerakhir}${BATAS_BARIS}`)
  if (rows.length >= BATAS_BARIS) {
    throw new Error(
      `${tab} filled the ${BATAS_BARIS}-row read window; raise BATAS_BARIS rather than accept a short read`,
    )
  }
  return rows
}

/**
 * Authenticates once and hands back a range reader.
 *
 * Split out so the daily pull can read the tabs the seed has no use for without
 * signing a fresh service-account assertion per tab.
 */
export const openSheet = async (): Promise<ReadRange> => {
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
  return async (range: string): Promise<Cell[][]> => {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}` +
        '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok) throw new Error(`could not read ${range}: ${await response.text()}`)
    return ((await response.json()) as { values?: Cell[][] }).values ?? []
  }
}

export const readSheet = async (): Promise<SheetSource> => {
  const values = await openSheet()

  // ── CRM_Data → customers
  const crm = await readTab(values, 'CRM_Data')
  const crmAt = columnFinder(crm[0] ?? [], 'CRM_Data')
  const [crmId, crmNama, crmRfm, crmF, crmM, crmR] = [
    crmAt('CustomerID'),
    crmAt('CustomerName'),
    crmAt('RFM_Status'),
    crmAt('Frequency Score'),
    crmAt('Monetary Score'),
    crmAt('Recency Score'),
  ]
  // Optional: the tab predates the column, and a Sheet without it must still pull.
  const crmTipe = (crm[0] ?? []).findIndex(
    (cell) => norm(asText(cell)) === norm('Customer Type'),
  )

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
      tipe: crmTipe === -1 ? null : asCustomerType(row[crmTipe]),
    }))

  // ── Compiled_Contracts → contracts, one row per station
  const cc = await readTab(values, 'Compiled_Contracts', 'AJ')
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
  const cs = await readTab(values, 'CS_Data')
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

/** One row of `Receivable_Data`, keyed by customer as the tab itself is. */
export interface SourceReceivable {
  customerId: string
  status: 'OPEN' | 'CLOSED'
  d0_30: number
  d31_60: number
  d61_90: number
  d91_120: number
  d121_150: number
  d151_180: number
  d181_360: number
  d360_plus: number
  total: number
}

// The Sheet's own header text, which is "0-30 Days" and not the "0-30" the spec's
// column inventory records. Taken from the tab rather than the document: the tab is
// what the pull has to read.
const AGING = [
  ['0-30 Days', 'd0_30'],
  ['31-60 Days', 'd31_60'],
  ['61-90 Days', 'd61_90'],
  ['91-120 Days', 'd91_120'],
  ['121-150 Days', 'd121_150'],
  ['151-180 Days', 'd151_180'],
  ['181-360 Days', 'd181_360'],
  ['>360 Days', 'd360_plus'],
] as const

/**
 * `Receivable_Data` → receivables.
 *
 * The tab's own `Total` is stored rather than recomputed from the buckets. Finance
 * maintains both by hand, and quietly substituting our sum would hide the day they
 * disagree — which is a fact about the source worth seeing, not a rounding error.
 */
export const readReceivables = async (values: ReadRange): Promise<SourceReceivable[]> => {
  const rows = await readTab(values, 'Receivable_Data')
  if (rows.length === 0) return []
  const at = columnFinder(rows[0] ?? [], 'Receivable_Data')
  const idAt = at('CustomerID')
  const statusAt = at('Receivable Status')
  const totalAt = at('Total')
  const bucketAt = AGING.map(([header, column]) => [at(header), column] as const)

  return rows
    .slice(1)
    .filter((row) => asText(row[idAt]).trim() !== '')
    .map((row) => {
      const status = asText(row[statusAt]).trim().toUpperCase()
      if (status !== 'OPEN' && status !== 'CLOSED') {
        throw new Error(`unrecognised Receivable Status: ${JSON.stringify(row[statusAt])}`)
      }
      const buckets = Object.fromEntries(
        bucketAt.map(([index, column]) => [column, toNumber(row[index]) ?? 0]),
      ) as Omit<SourceReceivable, 'customerId' | 'status' | 'total'>
      return {
        customerId: asText(row[idAt]).trim(),
        status,
        ...buckets,
        total: toNumber(row[totalAt]) ?? 0,
      }
    })
}

/** One row of `Ancillary_Data` — the revenue tab, scoped per station by `Cab`. */
export interface SourceAncillary {
  cab: string
  planActual: 'Plan' | 'Actual'
  customer: string
  periode: string
  tahun: number
  production: number
  total: number
  textPl: string | null
  group1Gl: string | null
  group2Gl: string | null
  group3Gl: string | null
}

/**
 * `Ancillary_Data` → ancillary_revenues.
 *
 * Returns nothing for an empty tab rather than failing on a missing header row: the
 * tab is genuinely empty today, and a pull that refused to run until someone filled
 * it in would take the other seven tabs down with it.
 */
export const readAncillary = async (values: ReadRange): Promise<SourceAncillary[]> => {
  const rows = await readTab(values, 'Ancillary_Data')
  if (rows.length === 0) return []
  const at = columnFinder(rows[0] ?? [], 'Ancillary_Data')
  const col = {
    cab: at('Cab'),
    planActual: at('PLAN/ACTUAL'),
    customer: at('Customer'),
    periode: at('Periode'),
    tahun: at('Tahun'),
    production: at('Production'),
    total: at('Total of Reporting Period'),
    textPl: at('text P/L'),
    group1: at('group 1 GL'),
    group2: at('group 2 GL'),
    group3: at('group 3 GL'),
  }

  return rows
    .slice(1)
    .filter((row) => asText(row[col.cab]).trim() !== '')
    .map((row) => {
      // "PLAN"/"plan"/"Plan" all mean the same budget line; the check is on the word,
      // and the stored value is the one shape the column's constraint accepts.
      const raw = asText(row[col.planActual]).trim().toUpperCase()
      if (raw !== 'PLAN' && raw !== 'ACTUAL') {
        throw new Error(`unrecognised PLAN/ACTUAL: ${JSON.stringify(row[col.planActual])}`)
      }
      const periode = toIsoDate(row[col.periode])
      const tahun = toNumber(row[col.tahun])
      if (periode === null || tahun === null) {
        throw new Error(
          `Ancillary_Data row for ${JSON.stringify(asText(row[col.customer]))} is missing Periode or Tahun`,
        )
      }
      return {
        cab: asText(row[col.cab]).trim().toUpperCase(),
        planActual: raw === 'PLAN' ? ('Plan' as const) : ('Actual' as const),
        customer: asText(row[col.customer]).trim(),
        periode,
        tahun,
        production: toNumber(row[col.production]) ?? 0,
        total: toNumber(row[col.total]) ?? 0,
        textPl: trimmed(row[col.textPl]),
        group1Gl: trimmed(row[col.group1]),
        group2Gl: trimmed(row[col.group2]),
        group3Gl: trimmed(row[col.group3]),
      }
    })
}

/** One row of `Penalty_Data`. */
export interface SourcePenalty {
  customerId: string
  deskripsi: string
  nilai: number | null
  cabangAsal: string | null
  tahap: string
  dilaporkanPada: string | null
}

/**
 * The stages a penalty can stand at, matching the table's check constraint.
 *
 * Both routes the documents describe have to fit: the ideal one, where the station
 * validates before a claim is issued, and the real one, where Commercial hears first
 * and chases the station afterwards. Nothing here enforces an order, because forcing
 * one would make somebody enter a stage that never happened.
 */
const TAHAP = [
  'dilaporkan',
  'divalidasi_cabang',
  'klaim_terbit',
  'dilaporkan_ke_op',
  'ditutup',
] as const

/**
 * `Penalty_Data` → penalties.
 *
 * The tab had no header row until this project wrote one, so the column names are
 * ours rather than the client's — see C-15. Empty tab returns nothing rather than
 * failing, as with `Ancillary_Data`.
 */
export const readPenalties = async (values: ReadRange): Promise<SourcePenalty[]> => {
  const rows = await readTab(values, 'Penalty_Data')
  if (rows.length === 0) return []
  const at = columnFinder(rows[0] ?? [], 'Penalty_Data')
  const col = {
    customer: at('CustomerID'),
    deskripsi: at('PenaltyDescription'),
    nilai: at('PenaltyValue'),
    station: at('Station'),
    stage: at('Stage'),
    reported: at('ReportedDate'),
  }

  return rows
    .slice(1)
    .filter((row) => asText(row[col.customer]).trim() !== '')
    .map((row) => {
      const tahap = asText(row[col.stage]).trim().toLowerCase()
      if (!TAHAP.some((allowed) => allowed === tahap)) {
        throw new Error(
          `unrecognised Stage ${JSON.stringify(row[col.stage])} — expected one of ${TAHAP.join(', ')}`,
        )
      }
      const deskripsi = asText(row[col.deskripsi]).trim()
      if (deskripsi === '') {
        throw new Error(`Penalty_Data row for ${asText(row[col.customer])} has no PenaltyDescription`)
      }
      return {
        customerId: asText(row[col.customer]).trim(),
        deskripsi,
        nilai: toNumber(row[col.nilai]),
        cabangAsal: trimmed(row[col.station])?.toUpperCase() ?? null,
        tahap,
        dilaporkanPada: toIsoDate(row[col.reported]),
      }
    })
}

/**
 * `Revenue_Data` → the per-contract margin target.
 *
 * The tab is misnamed: it holds no revenue at all, only the simulator's inputs. The
 * one column worth pulling is `Min_GPM_Target (%)`, which is the *only* place a target
 * exists — `Compiled_Contracts` has no such column, which is why most contracts sit at
 * `null` and why `marginHealth` has three states rather than two.
 *
 * Written as `"0.25 (25%)"`: the fraction, then the same number spelled out for a
 * human. Only the leading fraction is read.
 */
export const readMarginTargets = async (values: ReadRange): Promise<Map<string, number>> => {
  const rows = await readTab(values, 'Revenue_Data')
  if (rows.length === 0) return new Map()
  const at = columnFinder(rows[0] ?? [], 'Revenue_Data')
  const idAt = at('CustomerID')
  const targetAt = at('Min_GPM_Target (%)')

  const targets = new Map<string, number>()
  for (const row of rows.slice(1)) {
    const customerId = asText(row[idAt]).trim()
    if (customerId === '') continue

    const raw = asText(row[targetAt]).trim()
    if (raw === '') continue
    const leading = /^-?\d*\.?\d+/.exec(raw)
    if (!leading) throw new Error(`unrecognised Min_GPM_Target: ${JSON.stringify(row[targetAt])}`)
    const target = Number(leading[0])
    if (target < 0 || target > 1) {
      // A target is a fraction. "25" here would silently become a 2500% floor and
      // report every contract in the book as breaching.
      throw new Error(`Min_GPM_Target ${JSON.stringify(raw)} is not a fraction between 0 and 1`)
    }

    const existing = targets.get(customerId)
    if (existing !== undefined && existing !== target) {
      // One customer, two service types, two different floors. Picking one would be a
      // guess about a commercial term, so the tab fails and says which customer.
      throw new Error(
        `${customerId} has conflicting Min_GPM_Target values (${existing} and ${target}); ` +
          'the target is stored per contract, so the Sheet has to agree with itself per customer',
      )
    }
    targets.set(customerId, target)
  }
  return targets
}
