import { Building2 } from 'lucide-react'

import { SignInForm } from '@/app/masuk/sign-in-form'
import { DEMO_ACCOUNTS, demoAccountLabel } from '@/lib/demo-accounts'

export const metadata = { title: 'Masuk — G-CME' }

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sidebar-from to-sidebar-to px-4 py-10">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-primary-dark to-primary p-8 text-white md:flex">
          <div>
            <div className="mb-6 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15">
                <Building2 size={20} aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-extrabold">G-CME</p>
                <p className="text-xs text-white/70">Contract &amp; Margin Engine</p>
              </div>
            </div>
            <h1 className="text-2xl font-bold">
              Pemantauan Kontrak Komersial &amp; Simulator P&amp;L Dinamis
            </h1>
            <p className="mt-3 text-sm text-white/80">
              Kontrak, target margin, standing pelanggan dan kasus layanan dalam satu
              basis data yang diatur aksesnya per lini bisnis.
            </p>
          </div>

          <dl className="mt-8 space-y-2 text-sm">
            {DEMO_ACCOUNTS.map((account) => (
              <div key={account.email} className="rounded-lg bg-white/10 px-3 py-2">
                <dt className="font-semibold">
                  {account.nama} · {demoAccountLabel(account)}
                </dt>
                <dd className="text-xs text-white/70">{account.keterangan}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-900">Masuk ke akun Anda</h2>
          <p className="mt-1 mb-6 text-sm text-gray-500">
            Gunakan email dan kata sandi yang terdaftar.
          </p>
          <SignInForm next={next ?? '/'} />
        </div>
      </div>
    </main>
  )
}
