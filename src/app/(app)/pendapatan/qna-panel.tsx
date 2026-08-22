import Link from 'next/link'
import { ChevronRight, X } from 'lucide-react'
import type { Route } from 'next'

import { DIMENSI, type RevenueRow } from '@/lib/data/revenue'
import { formatMeasure, formatPercent, type Measure } from '@/lib/domain'

/**
 * The decomposition tree.
 *
 * One number at the root, broken apart a level at a time: which line of business, then
 * which station, then which customer. Every column is sorted largest first and drawn to
 * a common scale, so the answer to "where did it go" is the top bar of the next column
 * rather than something to be worked out.
 *
 * Driven entirely by the URL and rendered on the server. Each node is a link, so a
 * particular path through the tree is shareable, survives a reload, and works before
 * any JavaScript has run — which matters for a page whose whole job is being quoted in
 * a meeting.
 */

interface Level {
  kunci: string
  label: string
  ambil: (row: RevenueRow) => string | null
}

/**
 * The dimensions a level can be cut by.
 *
 * HUB is deliberately absent. The client's tree has a HUB column between LoB and
 * Airport — CGK (1), DPS (2), SUB (4) — grouping several airports under one hub, and
 * nothing in the Sheet or in the `cabang` table records that grouping. Inventing one
 * would put real revenue under a made-up parent. Recorded as C-19.
 */
export const LEVELS: readonly Level[] = [
  { kunci: 'lob', label: 'LoB (group 1 GL)', ambil: DIMENSI.lob },
  { kunci: 'group2', label: 'group 2 GL', ambil: DIMENSI.group2 },
  { kunci: 'group3', label: 'group 3 GL', ambil: DIMENSI.group3 },
  { kunci: 'textpl', label: 'text P/L', ambil: DIMENSI.textPl },
  { kunci: 'cabang', label: 'Airport', ambil: DIMENSI.cabang },
  { kunci: 'customer', label: 'Name', ambil: DIMENSI.customer },
]

const DEFAULT_JALUR = ['lob', 'cabang', 'customer']

const levelOf = (kunci: string): Level | undefined => LEVELS.find((l) => l.kunci === kunci)

/** `lob:JOUMPA` — the dimension and, when one has been clicked, the value chosen at it. */
const parse = (raw: string): { kunci: string; nilai: string | null }[] =>
  raw
    .split('|')
    .filter((part) => part !== '')
    .map((part) => {
      const [kunci = '', ...rest] = part.split(':')
      const nilai = rest.join(':')
      return { kunci, nilai: nilai === '' ? null : decodeURIComponent(nilai) }
    })
    .filter((step) => levelOf(step.kunci) !== undefined)

const serialise = (steps: { kunci: string; nilai: string | null }[]): string =>
  steps
    .map((s) => (s.nilai === null ? s.kunci : `${s.kunci}:${encodeURIComponent(s.nilai)}`))
    .join('|')

const KOSONG = '(tanpa keterangan)'

export const QnaPanel = ({
  rows,
  tahun,
  measure,
  jalurRaw,
  basePath,
  query,
}: {
  rows: RevenueRow[]
  tahun: number
  measure: Measure
  jalurRaw: string
  /** The route the node links point back at, so filters and year survive a drill. */
  basePath: string
  query: URLSearchParams
}) => {
  const steps = jalurRaw === '' ? DEFAULT_JALUR.map((kunci) => ({ kunci, nilai: null })) : parse(jalurRaw)
  const aktual = rows.filter((row) => row.tahun === tahun && row.plan_actual === 'Actual')
  const akar = aktual.reduce((sum, row) => sum + Number(row.total), 0)

  const hrefFor = (next: { kunci: string; nilai: string | null }[]): Route => {
    const params = new URLSearchParams(query)
    const jalur = serialise(next)
    if (jalur === '') params.delete('jalur')
    else params.set('jalur', jalur)
    const q = params.toString()
    return (q ? `${basePath}?${q}` : basePath) as Route
  }

  // Each column is filtered by every choice made to its left — that is what makes it a
  // decomposition rather than six independent rankings side by side.
  const kolom = steps.map((step, index) => {
    const level = levelOf(step.kunci)!
    const tersaring = aktual.filter((row) =>
      steps
        .slice(0, index)
        .every((prev) => prev.nilai === null || (levelOf(prev.kunci)!.ambil(row) ?? KOSONG) === prev.nilai),
    )

    const buckets = new Map<string, number>()
    for (const row of tersaring) {
      const nama = level.ambil(row) ?? KOSONG
      buckets.set(nama, (buckets.get(nama) ?? 0) + Number(row.total))
    }
    const nodes = [...buckets.entries()]
      .map(([nama, nilai]) => ({ nama, nilai }))
      .sort((a, b) => b.nilai - a.nilai)

    const puncak = nodes[0]?.nilai ?? 0
    return { step, level, nodes, puncak, index }
  })

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900">Decomposition Tree</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Aktual {tahun} dipecah setingkat demi setingkat. Klik satu simpul untuk menelusuri; tiap
          kolom hanya berisi bagian dari simpul yang dipilih di sebelah kirinya. Jalur tersimpan di
          URL, jadi bisa dibagikan apa adanya.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Tingkat
          </span>
          {steps.map((step, index) => (
            <span key={`${step.kunci}-${index}`} className="flex items-center gap-1">
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                {levelOf(step.kunci)!.label}
                {step.nilai ? <span className="text-primary"> · {step.nilai}</span> : null}
              </span>
              <Link
                href={hrefFor(steps.filter((_, i) => i !== index))}
                aria-label={`Hapus tingkat ${levelOf(step.kunci)!.label}`}
                className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={12} aria-hidden="true" />
              </Link>
              {index < steps.length - 1 ? (
                <ChevronRight size={12} className="text-gray-300" aria-hidden="true" />
              ) : null}
            </span>
          ))}

          {LEVELS.filter((l) => !steps.some((s) => s.kunci === l.kunci)).map((level) => (
            <Link
              key={level.kunci}
              href={hrefFor([...steps, { kunci: level.kunci, nilai: null }])}
              className="rounded-lg border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-gray-400 hover:border-primary hover:text-primary"
            >
              + {level.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="relative overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-3">
          {/* The root: one figure, so the columns to its right always add back to it. */}
          <section className="w-56 shrink-0 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
              Actual Revenue {tahun}
            </p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-gray-900">
              {formatMeasure(measure, akar)}
            </p>
            <p className="mt-1 text-xs text-gray-400">{aktual.length} baris</p>
          </section>

          {kolom.map(({ step, level, nodes, puncak, index }) => (
            <section
              key={`${step.kunci}-${index}`}
              className="w-64 shrink-0 rounded-xl border border-gray-200 bg-white"
            >
              <h3 className="border-b border-gray-200 px-3 py-2 text-xs font-bold text-gray-700">
                {level.label}
              </h3>
              <ul className="max-h-96 overflow-y-auto">
                {nodes.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-gray-400">Tidak ada baris.</li>
                ) : (
                  nodes.map((node) => {
                    const dipilih = step.nilai === node.nama
                    const next = steps.map((s, i) =>
                      i < index ? s : i === index ? { ...s, nilai: dipilih ? null : node.nama } : { ...s, nilai: null },
                    )
                    return (
                      <li key={node.nama} className="border-b border-gray-100 last:border-0">
                        <Link
                          href={hrefFor(next)}
                          aria-current={dipilih ? 'true' : undefined}
                          className={`block px-3 py-2 transition-colors ${
                            dipilih ? 'bg-primary/10' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className={`block truncate text-xs ${
                              dipilih ? 'font-bold text-primary' : 'font-medium text-gray-700'
                            }`}
                            title={node.nama}
                          >
                            {node.nama}
                          </span>
                          <span className="mt-0.5 block text-xs tabular-nums text-gray-500">
                            {formatMeasure(measure, node.nilai)}
                            {akar > 0 ? (
                              <span className="ml-1 text-gray-400">
                                {formatPercent(node.nilai / akar)}
                              </span>
                            ) : null}
                          </span>
                          {/* The bar is scaled to the biggest node in its own column, so
                              a deep branch stays readable instead of collapsing to a
                              sliver against the root. */}
                          <span
                            aria-hidden="true"
                            className="mt-1 block h-1 rounded-full bg-gray-100"
                          >
                            <span
                              className={`block h-1 rounded-full ${dipilih ? 'bg-primary' : 'bg-primary-light'}`}
                              style={{ width: `${puncak === 0 ? 0 : (node.nilai / puncak) * 100}%` }}
                            />
                          </span>
                        </Link>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Tingkat <strong>HUB</strong> belum ada. Tracker Anda menaruhnya antara LoB dan Airport —
        CGK (1), DPS (2), SUB (4) — mengelompokkan beberapa bandara di bawah satu hub, dan
        pengelompokan itu tidak tercatat di Sheet maupun di tabel <code>cabang</code>. Mengarangnya
        berarti menaruh pendapatan nyata di bawah induk yang tidak ada. Lihat butir C-19.
      </p>
    </div>
  )
}
