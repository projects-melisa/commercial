import type { NextConfig } from 'next'

/**
 * Headers applied to every response.
 *
 * The application will be opened on a public URL by judges, so these cost nothing
 * and remove the cheapest classes of mistake. A Content-Security-Policy is
 * deliberately absent: doing it properly means handling Next's inline bootstrap
 * scripts with a nonce, and a half-configured CSP that breaks the demo is worse than
 * none. It belongs with the rest of production hardening, which the spec puts out of
 * scope.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Commercial terms should not be framed by another site.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  typedRoutes: true,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
