import { AGING_BUCKETS } from '@/lib/data/domains-constants'
import type { AgingRow } from '@/lib/data/domains'
import { formatRupiah, formatRupiahCompact } from '@/lib/domain'

/**
 * The receivable book as status × age, the shape Finance already reads it in.
 *
 * Cells are tinted by their share of the largest figure in the matrix rather than by
 * an absolute threshold: what counts as a lot of money differs by portfolio, and a
 * fixed scale would either paint everything or nothing. The tint is decoration — every
 * cell states its own amount, and the title attribute carries the unrounded figure
 * that the compact form hides.
 */
export const AgingMatrix = ({ rows, total }: { rows: AgingRow[]; total: AgingRow }) => {
  const peak = Math.max(
    1,
    ...rows.flatMap((row) => AGING_BUCKETS.map(([key]) => row.buckets[key])),
  )

  const tint = (value: number): string | undefined =>
    value <= 0 ? undefined : `rgb(185 28 28 / ${(0.05 + (value / peak) * 0.16).toFixed(3)})`

  const Cell = ({ value }: { value: number }) => (
    <td
      className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700 tabular-nums"
      style={{ background: tint(value) }}
      title={formatRupiah(value)}
    >
      {value === 0 ? <span className="text-gray-300">—</span> : formatRupiahCompact(value)}
    </td>
  )

  return (
    <div className="scroll-hint relative overflow-x-auto">
      <table className="w-full min-w-[52rem] text-left text-sm">
        <caption className="sr-only-text">
          Aging piutang per status.{' '}
          {rows
            .map(
              (row) =>
                `${row.status}: total ${formatRupiah(row.total)}, ${AGING_BUCKETS.map(
                  ([key, label]) => `${label} hari ${formatRupiah(row.buckets[key])}`,
                ).join(', ')}`,
            )
            .join('. ')}
        </caption>
        <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2.5 pl-4 font-semibold">
              Status
            </th>
            {AGING_BUCKETS.map(([key, label]) => (
              <th key={key} scope="col" className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                {label} hari
              </th>
            ))}
            <th scope="col" className="px-3 py-2.5 pr-4 text-right font-semibold">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.status}>
              <th scope="row" className="px-3 py-2.5 pl-4 font-semibold whitespace-nowrap text-gray-900">
                {row.status}
              </th>
              {AGING_BUCKETS.map(([key]) => (
                <Cell key={key} value={row.buckets[key]} />
              ))}
              <td className="px-3 py-2.5 pr-4 text-right font-bold whitespace-nowrap text-gray-900 tabular-nums">
                {formatRupiahCompact(row.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <th scope="row" className="px-3 py-2.5 pl-4 font-bold whitespace-nowrap text-gray-900">
              {total.status}
            </th>
            {AGING_BUCKETS.map(([key]) => (
              <td
                key={key}
                className="px-3 py-2.5 text-right font-semibold whitespace-nowrap text-gray-900 tabular-nums"
                title={formatRupiah(total.buckets[key])}
              >
                {total.buckets[key] === 0 ? (
                  <span className="text-gray-300">—</span>
                ) : (
                  formatRupiahCompact(total.buckets[key])
                )}
              </td>
            ))}
            <td className="px-3 py-2.5 pr-4 text-right font-extrabold whitespace-nowrap text-primary tabular-nums">
              {formatRupiahCompact(total.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
