'use client'

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { StatusBand } from '@/lib/domain'

export const STATUS_COLORS: Record<StatusBand, string> = {
  Aman: '#16a34a',
  'Perlu Perhatian': '#d97706',
  Kritis: '#dc2626',
  Nonaktif: '#6b7280',
}

const AXIS = { fontSize: 11, fill: '#6b7280' }

/**
 * Every chart is paired with a table or list elsewhere on the page, and each carries
 * a text summary for assistive technology, so no figure exists only as a picture.
 */
const ChartFrame = ({
  judul,
  ringkasan,
  children,
}: {
  judul: string
  ringkasan: string
  children: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <h3 className="mb-4 text-sm font-bold text-gray-900">{judul}</h3>
    <p className="sr-only-text">{ringkasan}</p>
    <div className="h-56 w-full" aria-hidden="true">
      {children}
    </div>
  </section>
)

export const StatusDonut = ({ data }: { data: { name: StatusBand; value: number }[] }) => (
  <ChartFrame
    judul="Sebaran Status Kontrak"
    ringkasan={data.map((d) => `${d.name}: ${d.value} kontrak`).join('. ')}
  >
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  </ChartFrame>
)

export const CompositionBar = ({
  data,
  judul,
  ringkasan,
}: {
  data: { name: string; value: number }[]
  judul: string
  ringkasan: string
}) => (
  <ChartFrame judul={judul} ringkasan={ringkasan}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={AXIS} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={120} />
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
        <Bar dataKey="value" fill="#1a5c3a" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartFrame>
)

export const ExpiryTimeline = ({ data }: { data: { bulan: string; jumlah: number }[] }) => (
  <ChartFrame
    judul="Linimasa Berakhirnya Kontrak"
    ringkasan={data.map((d) => `${d.bulan}: ${d.jumlah} kontrak`).join('. ')}
  >
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -20, right: 8 }}>
        <XAxis dataKey="bulan" tick={AXIS} />
        <YAxis tick={AXIS} allowDecimals={false} />
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, 'Berakhir']} />
        <Bar dataKey="jumlah" fill="#2d7a52" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartFrame>
)

export const MarginHistogram = ({
  data,
}: {
  data: { rentang: string; jumlah: number }[]
}) => (
  <ChartFrame
    judul="Distribusi Margin (GPM)"
    ringkasan={data.map((d) => `${d.rentang}: ${d.jumlah} kontrak`).join('. ')}
  >
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -20, right: 8 }}>
        <XAxis dataKey="rentang" tick={AXIS} />
        <YAxis tick={AXIS} allowDecimals={false} />
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
        <Bar dataKey="jumlah" fill="#1a5c3a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </ChartFrame>
)
