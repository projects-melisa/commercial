'use client'

import { useEffect } from 'react'

import { ErrorState } from '@/components/ui/states'

/**
 * The error boundary for every signed-in page.
 *
 * Data now comes from a server that can be unreachable or refuse a query, so a
 * failure has to say so and offer a way back rather than showing a blank screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[G-CME]', error)
  }, [error])

  return (
    <ErrorState
      keterangan={
        error.message ||
        'Terjadi kesalahan saat memuat data. Periksa koneksi Anda lalu coba lagi.'
      }
      onRetry={reset}
    />
  )
}
