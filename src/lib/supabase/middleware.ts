import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/keys'
import type { Database } from '@/lib/supabase/types'

/**
 * Routes reachable without a session. Everything else redirects to sign-in.
 *
 * `/api/sheets/pull` is called by a pg_cron job, not by a person, so there is no
 * session to redirect it to — without this it would be answered with a 307 to the
 * sign-in page and the pull would silently never run. It carries its own
 * bearer-secret check and refuses outright when that secret is unset.
 */
const PUBLIC_PATHS = ['/masuk', '/auth', '/api/sheets/pull']

const isPublic = (pathname: string): boolean =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

/**
 * Where a signed-in user visiting `/masuk` belongs, duplicated from `landingFor`
 * rather than imported: `@/lib/auth` reaches for `next/headers`' `cookies()`, which
 * only Server Components and Route Handlers get — middleware manages cookies through
 * the request/response pair instead, and importing that module here would pull in an
 * API this runtime cannot use.
 *
 * A hardcoded `/` sent a GM Cabang and a super admin — the two roles `/` is a 404 for
 * — to an error boundary on every ordinary sign-in-page visit while already signed in.
 */
const landingPathFor = async (
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
): Promise<string> => {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (!profile) return '/masuk'

  const { data: grantRows } = await supabase
    .from('role_module_grants')
    .select('modul, aksi')
    .eq('role', profile.role)
  const grants = new Set((grantRows ?? []).map((g) => `${g.modul}:${g.aksi}`))
  const may = (modul: string, aksi: string): boolean => grants.has(`${modul}:${aksi}`)

  if (may('kontrak', 'view')) return '/pilih'
  if (may('pendapatan', 'view')) return '/pendapatan'
  if (may('pengguna', 'manage')) return '/pengguna'
  return '/pengaturan'
}

/**
 * Refreshes the session cookie on every request and sends unauthenticated callers to
 * sign-in, so an expired session lands on the login screen rather than on a page that
 * renders empty because RLS returned nothing.
 */
export const updateSession = async (request: NextRequest): Promise<NextResponse> => {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    supabaseUrl(),
    supabasePublicKey(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getUser revalidates against the auth server; getSession would trust the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublic(pathname)) {
    const target = request.nextUrl.clone()
    target.pathname = '/masuk'
    target.searchParams.set('next', pathname)
    return NextResponse.redirect(target)
  }

  if (user && pathname === '/masuk') {
    const target = request.nextUrl.clone()
    target.pathname = await landingPathFor(supabase, user.id)
    target.search = ''
    return NextResponse.redirect(target)
  }

  return response
}
