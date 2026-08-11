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
 * The donut's legend, rendered from the data rather than by Recharts.
 *
 * Two things needed fixing and both live here: Recharts sorts its own legend
 * alphabetically — so it read in a different order from the sectors it labels, and v3
 * no longer accepts a `payload` override — and it colours each label with the series
 * colour, which puts amber at 3.19:1 and green at 3.3:1 on white. The swatch carries
 * the colour; the label is body grey.
 */
const StatusLegend = ({ data }: { data: { name: StatusBand; value: number }[] }) => (
  <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-gray-700">
    {data.map((d) => (
      <li key={d.name} className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-[2px]"
          style={{ background: STATUS_COLORS[d.name] }}
        />
        {d.name}
      </li>
    ))}
  </ul>
)

/**
 * Recharts' mount animation is JS-driven, so the reduced-motion block in globals.css
 * cannot reach it. Four charts sweeping in on every page load is scattered motion
 * rather than one authored moment, so it is off everywhere instead of conditionally.
 */
const STILL = { isAnimationActive: false } as const

/**
 * Every chart is paired with a table or list elsewhere on the page, and each carries
 * a text summary for assistive technology, so no figure exists only as a picture.
 *
 * The plot is `inert`, not merely `aria-hidden`: Recharts puts `tabindex="0"` on its
 * surface and pie layers, which under aria-hidden alone became tab stops that
 * announce nothing.
 */
const ChartFrame = ({
  judul,
  ringkasan,
  tinggi = 224,
  children,
}: {
  judul: string
  ringkasan: string
  tinggi?: number
  children: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <h2 className="mb-4 text-sm font-bold text-gray-900">{judul}</h2>
    <p className="sr-only-text">{ringkasan}</p>
    <div className="w-full" style={{ height: tinggi }} aria-hidden="true" inert>
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
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} {...STILL}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
        <Legend content={<StatusLegend data={data} />} />
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
  // 28px a category, so every bar keeps its label. At the fixed 224px frame Recharts
  // silently dropped every other tick, leaving ten bars sharing five names — including
  // the largest bar, which had none. The axis is sized to the longest label so short
  // categories stop spending a third of a phone's width on empty gutter.
  <ChartFrame judul={judul} ringkasan={ringkasan} tinggi={Math.max(224, data.length * 28)}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={AXIS} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS}
          interval={0}
          width={Math.min(120, 12 + Math.max(0, ...data.map((d) => d.name.length)) * 6)}
        />
        <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
        <Bar dataKey="value" fill="#1a5c3a" radius={[0, 4, 4, 0]} {...STILL} />
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
        <Bar dataKey="jumlah" fill="#2d7a52" radius={[4, 4, 0, 0]} {...STILL} />
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
        <Bar dataKey="jumlah" fill="#1a5c3a" radius={[4, 4, 0, 0]} {...STILL} />
      </BarChart>
    </ResponsiveContainer>
  </ChartFrame>
)
