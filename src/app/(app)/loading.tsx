import { PageSkeleton } from '@/components/ui/states'

/** Shown while a page's data is in flight, so the interface never appears frozen. */
export default function AppLoading() {
  return <PageSkeleton />
}
