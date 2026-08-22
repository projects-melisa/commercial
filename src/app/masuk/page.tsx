import { LoginShell } from '@/app/masuk/login-shell'

export const metadata = { title: 'Masuk — Gapura Commercial' }

export default async function MasukPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  // Empty rather than '/', so a plain sign-in is routed by the caller's grants. A
  // literal '/' would send a GM Cabang and a super admin to a page neither may open.
  return <LoginShell next={next ?? ''} />
}
