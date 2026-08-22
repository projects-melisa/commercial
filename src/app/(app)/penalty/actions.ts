'use server'

import { revalidatePath } from 'next/cache'

import { requireGrant } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * U-2 · the station's validation, recorded.
 *
 * Which rows a caller may touch is the policy's business (own station, stage still
 * `dilaporkan`, not yet validated); which COLUMN is the column grant's — only
 * `validated_at` is writable by a session. Zero rows updated means refused, so it
 * is reported rather than silently swallowed, exactly like the /kritis follow-up
 * this pattern was learned from.
 */
export const validasikanPenalty = async (formData: FormData): Promise<void> => {
  await requireGrant('penalty', 'view')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('penalties')
    .update({ validated_at: new Date().toISOString() })
    .eq('id', String(formData.get('id') ?? ''))
    .select('id')

  if (error || (data ?? []).length === 0) {
    console.error('[penalty] validasi tidak tercatat', error?.message ?? 'no rows matched')
  }
  revalidatePath('/penalty')
}
