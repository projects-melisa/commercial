import { RevenueView, type RevenueSearchParams } from '@/app/(app)/pendapatan/view'

export const metadata = { title: 'Pendapatan — Gapura Commercial' }

export default async function PendapatanTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string }>
  searchParams: Promise<RevenueSearchParams>
}) {
  const { tab } = await params
  return <RevenueView tab={tab} sub={undefined} searchParams={searchParams} />
}
