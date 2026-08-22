/**
 * Constants shared between `@/lib/data/domains` (server-only, pulls in
 * `next/headers` through the Supabase server client) and client components that
 * only need these values. Kept in their own module so a client component can
 * import them without dragging the server client into its bundle.
 */

export const AGING_BUCKETS = [
  ['d0_30', '0–30'],
  ['d31_60', '31–60'],
  ['d61_90', '61–90'],
  ['d91_120', '91–120'],
  ['d121_150', '121–150'],
  ['d151_180', '151–180'],
  ['d181_360', '181–360'],
  ['d360_plus', '>360'],
] as const

export type AgingKey = (typeof AGING_BUCKETS)[number][0]

/**
 * The stages a penalty stands at, in the order the ideal flow runs them.
 *
 * The order is for display only. Nothing enforces it, because the documents describe
 * two routes — the ideal one through the station, and the real one where Commercial
 * hears first — and a system that enforced the ideal would make somebody record a
 * step that never happened.
 */
export const TAHAP_LABELS: Record<string, string> = {
  dilaporkan: 'Dilaporkan',
  divalidasi_cabang: 'Divalidasi cabang',
  klaim_terbit: 'Klaim terbit',
  dilaporkan_ke_op: 'Dilaporkan ke OP',
  ditutup: 'Ditutup',
}

export const TAHAP_ORDER = Object.keys(TAHAP_LABELS)
