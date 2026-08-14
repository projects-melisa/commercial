import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { ProfileRow } from '@/lib/supabase/types'

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
 * Everyone but the VP writes. Stated as an exception rather than as a list of roles
 * so it matches `caller_may_write()` in the database word for word: the VP role is
 * monitoring and approval alone, and every other role manages contracts.
 */
export const canEditContracts = (profile: ProfileRow): boolean => profile.role !== 'vp'

export const canDecideScenarios = (profile: ProfileRow): boolean => profile.role === 'vp'

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
