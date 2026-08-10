'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react'

import { signIn, type SignInState } from '@/app/masuk/actions'
import { DEMO_ACCOUNTS, demoAccountLabel } from '@/lib/demo-accounts'

const SubmitButton = () => {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        <LogIn size={16} aria-hidden="true" />
      )}
      {pending ? 'Memproses…' : 'Masuk'}
    </button>
  )
}

export const SignInForm = ({ next }: { next: string }) => {
  const [state, formAction] = useActionState<SignInState, FormData>(signIn, { error: null })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const emailId = useId()
  const passwordId = useId()
  const personaId = useId()

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
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
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-primary"
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
        <p id={`${personaId}-help`} className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-500">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Pilihan ini hanya mengisi kolom di bawah. Hak akses ditentukan oleh akun itu
          sendiri di basis data, bukan oleh pilihan ini.
        </p>
      </div>

      <div>
        <label htmlFor={emailId} className="mb-1.5 block text-sm font-semibold text-gray-700">
          Email
        </label>
        <div className="relative">
          <Mail
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
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
            className="w-full rounded-lg border border-gray-300 py-2.5 pr-3 pl-9 text-sm focus:border-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor={passwordId} className="mb-1.5 block text-sm font-semibold text-gray-700">
          Kata Sandi
        </label>
        <div className="relative">
          <Lock
            size={16}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2.5 pr-3 pl-9 text-sm focus:border-primary"
          />
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}
