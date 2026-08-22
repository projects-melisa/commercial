import { notFound, redirect } from 'next/navigation'
import type { Route } from 'next'

import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'
import type { ProfileRow } from '@/lib/supabase/types'

type AppModule = Database['public']['Enums']['app_module']
type GrantAction = Database['public']['Enums']['grant_action']

/**
 * The signed-in user's profile — the only source of role and business line.
 *
 * Nothing the client sends influences this. The same profile row drives both the UI
 * affordances and the RLS policies, so what a user is offered and what the database
 * will actually give them cannot disagree.
 */
export const getProfile = async (): Promise<ProfileRow | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data ?? null
}

export const requireProfile = async (): Promise<ProfileRow> => {
  const profile = await getProfile()
  // A session without a profile cannot be scoped, so it is treated as no session.
  if (!profile) redirect('/masuk')
  return profile
}

/**
 * What the signed-in user may touch, read from the same table the policies read.
 *
 * The predicate this replaced said "everyone but the VP writes". That was true while
 * there were three roles and the VP was the one exception; with nine it silently
 * granted six more, and nothing failed to say so. Naming roles in the interface at
 * all is the mistake — the interface asks the grant table, exactly as
 * `caller_may(module, action)` does inside every policy, so an offered button and an
 * accepted write cannot disagree.
 *
 * Read through RLS as the caller: `role_module_grants` is readable by anyone signed
 * in, so this needs no elevated key.
 */
export type Grants = ReadonlySet<string>

/**
 * The caller's own grants — and the `role` filter is load-bearing, not tidiness.
 *
 * `role_module_grants` is deliberately readable in full by everyone signed in, because
 * the policies need it legible and it holds no business data. That makes an unfiltered
 * select here return *every* role's grants, so every `may()` answers yes and the whole
 * interface gate quietly evaporates. This is the one place a query in this codebase
 * narrows by the caller's own attribute on purpose: the row-level security is what is
 * missing, so the filter has to be here.
 *
 * The database is unaffected either way — `caller_may()` re-derives the role inside
 * each policy — so the failure this prevents is an offered button that leads to a
 * refused write, not a leak.
 */
export const getGrants = async (role: ProfileRow['role']): Promise<Grants> => {
  const supabase = await createClient()
  const { data } = await supabase.from('role_module_grants').select('modul, aksi').eq('role', role)
  return new Set((data ?? []).map((g) => `${g.modul}:${g.aksi}`))
}

export const may = (grants: Grants, modul: AppModule, aksi: GrantAction): boolean =>
  grants.has(`${modul}:${aksi}`)

/** The profile and its grants together, which is what a page almost always wants. */
export const requireCaller = async (): Promise<{ profile: ProfileRow; grants: Grants }> => {
  const profile = await requireProfile()
  return { profile, grants: await getGrants(profile.role) }
}

/**
 * The caller's scope in words, as a noun phrase that reads after "untuk" or "pada".
 *
 * Station first: a GM Cabang carries no business line because they cover every line
 * at their own airport, so leading with the line would say the opposite of what the
 * policies do. Both dimensions are named when a profile happens to carry both.
 */
export const scopeLabel = (profile: ProfileRow): string => {
  const lini = profile.business_line ? `lini ${profile.business_line}` : null
  if (profile.cabang) return lini ? `${lini} di Cabang ${profile.cabang}` : `Cabang ${profile.cabang}`
  return lini ?? 'seluruh lini bisnis'
}

/**
 * The caller's profile and grants, refusing the page outright when a grant is absent.
 *
 * `notFound()` rather than a redirect or an "access denied" screen: a page that exists
 * but is empty still tells the caller the module exists and that somebody else can see
 * it. A 404 says nothing at all, which is the only honest answer to a request the
 * caller has no business making.
 *
 * This is a second lock, not the lock. The database refuses the rows regardless — the
 * point here is that a caller without the grant never reaches a query in the first
 * place, so an empty table cannot be mistaken for an empty scope.
 */
export const requireGrant = async (
  modul: AppModule,
  aksi: GrantAction,
): Promise<{ profile: ProfileRow; grants: Grants }> => {
  const caller = await requireCaller()
  if (!may(caller.grants, modul, aksi)) notFound()
  return caller
}

/**
 * Whether a caller sees both cards on `/pilih`, not just one.
 *
 * `docs/Gapura OneClick Commercial.md` §5 routes `finance_kps`, `op_kps`, `os_kps` and
 * `ocs_kps` through `/pilih` deliberately, with only "Kontrak Commercial" rendered —
 * `landingFor` below keeps that. This predicate is for the sidebar's workspace
 * switcher, which is a different question: not "does this caller reach `/pilih`" but
 * "does switching mean anything for them once they're past it".
 */
export const hasWorkspaceChoice = (grants: Grants): boolean =>
  may(grants, 'kontrak', 'view') && may(grants, 'pendapatan', 'view')

/**
 * Where a caller belongs after signing in.
 *
 * Keyed on `kontrak:view` rather than on a role name. Everyone who can read contracts
 * lands on `/pilih` — the bento renders one card or two depending on `pendapatan:view`,
 * per `docs/Gapura OneClick Commercial.md` §5. A GM Cabang and a super admin each have
 * exactly one place to be and skip the chooser entirely.
 */
export const landingFor = (grants: Grants): Route => {
  if (may(grants, 'kontrak', 'view')) return '/pilih'
  if (may(grants, 'pendapatan', 'view')) return '/pendapatan'
  if (may(grants, 'pengguna', 'manage')) return '/pengguna'
  return '/pengaturan'
}
