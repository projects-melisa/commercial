import { RevenueView, type RevenueSearchParams } from '@/app/(app)/pendapatan/view'

export const metadata = { title: 'Pendapatan — Gapura Commercial' }

export default async function PendapatanPage({
  searchParams,
}: {
  searchParams: Promise<RevenueSearchParams>
}) {
  return <RevenueView tab={undefined} sub={undefined} searchParams={searchParams} />
}
