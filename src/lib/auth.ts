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

/** Only Commercial users write. The VP role is monitoring and approval alone. */
export const canEditContracts = (profile: ProfileRow): boolean => profile.role === 'commercial'

export const canDecideScenarios = (profile: ProfileRow): boolean => profile.role === 'vp'
