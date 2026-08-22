'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'

import { signIn, type SignInState } from '@/app/masuk/actions'
import { DEMO_ACCOUNTS, demoAccountLabel, type DemoAccount } from '@/lib/demo-accounts'

const SubmitButton = () => {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#1a5c3a] to-[#2d7a52] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#1a5c3a]/15 transition-all duration-200 hover:shadow-lg hover:shadow-[#1a5c3a]/25 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <LogIn size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      )}
      {pending ? 'Memproses…' : 'Masuk'}
    </button>
  )
}

export const SignInForm = ({
  next,
  selectedAccount,
}: {
  next: string
  selectedAccount?: DemoAccount | null
}) => {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, { error: null })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const emailId = useId()
  const passwordId = useId()
  const personaId = useId()

  /*
   * When the parent shell selects a demo account (via the cards on the left
   * panel), mirror that into the email/password fields — identical to what
   * the old `<select>` onChange did.
   */
  useEffect(() => {
    if (selectedAccount) {
      setEmail(selectedAccount.email)
      setPassword(selectedAccount.password)
    }
  }, [selectedAccount])

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      {/* ── Mobile-only persona picker (left-panel cards are hidden on small screens) ── */}
      <div className="lg:hidden">
        <label htmlFor={personaId} className="mb-1.5 block text-sm font-semibold text-gray-700">
          Akun Demo
        </label>
        <select
          id={personaId}
          // Deliberately not part of the submitted credentials: choosing a persona
          // fills the fields below and has no bearing on the role that is granted.
          name="persona"
          defaultValue=""
          onChange={(event) => {
            const account = DEMO_ACCOUNTS.find((a) => a.email === event.target.value)
            if (!account) return
            setEmail(account.email)
            setPassword(account.password)
          }}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-700 transition-colors focus:border-[#1a5c3a] focus:outline-none"
          aria-describedby={`${personaId}-help`}
        >
          <option value="" disabled>
            Pilih persona untuk mengisi kredensial…
          </option>
          {DEMO_ACCOUNTS.map((account) => (
            <option key={account.email} value={account.email}>
              {account.nama} — {demoAccountLabel(account)}
            </option>
          ))}
        </select>
        <p id={`${personaId}-help`} className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-400">
          <ShieldCheck size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          Pilihan ini hanya mengisi kolom di bawah. Hak akses ditentukan oleh akun itu
          sendiri di basis data, bukan oleh pilihan ini.
        </p>
      </div>

      {/* ── Email field ──────────────────────────────────────────────── */}
      <div>
        <label htmlFor={emailId} className="mb-2 block text-sm font-semibold text-gray-700">
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-300"
            aria-hidden="true"
          />
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nama@gapura.test"
            className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-3 pr-4 pl-10 text-sm text-gray-900 placeholder-gray-300 transition-colors focus:border-[#1a5c3a] focus:bg-white focus:shadow-sm focus:shadow-[#1a5c3a]/5 focus:outline-none"
          />
        </div>
      </div>

      {/* ── Password field ───────────────────────────────────────────── */}
      <div>
        <label htmlFor={passwordId} className="mb-2 block text-sm font-semibold text-gray-700">
          Kata Sandi
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute top-1/2 left-3.5 -translate-y-1/2 text-gray-300"
            aria-hidden="true"
          />
          <input
            id={passwordId}
            name="password"
            type={passwordVisible ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-gray-200 bg-gray-50/60 py-3 pr-11 pl-10 text-sm text-gray-900 placeholder-gray-300 transition-colors focus:border-[#1a5c3a] focus:bg-white focus:shadow-sm focus:shadow-[#1a5c3a]/5 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            // The label carries the state rather than aria-pressed: a screen reader
            // otherwise announces "pressed" without saying what is now on screen.
            aria-label={passwordVisible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            aria-controls={passwordId}
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg p-2 text-gray-300 transition-colors hover:text-gray-500 focus-visible:text-gray-500"
          >
            {passwordVisible ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}
