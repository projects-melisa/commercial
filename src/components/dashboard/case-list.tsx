import Link from 'next/link'

import { DrillRow } from '@/components/ui/drill-down'
import type { Irregularity } from '@/lib/data/domains'

/**
 * The irregularity log, open cases first.
 *
 * The description is the whole point of the row — it is what somebody wrote down about
 * what went wrong — so it gets the width and wraps rather than truncating. The status
 * sits right of it, where the eye lands after reading.
 */
export const CaseList = ({ cases }: { cases: Irregularity[] }) => (
  // `relative` is not decoration: the visually-hidden caption below is absolutely
  // positioned, and `overflow-y: auto` makes the other axis scrollable too, so without
  // a containing block the caption resolves against the page and drags it sideways.
  <div className="relative max-h-[22rem] overflow-y-auto">
    <table className="w-full text-left text-sm">
      <caption className="sr-only-text">
        Daftar irregularity, {cases.length} baris, kasus terbuka lebih dulu.
      </caption>
      <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-500">
        <tr>
          <th scope="col" className="border-b border-gray-200 px-4 py-2.5 font-semibold">
            Deskripsi Kasus
          </th>
          <th scope="col" className="border-b border-gray-200 px-4 py-2.5 text-right font-semibold">
            Status
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {cases.map((kasus) => (
          <DrillRow key={kasus.id} kind="case" id={kasus.id} className="table-row">
            <td className="px-4 py-2.5">
              <p className="text-gray-700">{kasus.description}</p>
              <Link
                href={`/pelanggan/${kasus.customerId}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs font-semibold text-gray-500 hover:text-primary"
              >
                {kasus.customerNama}
              </Link>
            </td>
            <td className="px-4 py-2.5 text-right align-top">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  kasus.status === 'OPEN' ? 'bg-red-100 text-sem-bad' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    kasus.status === 'OPEN' ? 'bg-red-600' : 'bg-gray-400'
                  }`}
                  aria-hidden="true"
                />
                {kasus.status}
              </span>
            </td>
          </DrillRow>
        ))}
      </tbody>
    </table>
  </div>
)
