# G-CME — Contract & Margin Engine

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, backed by Supabase
Postgres. Built to the specification in `docs/spec.md`, which is authoritative.

The Vite/Figma Make prototype this replaced is preserved at commit `e633559` and is
the visual reference for the design.

## Running it

```sh
pnpm install
pnpm db:start      # local Supabase stack (needs Docker running)
pnpm db:reset      # apply migrations + seed from the workbook
pnpm dev           # http://localhost:8443
pnpm functions:serve  # reminder Edge Function, for the email path
```

Copy `.env.example` to `.env.local` and fill it in. The Edge Function reads its own
settings from `supabase/functions/.env.local`, which the e2e global setup writes for
you if it is missing.

Local email goes to the stack's Mailpit — inbox at http://127.0.0.1:54324. Nothing
leaves the machine.

```sh
pnpm sheets:sync --dry-run   # print the mirror payload; needs no Google account
pnpm sheets:sync             # write it, once GOOGLE_* are set
```

`.env.local` points at the local stack. Its keys are the Supabase CLI's fixed
development keys — identical on every machine, and worthless against anything hosted.

Sign in with any of the four seeded accounts (see `src/lib/demo-accounts.ts`); the
password is the same for all of them and the sign-in screen offers a picker.

## Key files

- `docs/spec.md` — the specification. Read it before changing behaviour.
- `supabase/migrations/` — schema, RLS policies, scenario state machine, reminders.
- `supabase/seed.sql` — **generated**. Run `pnpm seed:generate` after the workbook
  changes; never edit it by hand.
- `src/lib/domain.ts` — every derived value (GPM, status bands, Rupiah formatting).
  Nothing recomputes these locally.
- `src/lib/supabase/database.types.ts` — **generated**. Regenerate with
  `supabase gen types typescript --local > src/lib/supabase/database.types.ts`.
- `supabase/functions/send-reminders/` — selection, recording and email delivery for
  expiry reminders. Deno, not Node: excluded from the app's tsconfig.
- `src/lib/sheets/mirror.ts` — the Sheets payload shape, kept apart from the writing
  so it can be inspected without a Google account.

## Things that will bite you

**Access control lives in the database, not the interface.** Queries in
`src/lib/data/` deliberately carry no business-line filter — the RLS policy decides
what comes back. Adding a `.eq('business_line', …)` "to be safe" would hide policy
mistakes rather than prevent them.

**Derived values are never stored.** GPM, days remaining and the status band are
computed from the contract row on every read, so a badge and an email cannot
disagree. Resist adding a `gpm` column to `contracts`.

**Margin targets are per contract.** `min_gpm_target` ranges 20–35% across the book.
There is no global threshold, and code that assumes one is wrong.

**Contract end dates are re-anchored on every seed** to `current_date + (source -
2026-08-10)`, which reproduces the spec's pipeline (Nonaktif 3 / Kritis 3 / Perlu
Perhatian 5 / Aman 9) whenever the demo is given. `source_end_date` keeps the
workbook's original date.

**The reminder Edge Function must call selection as the *caller*, not the service
role.** `send_expiry_reminders` is `security definer`, so RLS does not apply inside
it and it re-imposes the business line by hand. Invoking it with the service-role key
on the manual path would make that check vacuous and turn the endpoint into a way
around RLS. It forwards the caller's `Authorization` header for exactly this reason,
and `tests/rls/reminders.test.ts` guards it.

**Reminder email is idempotent separately from reminder selection.** Selection keys
on `(recipient, contract, milestone)`; delivery keys on `notifications.emailed_at`.
A failed SMTP hop therefore delays an email rather than losing the notification.

**`.sr-only-text` is `position: absolute`.** Any horizontal scroll container holding
one needs `relative` on it, or the visually-hidden text resolves against the initial
containing block and drags the page sideways on mobile.

## Testing

Two seams, both asserting externally observable behaviour. There is deliberately no
unit-test layer for the derivations — they are asserted through rendered output.

```sh
pnpm test          # both seams
pnpm test:rls      # seam 2 — RLS, authenticating as each seeded user
pnpm test:e2e      # seam 1 — Playwright through the real interface
pnpm typecheck
```

Both seams run against the local stack. `pnpm test:e2e` resets the database first
(`tests/e2e/global-setup.ts`), because the specs write, and starts the reminder Edge
Function alongside the app so the manual-reminder path is exercised for real —
including an assertion that a message actually reached Mailpit.

Live Gmail delivery and the Sheets mirror remain verified by inspection, as the spec
says: both need third-party credentials that a test would have to fake.
