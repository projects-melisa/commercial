'use client'

import { useRevenueDrillDown } from '@/components/revenue/drill-down'
import type { CustomerStanding } from '@/lib/data/rfm'
import type { RevenueRow } from '@/lib/data/revenue-pure'
import { formatMeasure, formatRupiah, formatTanggal } from '@/lib/domain'
import { STATUS_TONE } from '@/lib/data/rfm'

const KLASIFIKASI_LABEL = { HIGH: 'High Value', MEDIUM: 'Middle Value', LOW: 'Low Value' } as const

const Pil = ({ teks, tone }: { teks: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) => {
  const kelas = {
    good: 'bg-green-100 text-sem-ok',
    warn: 'bg-amber-100 text-sem-warn',
    bad: 'bg-red-100 text-sem-bad',
    neutral: 'bg-gray-100 text-gray-600',
  } as const
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kelas[tone]}`}>
      {teks}
    </span>
  )
}

/**
 * The working table — the client's "Agent Detail", column for column.
 *
 * Sorted by revenue rather than by name: the row somebody needs to act on is nearly
 * always near the top, and an alphabetical list buries it. Status and classification
 * both carry a word as well as a colour.
 *
 * Every cell click shows that customer's own `Ancillary_Data` rows for the year — the
 * table's own numbers are already per-customer, so there is no further dimension to
 * cut by; the drill-down is one hop, straight to the source rows.
 */
export const DetailTable = ({
  board,
  rows,
  tahun,
  segmen,
}: {
  board: CustomerStanding[]
  rows: RevenueRow[]
  tahun: number
  segmen: string
}) => {
  const { show, dialog } = useRevenueDrillDown()

  const pick = (nama: string) =>
    show(
      `${nama} — Aktual ${tahun}`,
      rows.filter((r) => r.customer === nama && r.tahun === tahun && r.plan_actual === 'Actual'),
    )

  return (
    // `relative` is load-bearing: the visually-hidden caption inside a horizontal scroll
    // container is position:absolute, and without a positioned ancestor it resolves
    // against the initial containing block and drags the page sideways on a phone.
    <section className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">
          Detail {segmen === 'B2B' ? 'agen' : 'pelanggan'}
        </h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Urut menurut revenue. Klasifikasi adalah nilai pelanggan; status adalah seberapa lama dia
          diam. Baris High yang berstatus Dormant adalah yang paling perlu ditindaklanjuti. Klik satu
          baris untuk melihat baris Ancillary_Data pelanggan itu.
        </p>
      </div>
      <table className="w-full min-w-[52rem] text-sm">
        <caption className="sr-only-text">
          Detail pelanggan: status, klasifikasi, produksi, revenue dan transaksi terakhir
        </caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
            <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">Nama</th>
            <th scope="col" className="px-3 py-2.5 text-left">Status</th>
            <th scope="col" className="px-3 py-2.5 text-left">Klasifikasi</th>
            <th scope="col" className="px-3 py-2.5 text-right">Production</th>
            <th scope="col" className="px-3 py-2.5 text-right">Revenue</th>
            <th scope="col" className="px-3 py-2.5 text-right">Transaksi terakhir</th>
            <th scope="col" className="px-4 py-2.5 text-right">Tanggal</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {board.map((row) => (
            <tr key={row.nama} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <th scope="row" className="p-0 text-left">
                <button
                  type="button"
                  onClick={() => pick(row.nama)}
                  className="sticky left-0 block w-full bg-white px-4 py-2 text-left font-medium text-gray-700 hover:bg-gray-100"
                >
                  {row.nama}
                </button>
              </th>
              <td className="p-0">
                <button type="button" onClick={() => pick(row.nama)} className="block w-full px-3 py-2 text-left hover:bg-gray-100">
                  <Pil teks={row.status} tone={STATUS_TONE[row.status]} />
                </button>
              </td>
              <td className="p-0">
                <button type="button" onClick={() => pick(row.nama)} className="block w-full px-3 py-2 text-left hover:bg-gray-100">
                  <Pil
                    teks={KLASIFIKASI_LABEL[row.klasifikasi]}
                    tone={row.klasifikasi === 'HIGH' ? 'good' : row.klasifikasi === 'MEDIUM' ? 'neutral' : 'warn'}
                  />
                </button>
              </td>
              <td className="p-0 text-right">
                <button
                  type="button"
                  onClick={() => pick(row.nama)}
                  className="block w-full px-3 py-2 text-right text-gray-600 hover:bg-gray-100"
                >
                  {formatMeasure('unit', row.produksi)}
                </button>
              </td>
              <td className="p-0 text-right">
                <button
                  type="button"
                  onClick={() => pick(row.nama)}
                  className="block w-full px-3 py-2 text-right font-semibold text-gray-900 hover:bg-gray-100"
                >
                  {formatRupiah(row.pendapatan)}
                </button>
              </td>
              <td className="p-0 text-right">
                <button
                  type="button"
                  onClick={() => pick(row.nama)}
                  className="block w-full px-3 py-2 text-right text-gray-600 hover:bg-gray-100"
                >
                  {row.hariSejakTransaksi === null ? '—' : `${row.hariSejakTransaksi} hari`}
                </button>
              </td>
              <td className="p-0 text-right">
                <button
                  type="button"
                  onClick={() => pick(row.nama)}
                  className="block w-full px-4 py-2 text-right text-gray-400 hover:bg-gray-100"
                >
                  {row.transaksiTerakhir === null ? '—' : formatTanggal(row.transaksiTerakhir)}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
        Sheet menyimpan satu baris per bulan, jadi &quot;transaksi terakhir&quot; dihitung dari awal
        bulan terakhir yang berisi angka — bukan dari tanggal transaksi sebenarnya, yang tidak ada di
        sumber.
      </p>
      {dialog}
    </section>
  )
}
