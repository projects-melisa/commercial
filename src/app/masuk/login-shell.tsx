'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Shield, ChevronRight } from 'lucide-react'

import type { DemoAccount } from '@/lib/demo-accounts'
import { DEMO_ACCOUNTS, demoAccountLabel } from '@/lib/demo-accounts'
import { SignInForm } from '@/app/masuk/sign-in-form'

/**
 * Client shell that owns the shared state between the demo-account cards (left
 * panel) and the sign-in form (right panel). Clicking a card sets the selected
 * account, which the form picks up through props rather than its own internal
 * select — keeping the two panels in sync without a context provider.
 */
export const LoginShell = ({ next }: { next: string }) => {
  const [selectedAccount, setSelectedAccount] = useState<DemoAccount | null>(null)

  return (
    <main className="flex min-h-screen">
      {/* ═══ LEFT PANEL — Brand hero on emerald ═════════════════════ */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0f3d27] via-[#1a5c3a] to-[#145231] p-10 lg:flex lg:w-[52%] xl:p-14">
        {/* Subtle grid overlay */}
        <div className="login-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />

        {/* Decorative accent circles */}
        <div
          className="pointer-events-none absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-white/[0.04]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-[320px] w-[320px] rounded-full bg-white/[0.03]"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-center">
          {/* Logo */}
          <div className="login-card-enter mb-10">
            <Image
              src="/logo.png"
              alt="Gapura Airport Services"
              width={180}
              height={72}
              priority
              className="h-auto w-[160px] brightness-0 invert xl:w-[180px]"
            />
          </div>

          {/* Hero copy */}
          <div className="login-card-enter" style={{ animationDelay: '80ms' }}>
            <h1 className="text-3xl font-extrabold tracking-tight text-white xl:text-4xl">
              Gapura Commercial
            </h1>
            <p className="mt-2 text-sm font-semibold tracking-[0.2em] text-white/50 uppercase">
              Contract & Margin Engine
            </p>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/60">
              Pemantauan Kontrak Komersial & Simulator P&L Dinamis — kontrak,
              target margin, standing pelanggan dan kasus layanan dalam satu
              basis data yang diatur aksesnya per lini bisnis.
            </p>
          </div>

          {/* ── Demo account cards ───────────────────────────────── */}
          <div className="mt-10 space-y-2.5" role="group" aria-label="Kartu akun demo">
            <p
              className="login-card-enter mb-3 text-[11px] font-bold tracking-[0.2em] text-white/35 uppercase"
              style={{ animationDelay: '160ms' }}
            >
              Pilih akun demo
            </p>
            {DEMO_ACCOUNTS.map((account, i) => {
              const isSelected = selectedAccount?.email === account.email
              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => setSelectedAccount(account)}
                  className={`login-card-enter group flex w-full max-w-lg items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                    isSelected
                      ? 'border-white/25 bg-white/[0.12] shadow-lg shadow-black/10'
                      : 'border-white/[0.08] bg-white/[0.05] hover:border-white/[0.15] hover:bg-white/[0.08]'
                  }`}
                  style={{ animationDelay: `${200 + i * 80}ms` }}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      isSelected
                        ? 'bg-white text-[#1a5c3a]'
                        : 'bg-white/10 text-white/50 group-hover:bg-white/15 group-hover:text-white/70'
                    }`}
                  >
                    <Shield size={14} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold transition-colors ${isSelected ? 'text-white' : 'text-white/80 group-hover:text-white/90'}`}
                      >
                        {account.nama}
                      </span>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-white/[0.08] text-white/40'
                        }`}
                      >
                        {demoAccountLabel(account)}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-xs leading-relaxed transition-colors ${isSelected ? 'text-white/60' : 'text-white/35 group-hover:text-white/45'}`}
                    >
                      {account.keterangan}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`mt-1 shrink-0 transition-all ${
                      isSelected
                        ? 'translate-x-0 text-white/70 opacity-100'
                        : '-translate-x-1 text-white/20 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )
            })}
            <p
              className="login-card-enter flex items-start gap-1.5 pt-1 text-[11px] text-white/25"
              style={{ animationDelay: '440ms' }}
            >
              <Shield size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
              Pilihan ini hanya mengisi kolom masuk. Hak akses ditentukan oleh akun di
              basis data.
            </p>
          </div>
        </div>

        {/* Footer on green panel */}
        <p className="relative z-10 mt-8 text-[11px] text-white/20">
          © {new Date().getFullYear()} PT Gapura Angkasa
        </p>
      </div>

      {/* ═══ DIVIDER — vertical accent line ═════════════════════════ */}
      <div className="relative hidden lg:block">
        <div className="absolute inset-y-0 -left-px w-px bg-gradient-to-b from-transparent via-[#1a5c3a]/20 to-transparent" />
      </div>

      {/* ═══ RIGHT PANEL — Sign-in form on white ═══════════════════ */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12 md:px-12 lg:px-16">
        {/* Mobile logo — shows only when left panel is hidden */}
        <div className="login-card-enter mb-8 lg:hidden">
          <Image
            src="/logo.png"
            alt="Gapura Airport Services"
            width={140}
            height={56}
            priority
            className="h-auto w-[120px]"
          />
          <h1 className="mt-3 text-xl font-extrabold text-gray-900">Gapura Commercial</h1>
          <p className="text-xs font-semibold tracking-[0.15em] text-[#1a5c3a]/60 uppercase">
            Contract & Margin Engine
          </p>
        </div>

        <div className="login-form-enter w-full max-w-[400px]" style={{ animationDelay: '120ms' }}>
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Masuk ke akun Anda</h2>
            <p className="mt-1.5 text-sm text-gray-400">
              Gunakan email dan kata sandi yang terdaftar.
            </p>
          </div>

          <SignInForm next={next} selectedAccount={selectedAccount} />

          {/* Mobile footer */}
          <p className="mt-10 text-center text-[11px] text-gray-300 lg:hidden">
            © {new Date().getFullYear()} PT Gapura Angkasa — Internal Use Only
          </p>
        </div>
      </div>
    </main>
  )
}
