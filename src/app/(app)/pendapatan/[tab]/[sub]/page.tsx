import { RevenueView, type RevenueSearchParams } from '@/app/(app)/pendapatan/view'

export const metadata = { title: 'Pendapatan — Gapura Commercial' }

export default async function PendapatanSubTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string; sub: string }>
  searchParams: Promise<RevenueSearchParams>
}) {
  const { tab, sub } = await params
  return <RevenueView tab={tab} sub={sub} searchParams={searchParams} />
}
