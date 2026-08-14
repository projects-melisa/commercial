import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'

import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gapura Commercial — Contract & Margin Engine',
  description:
    'Pemantauan kontrak komersial dan simulator P&L dinamis untuk PT Gapura Angkasa.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
