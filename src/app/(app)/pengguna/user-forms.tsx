'use client'

import { useActionState, useState } from 'react'
import { Ban, Check, ChevronDown, UserPlus } from 'lucide-react'

import {
  createUser,
  setUserActive,
  updateUser,
  type UserActionState,
} from '@/app/(app)/pengguna/actions'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { ROLE_LABELS } from '@/lib/domain'
import type { Database } from '@/lib/supabase/database.types'

type UserRole = Database['public']['Enums']['user_role']

const EMPTY: UserActionState = { error: null, ok: null }

export interface UserRow {
  id: string
  nama: string
  email: string
  role: UserRole
  businessLine: string | null
  cabang: string | null
  hub: string | null
  berlakuSampai: string | null
  active: boolean
}

const Feedback = ({ state }: { state: UserActionState }) =>
  state.error !== null || state.ok !== null ? (
    <p
      role="alert"
      className={`mt-2 text-xs ${state.error ? 'font-semibold text-sem-bad' : 'text-sem-ok'}`}
    >
      {state.error ?? state.ok}
    </p>
  ) : null

const RoleFields = ({
  roles,
  lines,
  stations,
  hubs,
  role,
  businessLine,
  cabang,
  hub,
  berlakuSampai,
  idPrefix,
}: {
  roles: { value: UserRole; label: string }[]
  lines: string[]
  stations: string[]
  hubs: string[]
  role?: UserRole
  businessLine?: string | null
  cabang?: string | null
  hub?: string | null
  berlakuSampai?: string | null
  idPrefix: string
}) => (
  <>
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Role</span>
      <select
        name="role"
        defaultValue={role ?? 'commercial_kps'}
        id={`${idPrefix}-role`}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      >
        {roles.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>

    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        Lini bisnis
      </span>
      <select
        name="business_line"
        defaultValue={businessLine ?? ''}
        id={`${idPrefix}-line`}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Semua lini</option>
        {lines.map((line) => (
          <option key={line} value={line}>
            {line}
          </option>
        ))}
      </select>
    </label>

    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        Cabang
      </span>
      <select
        name="cabang"
        defaultValue={cabang ?? ''}
        id={`${idPrefix}-cabang`}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Semua stasiun</option>
        {stations.map((station) => (
          <option key={station} value={station}>
            {station}
          </option>
        ))}
      </select>
    </label>

    {/* U-9 · regional scope: a hub instead of one station, never both. */}
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Hub</span>
      <select
        name="hub"
        defaultValue={hub ?? ''}
        id={`${idPrefix}-hub`}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      >
        <option value="">Tanpa hub</option>
        {hubs.map((h) => (
          <option key={h} value={h}>
            Hub {h}
          </option>
        ))}
      </select>
    </label>

    {/* U-8 · an access that expires itself beats a departure checklist. */}
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        Berlaku sampai
      </span>
      <input
        name="berlaku_sampai"
        type="date"
        defaultValue={berlakuSampai ?? ''}
        id={`${idPrefix}-berlaku`}
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      />
    </label>
  </>
)

export const CreateUserForm = ({
  roles,
  lines,
  stations,
  hubs,
}: {
  roles: { value: UserRole; label: string }[]
  lines: string[]
  stations: string[]
  hubs: string[]
}) => {
  const [state, action, pending] = useActionState(createUser, EMPTY)

  return (
    <form action={action} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900">
        <UserPlus size={16} aria-hidden="true" />
        Tambah pengguna
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Nama</span>
          <input
            name="nama"
            required
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">Email</span>
          <input
            name="email"
            type="email"
            required
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <RoleFields roles={roles} lines={lines} stations={stations} hubs={hubs} idPrefix="baru" />
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
            Kata sandi awal
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
        >
          {pending ? 'Menyimpan…' : 'Buat akun'}
        </button>
      </div>

      <Feedback state={state} />
    </form>
  )
}

const UserTableRow = ({
  user,
  roles,
  lines,
  stations,
  hubs,
  expanded,
  onToggle,
}: {
  user: UserRow
  roles: { value: UserRole; label: string }[]
  lines: string[]
  stations: string[]
  hubs: string[]
  expanded: boolean
  onToggle: () => void
}) => {
  const [state, action, pending] = useActionState(updateUser, EMPTY)
  const [activeState, activeAction, activePending] = useActionState(setUserActive, EMPTY)
  const scope = [user.businessLine, user.cabang, user.hub ? `Hub ${user.hub}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <tr className="table-row border-b border-gray-100 last:border-0">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex items-center gap-2 text-left"
          >
            <ChevronDown
              size={15}
              className={`shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-gray-900">{user.nama}</span>
              <span className="block truncate text-xs text-gray-400">{user.email}</span>
            </span>
          </button>
        </td>
        <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[user.role]}</td>
        <td className="px-4 py-3 text-gray-600">{scope || 'Semua cakupan'}</td>
        <td className="px-4 py-3">
          {user.active ? (
            <span className="rounded-full bg-sem-ok/10 px-2 py-0.5 text-xs font-semibold text-sem-ok">Aktif</span>
          ) : (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">Nonaktif</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <form action={activeAction}>
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="activate" value={String(!user.active)} />
            <button
              type="submit"
              disabled={activePending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              {user.active ? <Ban size={13} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
              {user.active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </form>
          <Feedback state={activeState} />
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-gray-100 bg-gray-50/60 last:border-0">
          <td colSpan={5} className="px-4 py-4">
            <form action={action} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="id" value={user.id} />
              <RoleFields
                roles={roles}
                lines={lines}
                stations={stations}
                hubs={hubs}
                role={user.role}
                businessLine={user.businessLine}
                cabang={user.cabang}
                hub={user.hub}
                berlakuSampai={user.berlakuSampai}
                idPrefix={user.id}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white disabled:opacity-60"
              >
                {pending ? 'Menyimpan…' : 'Simpan'}
              </button>
            </form>
            <Feedback state={state} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

export const UsersTable = ({
  users,
  roles,
  lines,
  stations,
  hubs,
}: {
  users: UserRow[]
  roles: { value: UserRole; label: string }[]
  lines: string[]
  stations: string[]
  hubs: string[]
}) => {
  const { page, setPage, pageCount, pageItems, total } = usePagination(users)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="scroll-hint relative overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only-text">Daftar pengguna, {total} akun.</caption>
          <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Pengguna</th>
              <th scope="col" className="px-4 py-3 font-semibold">Role</th>
              <th scope="col" className="px-4 py-3 font-semibold">Cakupan</th>
              <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              <th scope="col" className="px-4 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((user) => (
              <UserTableRow
                key={user.id}
                user={user}
                roles={roles}
                lines={lines}
                stations={stations}
                hubs={hubs}
                expanded={expandedId === user.id}
                onToggle={() => setExpandedId(expandedId === user.id ? null : user.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} />
    </div>
  )
}
