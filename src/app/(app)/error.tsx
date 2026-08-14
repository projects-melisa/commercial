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
    console.error('[Gapura Commercial]', error)
  }, [error])

  // The thrown message is a database or network string, in English, aimed at whoever
  // wrote the query. It goes to the console; the screen says what a Commercial user
  // can act on. `digest` is the thread back to the server log.
  return (
    <ErrorState
      keterangan="Terjadi kesalahan saat memuat data. Periksa koneksi Anda lalu coba lagi. Bila berulang, sebutkan kode berikut kepada tim teknis."
      onRetry={reset}
      kode={error.digest}
    />
  )
}
