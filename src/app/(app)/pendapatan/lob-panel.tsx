import { Boxes, CircleSlash, Users, Wallet } from 'lucide-react'

import { StatCard } from '@/components/dashboard/stat-card'
import { KlasifikasiBatang, KlasifikasiCincin, RfmSebaran } from '@/components/revenue/charts'
import { DetailTable } from '@/app/(app)/pendapatan/detail-table'
import { EmptyState } from '@/components/ui/states'
import { DIMENSI, peringkatBy, type RevenueRow } from '@/lib/data/revenue'
import {
  AMBANG_STATUS,
  SEGMEN_TIPE,
  STATUSES,
  standingFor,
  tally,
  type CustomerRfm,
} from '@/lib/data/rfm'
import { Ranking } from '@/components/revenue/tables'
import { formatMeasure, formatRupiah, RFM_STATUSES, type RfmStatus } from '@/lib/domain'

export type { CustomerRfm }

export interface LobSub {
  slug: string
  label: string
  segmen: 'B2B' | 'B2C'
  judul: string
  ringkas: string
}

export const LOB_SUBS: readonly LobSub[] = [
  {
    slug: 'b2c',
    label: 'B2C RFM Analysis',
    segmen: 'B2C',
    judul: 'Pelanggan perorangan (Non-Agent)',
    ringkas:
      'Orang yang membeli langsung — nama pribadi, bukan badan usaha. Di tracker Anda ini kolom Non Agent.',
  },
  {
    slug: 'b2b',
    label: 'B2B RFM Analysis',
    segmen: 'B2B',
    judul: 'Agen dan korporat (Agent)',
    ringkas:
      'Travel agent, hotel, korporat dan instansi. Di tracker Anda ini tabel Agent Detail.',
  },
]

/** Worth, from CRM_Data — the client's own wording for each band, kept verbatim. */
const KLASIFIKASI_ARTI: Record<RfmStatus, string> = {
  HIGH: 'Pelanggan yang sering transaksi dan menghasilkan revenue tinggi.',
  MEDIUM: 'Pelanggan yang transaksinya sedang dan menghasilkan revenue menengah.',
  LOW: 'Pelanggan yang jarang transaksi dan menghasilkan revenue kecil.',
}

const KLASIFIKASI_LABEL: Record<RfmStatus, string> = {
  HIGH: 'High Value',
  MEDIUM: 'Middle Value',
  LOW: 'Low Value',
}

const KLASIFIKASI_WARNA: Record<RfmStatus, string> = {
  HIGH: '#1a5c3a',
  MEDIUM: '#2d7a52',
  LOW: '#a9d6c0',
}

const STATUS_WARNA = {
  Active: '#166534',
  Risk: '#92400e',
  Dormant: '#b45309',
  Lost: '#991b1b',
} as const

/**
 * The RFM board for one half of the customer base.
 *
 * Laid out the way the client's own Joumpa tracker lays it out: a headcount, the
 * classification split as both a ring and a bar, the definitions written out, and then
 * the detail table that people actually work from.
 *
 * Two columns, deliberately kept apart. **Classification** is worth and comes from
 * `CRM_Data`; **Status** is life and is derived here from how long the silence has
 * run. A HIGH customer sitting at Dormant is the most valuable row on the page and
 * neither column alone would surface them.
 */
export const LobPanel = ({
  sub,
  rows,
  customers,
  tahun,
  lob,
}: {
  sub: LobSub
  rows: RevenueRow[]
  customers: CustomerRfm[]
  tahun: number
  lob: string
}) => {
  const semua = standingFor(rows, customers, tahun, new Date())
  const board = semua.filter((row) => row.tipe === SEGMEN_TIPE[sub.segmen])
  // Customers the Sheet has not classified belong on neither board. Counted here so
  // they are visible rather than silently missing from both totals.
  const belumDiklasifikasi = semua.filter((row) => row.tipe === null).length

  const pendapatan = board.reduce((sum, row) => sum + row.pendapatan, 0)
  const produksi = board.reduce((sum, row) => sum + row.produksi, 0)

  const perKlasifikasi = tally(board, RFM_STATUSES, (row) => row.klasifikasi)
  const perStatus = tally(board, STATUSES, (row) => row.status)

  const irisan = perKlasifikasi.map((row) => ({
    nama: KLASIFIKASI_LABEL[row.kunci],
    jumlah: row.jumlah,
    warna: KLASIFIKASI_WARNA[row.kunci],
    customers: board.filter((c) => c.klasifikasi === row.kunci).map((c) => c.nama),
  }))

  const header = (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-bold text-gray-900">{sub.judul}</h2>
      <p className="mt-1 text-sm text-gray-400">{sub.ringkas}</p>
      <p className="mt-2 text-xs text-gray-400">
        Seluruh isi <code>CRM_Data</code> diperlakukan sebagai Agent: tabel itu memang CRM
        korporat, dan pembeli perorangan tidak ada di dalamnya — bukan sekadar tidak berlabel.
        Menebaknya dari bentuk nama sudah dicoba dan dibuang, karena membaca &quot;Citilink&quot;
        sebagai orang. Butuh kolom <code>Customer Type</code> di Sheet — butir C-17. Status hidup
        (Active / Risk / Dormant / Lost) diturunkan dari jeda transaksi, bukan dari kolom
        tersimpan — butir C-18.
      </p>
    </div>
  )

  if (board.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          judul={`Belum ada pelanggan ${sub.segmen} pada LoB ${lob}`}
          keterangan={
            sub.segmen === 'B2C'
              ? 'Tidak ada pelanggan perorangan yang bertransaksi pada kombinasi filter ini. Perorangan hanya membeli JOUMPA (premium services), jadi menyaring ke LoB lain akan mengosongkan papan ini.'
              : 'Tidak ada pelanggan badan usaha yang bertransaksi pada kombinasi filter ini.'
          }
        />
      </>
    )
  }

  return (
    <>
      {header}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total customer"
          value={String(board.length)}
          keterangan={`bertransaksi pada ${tahun}`}
          icon={Users}
        />
        <StatCard label={`Revenue ${tahun}`} value={formatRupiah(pendapatan)} icon={Wallet} />
        <StatCard
          label={`Production ${tahun}`}
          value={formatMeasure('unit', produksi)}
          icon={Boxes}
        />
        <StatCard
          label="Tidak aktif"
          value={String(
            perStatus
              .filter((row) => row.kunci !== 'Active')
              .reduce((sum, row) => sum + row.jumlah, 0),
          )}
          keterangan="Risk, Dormant atau Lost"
          icon={CircleSlash}
          tone={perStatus.find((row) => row.kunci === 'Active')?.jumlah === board.length ? 'good' : 'warn'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <KlasifikasiCincin
          data={irisan}
          rows={rows}
          tahun={tahun}
          judul="Klasifikasi pelanggan"
          keterangan="Bentuk keseluruhan buku pelanggan, dengan jumlah dan porsinya tertulis di tiap irisan."
        />
        <KlasifikasiBatang
          data={irisan}
          rows={rows}
          tahun={tahun}
          judul="Klasifikasi pelanggan — jumlah"
          keterangan="Cincin di sebelah menjawab bentuk; batang ini menjawab mana yang terbesar, persisnya."
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold text-gray-900">Arti klasifikasi</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          {RFM_STATUSES.map((status) => (
            <div key={status} className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-gray-700">
                {KLASIFIKASI_LABEL[status]} Customer
              </dt>
              <dd className="text-gray-400">{KLASIFIKASI_ARTI[status]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-400">
          Status hidup memakai ambang sementara: Active ≤ {AMBANG_STATUS.active} hari sejak
          transaksi terakhir, Risk ≤ {AMBANG_STATUS.risk}, Dormant ≤ {AMBANG_STATUS.dormant}, Lost
          di atas itu. Tracker Anda menampilkan kolom yang sama tanpa menyebut angkanya.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <RfmSebaran
          data={board.map((row) => ({
            nama: row.nama,
            frequency: row.frequency ?? 0,
            monetary: row.monetary ?? 0,
            recency: row.recency ?? 0,
            rfm: row.klasifikasi,
            pendapatan: row.pendapatan,
          }))}
          rows={rows}
          tahun={tahun}
        />
        <KlasifikasiBatang
          data={perStatus.map((row) => ({
            nama: row.kunci,
            jumlah: row.jumlah,
            warna: STATUS_WARNA[row.kunci],
            customers: board.filter((c) => c.status === row.kunci).map((c) => c.nama),
          }))}
          rows={rows}
          tahun={tahun}
          judul="Status hidup pelanggan"
          keterangan="Berapa lama sejak masing-masing terakhir bertransaksi."
        />
      </div>

      <DetailTable board={board} rows={rows} tahun={tahun} segmen={sub.segmen} />

      <Ranking
        judul={`Peringkat cabang — ${sub.segmen}`}
        keterangan="Di bandara mana segmen ini benar-benar berjalan."
        kolom="Cabang"
        baris={peringkatBy(
          rows.filter((row) => board.some((b) => b.nama === row.customer)),
          tahun,
          'rupiah',
          DIMENSI.cabang,
        )}
        measure="rupiah"
        tahun={tahun}
        rows={rows.filter((row) => board.some((b) => b.nama === row.customer))}
        dimensiKey="cabang"
      />
    </>
  )
}

