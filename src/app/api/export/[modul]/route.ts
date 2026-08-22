import { createClient } from '@/lib/supabase/server'
import { may, requireCaller } from '@/lib/auth'
import { listReceivables } from '@/lib/data/domains'
import { listRevenue } from '@/lib/data/revenue'

/**
 * U-6 · export is its own right, and it leaves a trace.
 *
 * A tidy RBAC still leaks through an export button: one click turns scoped rows into
 * an unscoped file on someone's laptop. So exporting is granted separately from view
 * (`*:export` on role_module_grants — cabang holds none of it until the client says
 * otherwise) and every export is written to activity_log through log_activity(), the
 * one sanctioned write path into the audit trail.
 */

type Modul = 'pendapatan' | 'piutang' | 'penalty'

const csv = (header: string[], rows: (string | number | null)[][]): string =>
  [
    header.join(','),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const text = cell === null ? '' : String(cell)
          // Quote only when needed, escape quotes the way RFC 4180 says.
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
        })
        .join(','),
    ),
  ].join('\n')

const EXPORTS: Record<
  Modul,
  { modulAudit: string; build: () => Promise<{ header: string[]; rows: (string | number | null)[][] }> }
> = {
  pendapatan: {
    modulAudit: 'Ancillary_Data',
    build: async () => {
      const rows = await listRevenue()
      return {
        header: ['cab', 'plan_actual', 'customer', 'periode', 'tahun', 'production', 'total', 'group_1_gl', 'group_2_gl', 'group_3_gl', 'text_pl'],
        rows: rows.map((r) => [r.cab, r.plan_actual, r.customer, r.periode, r.tahun, r.production, r.total, r.group_1_gl, r.group_2_gl, r.group_3_gl, r.text_pl]),
      }
    },
  },
  piutang: {
    modulAudit: 'Receivable_Data',
    build: async () => {
      const rows = await listReceivables()
      return {
        header: ['customer_id', 'nama', 'status', 'd0_30', 'd31_60', 'd61_90', 'd91_120', 'd121_150', 'd151_180', 'd181_360', 'd360_plus', 'total'],
        rows: rows.map((r) => [
          r.customerId, r.customerNama, r.status,
          ...Object.values(r.buckets).map(Number),
          r.total,
        ]),
      }
    },
  },
  penalty: {
    modulAudit: 'Penalty_Data',
    build: async () => {
      const { listPenalties } = await import('@/lib/data/domains')
      const rows = await listPenalties()
      return {
        header: ['pelanggan', 'uraian', 'nilai', 'cabang_asal', 'tahap', 'divalidasi_pada', 'dilaporkan_pada'],
        rows: rows.map((r) => [r.customerNama, r.deskripsi, r.nilai, r.cabangAsal, r.tahap, r.divalidasiPada, r.dilaporkanPada]),
      }
    },
  },
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ modul: string }> },
): Promise<Response> {
  const { modul } = await params
  if (!(modul in EXPORTS)) return new Response('tidak dikenal', { status: 404 })

  const spec = EXPORTS[modul as Modul]
  // The grant is checked before any query runs: RLS would hand an unauthorised caller
  // empty tables, and "no data" must not be the face of "not yours to take".
  // `requireCaller` rather than `requireGrant` — a 404 page throw has no meaning here.
  const { grants } = await requireCaller()
  if (!may(grants, modul as Modul, 'export')) {
    return new Response('forbidden', { status: 403 })
  }

  const supabase = await createClient()
  const { header, rows } = await spec.build()

  await supabase.rpc('log_activity', {
    aksi: 'ekspor',
    detail: { modul: spec.modulAudit, baris: rows.length },
  })

  return new Response('\uFEFF' + csv(header, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${modul}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
