/**
 * Reads Master_Database_Komersial_Compiled.xlsx without a spreadsheet dependency.
 *
 * The workbook is a Google Sheets export: every data cell is an IMPORTRANGE formula
 * whose last cached <v> holds the value. That cached value is what we read, so the
 * figures here are the ones the workbook actually shows.
 */
import { execFileSync } from 'node:child_process'

export const BUSINESS_LINES = [
  'Ground Handling',
  'Cargo & Warehouse',
  'Ancillary Business',
] as const
export type BusinessLine = (typeof BUSINESS_LINES)[number]

export type RfmStatus = 'HIGH' | 'MEDIUM' | 'LOW'
export type CaseStatus = 'OPEN' | 'CLOSED'

export interface SourceContract {
  customerId: string
  customerName: string
  businessLine: BusinessLine
  serviceType: string
  /** The workbook's own end date, ISO. */
  sourceEndDate: string
  tarif: number
  cost: number
  /** Fraction, e.g. 0.25 — carried from Revenue_Data.Min_GPM_Target. */
  minGpmTarget: number
  rfmStatus: RfmStatus
}

export interface SourceCase {
  customerId: string
  description: string
  status: CaseStatus
}

export interface Workbook {
  contracts: SourceContract[]
  cases: SourceCase[]
}

type Cell = string | number | null
type Sheet = Cell[][]

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')

const columnIndex = (ref: string): number => {
  const letters = /^[A-Z]+/.exec(ref)![0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** Excel 1900-system serial to ISO date, including the deliberate 1900 leap-year bug. */
const serialToIsoDate = (serial: number): string =>
  new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000).toISOString().slice(0, 10)

const readSheets = (workbookPath: string): Map<string, Sheet> => {
  const entry = (name: string): string =>
    execFileSync('unzip', ['-p', workbookPath, name], { maxBuffer: 64 * 1024 * 1024 }).toString(
      'utf8',
    )

  const shared = [...entry('xl/sharedStrings.xml').matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
    [...m[1]!.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((t) => decodeEntities(t[1]!)).join(''),
  )

  const rels = Object.fromEntries(
    [...entry('xl/_rels/workbook.xml.rels').matchAll(/<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(
      (m) => [m[1]!, m[2]!],
    ),
  )

  const sheets = new Map<string, Sheet>()
  for (const m of entry('xl/workbook.xml').matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const xml = entry('xl/' + rels[m[2]!]!.replace(/^\/?xl\//, ''))
    const rows: Sheet = []
    for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
      const cells: Cell[] = []
      for (const cellMatch of rowMatch[2]!.matchAll(/<c\s([^>]*?)\/?>(?:(.*?)<\/c>)?/gs)) {
        const ref = /r="([A-Z]+\d+)"/.exec(cellMatch[1]!)?.[1]
        if (!ref) continue
        const type = /t="([^"]+)"/.exec(cellMatch[1]!)?.[1]
        const body = cellMatch[2] ?? ''
        const inline = /<is>.*?<t[^>]*>(.*?)<\/t>.*?<\/is>/s.exec(body)?.[1]
        // The LAST <v> is the cached result of the cell's formula.
        const values = [...body.matchAll(/<v>(.*?)<\/v>/gs)].map((v) => decodeEntities(v[1]!))
        let value: Cell = null
        if (inline !== undefined) value = decodeEntities(inline)
        else if (values.length > 0) {
          const raw = values[values.length - 1]!
          if (type === 's') value = shared[Number(raw)] ?? null
          else if (type === 'str' || type === 'e') value = raw
          else if (raw !== '' && !Number.isNaN(Number(raw))) value = Number(raw)
          else value = raw
        }
        cells[columnIndex(ref)] = value
      }
      rows.push(cells)
    }
    sheets.set(m[1]!, rows)
  }
  return sheets
}

const dataRows = (sheet: Sheet): Cell[][] =>
  sheet.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ''))

const text = (cell: Cell, field: string): string => {
  if (typeof cell !== 'string' || cell.trim() === '') {
    throw new Error(`expected text for ${field}, got ${JSON.stringify(cell)}`)
  }
  return cell.trim()
}

const number = (cell: Cell, field: string): number => {
  if (typeof cell !== 'number' || !Number.isFinite(cell)) {
    throw new Error(`expected a number for ${field}, got ${JSON.stringify(cell)}`)
  }
  return cell
}

const businessLine = (raw: string): BusinessLine => {
  const match = BUSINESS_LINES.find((line) => line === raw)
  if (!match) throw new Error(`unrecognised business line: ${raw}`)
  return match
}

const rfmStatus = (raw: string): RfmStatus => {
  if (raw === 'HIGH' || raw === 'MEDIUM' || raw === 'LOW') return raw
  throw new Error(`unrecognised RFM status: ${raw}`)
}

const caseStatus = (raw: string): CaseStatus => {
  if (raw === 'OPEN' || raw === 'CLOSED') return raw
  throw new Error(`unrecognised case status: ${raw}`)
}

/** Revenue_Data stores the target as "0.25 (25%)"; only the fraction is meaningful. */
const gpmTarget = (cell: Cell, customerId: string): number => {
  if (typeof cell === 'number') return cell
  const parsed = Number.parseFloat(text(cell, `Min_GPM_Target for ${customerId}`))
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) {
    throw new Error(`unusable Min_GPM_Target for ${customerId}: ${JSON.stringify(cell)}`)
  }
  return parsed
}

export const readWorkbook = (workbookPath: string): Workbook => {
  const sheets = readSheets(workbookPath)
  const sheet = (name: string): Sheet => {
    const found = sheets.get(name)
    if (!found) throw new Error(`workbook is missing the ${name} sheet`)
    return found
  }

  // Revenue_Data duplicates tarif and cost from Compiled_Contracts. The duplication
  // is dropped here and only Min_GPM_Target is carried across.
  const targets = new Map<string, number>()
  for (const row of dataRows(sheet('Revenue_Data'))) {
    const id = text(row[0] ?? null, 'Revenue_Data.CustomerID')
    targets.set(id, gpmTarget(row[4] ?? null, id))
  }

  const rfm = new Map<string, RfmStatus>()
  for (const row of dataRows(sheet('CRM_Data'))) {
    rfm.set(
      text(row[0] ?? null, 'CRM_Data.CustomerID'),
      rfmStatus(text(row[2] ?? null, 'CRM_Data.RFM_Status')),
    )
  }

  const contracts = dataRows(sheet('Compiled_Contracts')).map((row): SourceContract => {
    const customerId = text(row[0] ?? null, 'Compiled_Contracts.CustomerID')
    const target = targets.get(customerId)
    const standing = rfm.get(customerId)
    if (target === undefined) throw new Error(`no Min_GPM_Target for ${customerId}`)
    if (standing === undefined) throw new Error(`no RFM_Status for ${customerId}`)

    return {
      customerId,
      customerName: text(row[1] ?? null, `CustomerName for ${customerId}`),
      businessLine: businessLine(text(row[2] ?? null, `BusinessLine for ${customerId}`)),
      serviceType: text(row[3] ?? null, `ServiceType for ${customerId}`),
      sourceEndDate: serialToIsoDate(number(row[4] ?? null, `ContractEndDate for ${customerId}`)),
      tarif: number(row[5] ?? null, `Tarif_Existing for ${customerId}`),
      cost: number(row[6] ?? null, `Cost_Existing for ${customerId}`),
      minGpmTarget: target,
      rfmStatus: standing,
    }
  })

  const cases = dataRows(sheet('CS_Data')).map((row): SourceCase => {
    const customerId = text(row[0] ?? null, 'CS_Data.CustomerID')
    return {
      customerId,
      description: text(row[1] ?? null, `CaseDescription for ${customerId}`),
      status: caseStatus(text(row[2] ?? null, `CaseStatus for ${customerId}`)),
    }
  })

  return { contracts, cases }
}
