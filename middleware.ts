import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

export const middleware = (request: NextRequest) => updateSession(request)

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — those never carry a session
     * and running the auth round-trip on them would slow every page down.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
