import { createClient } from '@/lib/supabase/server'
import type { RevenueRow } from '@/lib/data/revenue-pure'

export * from '@/lib/data/revenue-pure'

/**
 * Ancillary revenue, read through RLS exactly as the contract queries are.
 *
 * No `.eq('cab', …)` at the query, deliberately. A GM Cabang is confined by the policy
 * on `ancillary_revenues`, not by a filter written here — adding one "to be safe" would
 * hide a policy mistake rather than prevent it, and would keep working on the day the
 * policy stopped. The filters below are the *user's* filters, applied to rows the
 * database has already decided they may see.
 */

/**
 * Every row in scope, paged past PostgREST's default ceiling.
 *
 * That ceiling is 1000 rows and it is applied silently — no error, no flag on the
 * response, just a short array. With 1056 rows in the book it cost the last 56, which
 * showed up as an RKAP of Rp 136 M against a real Rp 155,9 M and a November that
 * appeared to have no budget at all. A total that is quietly wrong is worse than a
 * page that fails, because nobody re-checks a number that rendered.
 *
 * ponytail: pages the whole table into memory and aggregates in JS. Fine for a book
 * this size; move the aggregation into a SQL view once it outgrows a few thousand rows.
 */
const PAGE = 1000

export const listRevenue = async (): Promise<RevenueRow[]> => {
  const supabase = await createClient()
  const rows: RevenueRow[] = []

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ancillary_revenues')
      .select(
        'cab, plan_actual, customer, periode, tahun, production, total, group_1_gl, group_2_gl, group_3_gl, text_pl',
      )
      .order('periode')
      .order('id')
      .range(from, from + PAGE - 1)

    if (error || !data) break
    rows.push(...data)
    // A short page is the last page. Ordering includes `id` so the pages cannot
    // interleave: `periode` alone is not unique here, and an unstable sort would drop
    // and duplicate rows across the boundary.
    if (data.length < PAGE) break
  }

  return rows
}
