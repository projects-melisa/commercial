import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/keys'

/** Routes reachable without a session. Everything else redirects to sign-in. */
const PUBLIC_PATHS = ['/masuk', '/auth']

const isPublic = (pathname: string): boolean =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

/**
 * Refreshes the session cookie on every request and sends unauthenticated callers to
 * sign-in, so an expired session lands on the login screen rather than on a page that
 * renders empty because RLS returned nothing.
 */
export const updateSession = async (request: NextRequest): Promise<NextResponse> => {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
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
    target.pathname = '/'
    target.search = ''
    return NextResponse.redirect(target)
  }

  return response
}
