/**
 * The public API key, whichever generation the project uses.
 *
 * Supabase is migrating from JWT `anon` keys to publishable keys
 * (`sb_publishable_…`), which rotate independently and are the recommended choice
 * for new projects. Both are safe to expose and both authenticate a request as the
 * `anon` role, so the difference is operational rather than semantic — and reading
 * either here keeps that detail out of every call site.
 *
 * The publishable key wins when both are present, since a project that has one has
 * moved on from the legacy key.
 */
export const supabasePublicKey = (): string => {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!key) {
    throw new Error(
      'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY). See .env.example.',
    )
  }
  return key
}

export const supabaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. See .env.example.')
  return url
}
