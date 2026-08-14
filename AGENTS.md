# Gapura Commercial — Contract & Margin Engine

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4, backed by Supabase
Postgres. Built to the specification in `docs/spec.md`, which is authoritative.

The Vite/Figma Make prototype this replaced is preserved at commit `e633559` and is
the visual reference for the design.

## Running it

```sh
pnpm install
pnpm db:start      # local Supabase stack (needs Docker running)
pnpm db:reset      # apply migrations + seed from the Google Sheet
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

Sign in with any of the three seeded accounts (see `src/lib/demo-accounts.ts`); the
password is the same for all of them and the sign-in screen offers a picker.

## Key files

- `docs/spec.md` — the specification. Read it before changing behaviour.
- `supabase/migrations/` — schema, RLS policies, scenario state machine, reminders.
- `supabase/seed.sql` — **generated from the Google Sheet**. Run `pnpm seed:generate`
  after the Sheet changes; never edit it by hand. It needs the `GOOGLE_*` credentials,
  and it **deletes before inserting** — re-seeding replaces, it does not merge.
- `scripts/lib/read-sheet.ts` — reads the Sheet. Splits a multi-station row into one
  contract line per station, and maps "All Station" to a null `cabang`.
- `src/lib/domain.ts` — every derived value (GPM, status bands, Rupiah formatting).
  Nothing recomputes these locally.
- `src/lib/supabase/database.types.ts` — **generated**. Regenerate with
  `supabase gen types typescript --local > src/lib/supabase/database.types.ts`.
- `supabase/functions/send-reminders/` — selection, recording and email delivery for
  expiry reminders. Deno, not Node: excluded from the app's tsconfig.
- `src/lib/sheets/mirror.ts` — the Sheets payload shape, kept apart from the writing
  so it can be inspected without a Google account.
- `src/lib/sheets/sync.ts` — the writing itself, shared by `pnpm sheets:sync` and the
  scheduled `/api/sheets/sync` endpoint.
- `docs/deployment.md` — the deployment runbook, including the Vault secrets the
  scheduled jobs read.

## Things that will bite you

**Access control lives in the database, not the interface.** Queries in
`src/lib/data/` deliberately carry no business-line or cabang filter — the RLS policy
decides what comes back. Adding a `.eq('business_line', …)` "to be safe" would hide
policy mistakes rather than prevent them.

**Scope is two dimensions, read through one function.** Business line and station
compose, and every policy asks `in_caller_scope(business_line, cabang)` rather than
comparing columns itself. Null on the caller's side means "all of them" on that axis,
which is why a GM Cabang carries no business line — and why a policy left on the old
line-only predicate would hand them the entire portfolio. Add a dimension in
`in_caller_scope`, not in a policy.

**Derived values are never stored.** GPM, days remaining and the status band are
computed from the contract row on every read, so a badge and an email cannot
disagree. Resist adding a `gpm` column to `contracts`.

**Margin targets are per contract.** `min_gpm_target` ranges 20–35% across the book.
There is no global threshold, and code that assumes one is wrong.

**The Google Sheet is the source of truth, and the mirror still points the other
way.** `pnpm seed:generate` reads the Sheet into the database; `pnpm sheets:sync` and
`/api/sheets/sync` write the database back over the Sheet, clearing each tab first.
The second would overwrite hand-maintained data with an older copy, so the daily
`g-cme-daily-sheets-mirror` cron has been unscheduled on the hosted project. Do not
re-enable it without deciding which direction wins.

**Contract dates are the Sheet's own** and are no longer re-anchored on seeding. The
workbook needed that because its dates aged; the Sheet is maintained by hand.
`source_end_date` is null for anything the Sheet supplied.

**Most contracts have no `min_gpm_target`.** The Sheet has no column for it, so
`marginHealth` returns `meetsTarget: null` — three states, not two. Write
`meetsTarget === false` when you mean "breaching"; a bare `!meetsTarget` counts every
untargeted contract as a breach.

**The reminder Edge Function must call selection as the *caller*, not the service
role.** `send_expiry_reminders` is `security definer`, so RLS does not apply inside
it and it re-imposes the business line by hand. Invoking it with the service-role key
on the manual path would make that check vacuous and turn the endpoint into a way
around RLS. It forwards the caller's `Authorization` header for exactly this reason,
and `tests/rls/reminders.test.ts` guards it.

**Reminder email is idempotent separately from reminder selection.** Selection keys
on `(recipient, contract, milestone)`; delivery keys on `notifications.emailed_at`.
A failed SMTP hop therefore delays an email rather than losing the notification.

**Migrations are versioned by their numeric prefix.** Two files sharing one means
only the first is ever applied; `pnpm deploy:db` now refuses rather than half-migrate.

**Vercel gets real secrets, despite most of the app needing none.** The pages read
only the two `NEXT_PUBLIC_` variables, but `/api/sheets/sync` holds the service-role
key and the Google service account, because it mirrors the whole portfolio on a
schedule. See `docs/deployment.md`.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
