'use server'

import { revalidatePath } from 'next/cache'

import { requireGrant } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type AppModule = Database['public']['Enums']['app_module']

export interface ReportLinkActionState {
  error: string | null
  ok: string | null
}

const text = (form: FormData, key: string): string => String(form.get(key) ?? '').trim()

/**
 * Upserts one module's outbound link. `report_links_write` is the whole guard —
 * `requireGrant` only decides whether the page renders the form at all, so this
 * still refuses at the database if a stale form is resubmitted after a role change.
 */
export const upsertReportLink = async (
  _prev: ReportLinkActionState,
  form: FormData,
): Promise<ReportLinkActionState> => {
  try {
    await requireGrant('report_links', 'manage')

    const modul = text(form, 'modul') as AppModule
    const judul = text(form, 'judul')
    const url = text(form, 'url')
    const aktif = text(form, 'aktif') === 'true'

    if (!judul || !url) return { error: 'Judul dan URL wajib diisi.', ok: null }
    try {
      new URL(url)
    } catch {
      return { error: 'URL tidak valid.', ok: null }
    }

    const supabase = await createClient()
    const { error } = await supabase.from('report_links').upsert({ modul, judul, url, aktif })
    if (error) return { error: error.message, ok: null }

    revalidatePath('/pengaturan')
    revalidatePath('/pendapatan')
    return { error: null, ok: `Tautan ${judul} tersimpan.` }
  } catch (error) {
    return { error: (error as Error).message, ok: null }
  }
}
