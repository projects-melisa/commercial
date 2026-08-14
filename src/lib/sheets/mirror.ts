/**
 * The Google Sheets mirror payload.
 *
 * ⚠ The direction of travel has reversed and this has not caught up. The Sheet is now
 * the source of truth — `scripts/lib/read-sheet.ts` reads it into the database — while
 * this writes the database back over the Sheet, clearing each tab first. Running it
 * today would overwrite the hand-maintained `Compiled_Contracts`, `CS_Data` and
 * `CRM_Data` with a strictly older copy of themselves.
 *
 * The daily `g-cme-daily-sheets-mirror` cron has been unscheduled on the hosted
 * project for that reason. `pnpm sheets:sync` and `/api/sheets/sync` still work and
 * are still dangerous; they are left in place rather than deleted because removing a
 * documented feature is a decision for whoever owns the spec.
 *
 * Reproduces the source workbook's four sheets with identical headers — including
 * `Revenue_Data`'s duplication of tarif and cost, which the database drops on import
 * — so formulas and pivots built against the original workbook keep resolving.
 *
 * Building the payload is kept separate from writing it: the shape is the part with
 * rules worth getting right, and it can be inspected without a Google account.
 */

export interface MirrorContract {
  customer_id: string
  customer_nama: string
  business_line: string
  service_type: string
  contract_end_date: string
  tarif: number
  cost: number
  min_gpm_target: number
  rfm_status: string
}

export interface MirrorCase {
  customer_id: string
  description: string
  status: string
}

export interface SheetPayload {
  /** Sheet tab name, exactly as in the source workbook. */
  name: string
  /** Header row followed by data rows. */
  values: (string | number)[][]
}

/**
 * `Revenue_Data`'s second column is headed `ServiceType` but holds the business line,
 * cased differently per line. The mirror reproduces the quirk rather than correcting
 * it: a pivot in someone's spreadsheet may well be keyed on the exact string.
 */
const REVENUE_BUSINESS_LINE: Record<string, string> = {
  'Ground Handling': 'Ground Handling',
  'Cargo Handling': 'CARGO & WAREHOUSING',
  'Ancillary Business': 'ANCILLARY BUSINESS',
}

/** The workbook writes the target as both a fraction and a percentage: "0.25 (25%)". */
const formatGpmTarget = (fraction: number): string =>
  `${fraction.toFixed(2)} (${Math.round(fraction * 100)}%)`

export const buildMirror = (
  contracts: MirrorContract[],
  cases: MirrorCase[],
): SheetPayload[] => {
  const ordered = [...contracts].sort((a, b) => a.customer_id.localeCompare(b.customer_id))

  return [
    {
      name: 'Compiled_Contracts',
      values: [
        [
          'CustomerID',
          'CustomerName',
          'BusinessLine',
          'ServiceType',
          'ContractEndDate',
          'Tarif_Existing (IDR)/handling',
          'Cost_Existing (IDR)/handling',
        ],
        ...ordered.map((c) => [
          c.customer_id,
          c.customer_nama,
          c.business_line,
          c.service_type,
          c.contract_end_date,
          Number(c.tarif),
          Number(c.cost),
        ]),
      ],
    },
    {
      name: 'CS_Data',
      values: [
        ['CustomerID', 'CaseDescription', 'CaseStatus'],
        ...[...cases]
          .sort((a, b) => a.customer_id.localeCompare(b.customer_id))
          .map((c) => [c.customer_id, c.description, c.status]),
      ],
    },
    {
      name: 'Revenue_Data',
      values: [
        [
          'CustomerID',
          'ServiceType',
          'Tarif_Existing (IDR)',
          'Cost_Existing (IDR)',
          'Min_GPM_Target (%)',
        ],
        ...ordered.map((c) => [
          c.customer_id,
          REVENUE_BUSINESS_LINE[c.business_line] ?? c.business_line,
          Number(c.tarif),
          Number(c.cost),
          formatGpmTarget(Number(c.min_gpm_target)),
        ]),
      ],
    },
    {
      name: 'CRM_Data',
      values: [
        ['CustomerID', 'CustomerName', 'RFM_Status'],
        ...ordered.map((c) => [c.customer_id, c.customer_nama, c.rfm_status]),
      ],
    },
  ]
}
