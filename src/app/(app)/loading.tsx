import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/states'

/** Shown while a page's data is in flight, so the interface never appears frozen. */
export default function AppLoading() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <TableSkeleton />
      </div>
    </div>
  )
}
