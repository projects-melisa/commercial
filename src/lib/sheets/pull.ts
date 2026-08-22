import {
  openSheet,
  readAncillary,
  readMarginTargets,
  readPenalties,
  readReceivables,
  readSheet,
  type ReadRange,
} from '@/lib/sheets/read-sheet'

/**
 * The daily pull: Google Sheet → Supabase.
 *
 * This is the only direction that exists. The mirror that wrote the other way was
 * deleted rather than merely unscheduled, because it cleared each tab before writing
 * and could therefore replace hand-maintained data with an older copy — and code that
 * still exists is code that can still be pressed.
 *
 * Two rules the seed does not have to follow, and this must:
 *
 *   1. **Upsert on a natural key, never delete-then-insert.** `pnpm seed:generate`
 *      replaces the whole database, which is right for a seed and catastrophic on a
 *      schedule: one accidentally emptied tab would take production with it.
 *   2. **Fail per tab, not per run.** A malformed Ancillary row must not stop the
 *      contracts from refreshing, so each tab records its own outcome.
 *
 * Rows that vanish from the Sheet are left alone and counted as stale, never deleted,
 * for the same reason.
 */

export interface TabResult {
  tab: string
  rows: number
  /** Rows still in the table that this run did not touch. Reported, never deleted. */
  stale: number | null
  error: string | null
}

const required = (key: string): string => {
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not set — see .env.example`)
  return value
}

const serviceHeaders = (): Record<string, string> => {
  const key = required('SUPABASE_SERVICE_ROLE_KEY')
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

/**
 * Upserts a batch through PostgREST.
 *
 * `resolution=merge-duplicates` updates only the columns the payload carries, which is
 * what keeps `min_gpm_target` — a value the Sheet has no column for — from being
 * nulled out on every contract, every night.
 */
const upsert = async (
  table: string,
  onConflict: string,
  rows: unknown[],
  // Ancillary_Data alone passed 8,155 rows (±2 MB of JSON) through one POST and was
  // growing ~380 rows a month. Chunked so one tab cannot outrun the body limit.
  CHUNK = 1000,
): Promise<number> => {
  let written = 0
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  for (let from = 0; from < rows.length; from += CHUNK) {
    const response = await fetch(
      `${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      {
        method: 'POST',
        headers: {
          ...serviceHeaders(),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows.slice(from, from + CHUNK)),
      },
    )
    if (!response.ok) throw new Error(`${table}: ${await response.text()}`)
    written += Math.min(CHUNK, rows.length - from)
  }
  return written
}

/** Rows this run left behind, for tables that carry a `synced_at` stamp. */
const countStale = async (table: string, startedAt: string): Promise<number | null> => {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const response = await fetch(
    `${url}/rest/v1/${table}?select=*&synced_at=lt.${encodeURIComponent(startedAt)}`,
    { headers: { ...serviceHeaders(), Prefer: 'count=exact', Range: '0-0' }, cache: 'no-store' },
  )
  if (!response.ok) return null
  const total = response.headers.get('content-range')?.split('/')[1]
  return total === undefined || total === '*' ? null : Number(total)
}

/** Runs one tab, turning a throw into a recorded failure rather than a dead run. */
const tab = async (
  name: string,
  run: () => Promise<{ rows: number; stale?: number | null }>,
): Promise<TabResult> => {
  try {
    const { rows, stale = null } = await run()
    return { tab: name, rows, stale, error: null }
  } catch (error) {
    return { tab: name, rows: 0, stale: null, error: (error as Error).message }
  }
}

export const pullFromSheets = async (
  startedAt: string,
  values?: ReadRange,
): Promise<TabResult[]> => {
  const read = values ?? (await openSheet())

  // CRM_Data, Compiled_Contracts and CS_Data arrive together because `readSheet`
  // checks referential integrity across all three before returning any of them: a
  // contract pointing at a customer the Sheet no longer lists is a source error worth
  // failing on, not a foreign-key violation to discover halfway through the insert.
  const core = await tab('Compiled_Contracts', async () => {
    const { customers, contracts, cases } = await readSheet()

    await upsert(
      'customers',
      'customer_id',
      customers.map((row) => ({
        customer_id: row.customerId,
        nama: row.nama,
        rfm_status: row.rfmStatus,
        frequency_score: row.frequencyScore,
        monetary_score: row.monetaryScore,
        recency_score: row.recencyScore,
        tipe: row.tipe,
      })),
    )

    const rows = await upsert(
      'contracts',
      'contract_no,cabang',
      contracts.map((row) => ({
        contract_no: row.contractNo,
        customer_id: row.customerId,
        cabang: row.cabang,
        business_line: row.businessLine,
        contract_start_date: row.contractStartDate,
        contract_end_date: row.contractEndDate,
        tarif: row.tarif,
        cost: row.cost,
        pic_nama: row.picNama,
        pic_telepon: row.picTelepon,
        pic_email: row.picEmail,
        remarks: row.remarks,
        latest_contract: row.latestContract,
        updated_at: new Date().toISOString(),
      })),
    )

    await upsert(
      'cases',
      'customer_id,description',
      cases.map((row) => ({
        customer_id: row.customerId,
        description: row.description,
        status: row.status,
      })),
    )

    return { rows }
  })

  const receivables = await tab('Receivable_Data', async () => {
    const rows = await readReceivables(read)
    await upsert(
      'receivables',
      'customer_id',
      rows.map(({ customerId, ...buckets }) => ({
        ...buckets,
        customer_id: customerId,
        synced_at: new Date().toISOString(),
      })),
    )
    return { rows: rows.length, stale: await countStale('receivables', startedAt) }
  })

  const ancillary = await tab('Ancillary_Data', async () => {
    const rows = await readAncillary(read)
    await upsert(
      'ancillary_revenues',
      // The key is the full width the row identifies itself by — group_2_gl and
      // group_3_gl included, so two GL lines for one customer on one day stay two
      // rows instead of one silently overwriting the other (audit D-1).
      'cab,plan_actual,customer,periode,group_1_gl,group_2_gl,group_3_gl',
      rows.map((row) => ({
        cab: row.cab,
        plan_actual: row.planActual,
        customer: row.customer,
        periode: row.periode,
        tahun: row.tahun,
        production: row.production,
        total: row.total,
        text_pl: row.textPl,
        group_1_gl: row.group1Gl,
        group_2_gl: row.group2Gl,
        group_3_gl: row.group3Gl,
        synced_at: new Date().toISOString(),
      })),
    )
    return { rows: rows.length, stale: await countStale('ancillary_revenues', startedAt) }
  })

  // Runs after the contracts upsert, and updates one column and nothing else.
  //
  // `min_gpm_target` is deliberately absent from the contracts payload: PostgREST's
  // merge-duplicates only writes the columns it is given, and including a column the
  // Sheet's contract tab does not have would null every target in the book nightly.
  // The target lives in a different tab, so it is written by a different statement.
  const targets = await tab('Revenue_Data', async () => {
    const byCustomer = await readMarginTargets(read)
    const url = required('NEXT_PUBLIC_SUPABASE_URL')
    let touched = 0

    for (const [customerId, target] of byCustomer) {
      const response = await fetch(
        `${url}/rest/v1/contracts?customer_id=eq.${encodeURIComponent(customerId)}`,
        {
          method: 'PATCH',
          headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
          body: JSON.stringify({ min_gpm_target: target }),
        },
      )
      // A customer in Revenue_Data with no contract is C-08, not a failure: rows for
      // CUST-010 upward exist there and nowhere else. PATCH simply matches nothing.
      if (!response.ok) throw new Error(`contracts.min_gpm_target: ${await response.text()}`)
      touched += 1
    }

    return { rows: touched }
  })

  const penalties = await tab('Penalty_Data', async () => {
    const rows = await readPenalties(read)
    await upsert(
      'penalties',
      'customer_id,deskripsi,dilaporkan_pada',
      rows.map((row) => ({
        customer_id: row.customerId,
        deskripsi: row.deskripsi,
        nilai: row.nilai,
        cabang_asal: row.cabangAsal,
        tahap: row.tahap,
        dilaporkan_pada: row.dilaporkanPada,
        synced_at: new Date().toISOString(),
      })),
    )
    return { rows: rows.length, stale: await countStale('penalties', startedAt) }
  })

  return [core, targets, receivables, ancillary, penalties]
}

/**
 * Records one row per tab, so a run that half-failed reads as exactly that.
 *
 * Written under the service role: `sheet_syncs` has no insert policy, because a run
 * record a user could forge would report health that never happened.
 */
export const recordRun = async (
  results: TabResult[],
  trigger: 'schedule' | 'manual',
  startedAt: string,
): Promise<void> => {
  const url = required('NEXT_PUBLIC_SUPABASE_URL')
  const finishedAt = new Date().toISOString()

  const response = await fetch(`${url}/rest/v1/sheet_syncs`, {
    method: 'POST',
    headers: { ...serviceHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify(
      results.map((result) => ({
        tab: result.tab,
        status: result.error === null ? 'ok' : 'failed',
        trigger,
        rows_written: result.rows,
        error: result.error?.slice(0, 500) ?? null,
        started_at: startedAt,
        finished_at: finishedAt,
      })),
    ),
  })
  if (!response.ok) {
    console.warn(`[sheets] could not record the run: ${await response.text()}`)
  }
}
