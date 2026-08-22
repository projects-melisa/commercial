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

The daily Sheet → Supabase pull runs itself (`g-cme-daily-sheets-pull`). To run one by
hand against a deployment, post to it with the shared secret:

```sh
curl -X POST "$APP_BASE_URL/api/sheets/pull" -H "Authorization: Bearer $SHEETS_SYNC_SECRET"
```

`.env.local` decides which database everything talks to — the app, `pnpm test:rls`,
`pnpm seed:generate` and any script. Pointed at the local stack its keys are the
Supabase CLI's fixed development keys, identical on every machine and worthless against
anything hosted. **Pointed at the hosted project it is the hosted project**, and
`pnpm dev` then reads and writes production. Check which one it is before running
anything that writes.

Sign in with any of the three seeded accounts (see `src/lib/demo-accounts.ts`); the
password is the same for all of them and the sign-in screen offers a picker.

## Key files

- `docs/Gapura OneClick Commercial.md` — **the current specification**, superseding
  `docs/spec.md` for RBAC, the four domains, and the direction of the Sheet sync.
  Read it before changing behaviour.
- `docs/spec.md` — the original three-role spec. Still accurate about the contract
  domain and the derivations; wrong about roles and about writing from the web.
- `supabase/migrations/` — schema, RLS policies, scenario state machine, reminders.
- `supabase/seed.sql` — **generated from the Google Sheet**, covering every tab the
  pull covers so a local `db:reset` looks like a deployment that has been pulling. Run
  `pnpm seed:generate` after the Sheet changes; never edit it by hand. It needs the
  `GOOGLE_*` credentials, and it **deletes before inserting** — re-seeding replaces, it
  does not merge.
- `src/lib/sheets/read-sheet.ts` — reads the Sheet, read-only scope. Splits a
  multi-station row into one contract line per station, maps "All Station" to a null
  `cabang`, and also reads `Revenue_Data`, `Receivable_Data`, `Ancillary_Data` and
  `Penalty_Data` for the pull.
- `src/lib/domain.ts` — every derived value (GPM, status bands, Rupiah formatting).
  Nothing recomputes these locally.
- `src/lib/supabase/database.types.ts` — **generated**. Regenerate with
  `supabase gen types typescript --local > src/lib/supabase/database.types.ts`.
- `supabase/functions/send-reminders/` — selection, recording and email delivery for
  expiry reminders. Deno, not Node: excluded from the app's tsconfig.
- `src/lib/sheets/pull.ts` — the daily Sheet → Supabase pull, six tabs. Upserts on a
  natural key per tab, records one `sheet_syncs` row per tab, and never deletes.
  `Revenue_Data` is a `PATCH` of one column rather than an upsert, for the reason below.
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

**The Sheet is the source of truth, and now only one direction exists.** The mirror
that wrote Supabase back over the Sheet is gone — code, endpoint and cron — because it
cleared each tab before writing and could replace hand-maintained data with an older
copy. Unscheduling it was not enough: code that still exists can still be pressed. Do
not reintroduce a write path to the Sheet.

**The pull upserts; the seed replaces. Do not swap them.** `pnpm seed:generate` deletes
before inserting, which is right for a seed and ruinous nightly: one tab emptied by a
mis-click would take production with it. `/api/sheets/pull` upserts on a natural key
per tab, leaves vanished rows alone and counts them as stale, and fails per tab so a
malformed Ancillary row cannot stop the contracts refreshing.

**`min_gpm_target` survives the pull only because the payload omits it.** PostgREST's
`resolution=merge-duplicates` updates just the columns the payload carries, and the
Sheet has no column for that target. Add it to the contracts payload and every target
in the book is nulled out nightly.

**The natural keys are `nulls not distinct` on purpose.** A contract with
`cabang = null` is the Sheet's "All Station" — one specific row, not an unknown one.
Under the default `nulls distinct` the pull would insert a fresh All-Station copy of
every such contract every night.

**`getGrants` must filter by the caller's role, and that filter is the whole gate.**
`role_module_grants` is readable in full by everyone signed in — deliberately, since it
holds no business data — so an unfiltered select returns *every* role's grants and every
`may()` answers yes. The interface then offers every module to everybody. The database
is unaffected (`caller_may()` re-derives the role inside each policy), so the symptom is
an offered button that leads to a refused write rather than a leak, but it makes the
whole nav and the bento meaningless.

**Supabase's row ceiling is 1000 and it is applied silently.** No error, no flag — just
a short array. `listRevenue` pages past it because the book is 1056 rows, and the 56 it
lost rendered as an RKAP of Rp 136 M against a real Rp 155,9 M. Any new query that can
return more than a thousand rows needs the same loop, or the aggregation moved into SQL.

**Contract dates are the Sheet's own** and are no longer re-anchored on seeding. The
workbook needed that because its dates aged; the Sheet is maintained by hand.
`source_end_date` is null for anything the Sheet supplied.

**`min_gpm_target` has three states, not two.** It comes from `Revenue_Data` — a
separate tab, written by a separate statement in the pull, precisely so it is never in
the contracts payload. A customer the Sheet has no target for leaves `null`, and
`marginHealth` returns `meetsTarget: null`. Write `meetsTarget === false` when you mean
"breaching"; a bare `!meetsTarget` counts every untargeted contract as a breach.

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
only the two `NEXT_PUBLIC_` variables, but `/api/sheets/pull` holds the service-role
key and the Google service account, because it rewrites the whole portfolio on a
schedule. See `docs/deployment.md`.

**`pnpm format` is disarmed, and leaving it that way is deliberate.** oxfmt 0.2.0
hoists every inline comment to the top of the module — detaching each one from the code
it explains — and on `src/components/revenue/filter-bar.tsx` it emitted a syntax error
(`{ value: string label: string }`). A formatter that changes meaning is worse than no
formatter. The script now refuses; format by hand in the house style, single quotes and
no semicolons. Do not reach for `prettier` either: it defaults to the opposite style and
leaves the tree half-converted.

**A URL segment is not a uuid.** `/kontrak/baru` — the address bookmarks still point at,
from before the create form was withdrawn — reached Postgres as a uuid comparison and
came back a 500 with an error boundary. `getContract` now shape-checks first and answers
404. Any new lookup keyed on a uuid column from a route param needs the same guard.

**`followed_up_at` is the one column of `contracts` an authenticated session may write,**
and a *column grant* is what confines it — RLS cannot restrict columns, so the policy
alone would have handed contract editing straight back. Withdrawing contract CRUD had
left the `/kritis` follow-up button writing nothing and reporting nothing, because an
update with no matching policy affects zero rows and raises no error.

**`penalties.validated_at` is that same pattern's sibling.** The Sheet owns `tahap`, so
cabang validation (U-2) writes its own column the pull never sends; the update policy
confines rows to `tahap = 'dilaporkan' and validated_at is null`, but only the column
grant keeps a session from rewriting `tahap` itself. And when two policies could match
an UPDATE they OR: replacing `penalties_update`, not adding beside it, is what made the
narrow one bite.

**A grant is checked before the query, not after.** RLS hands a caller without the grant
an empty array, so "no cases on file" and "not yours to know" render identically unless
the page asks first. The contract page and the customer page both ask, and both say
which one it is. Silence reads as reassurance.

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

Live Gmail delivery and the Sheets pull remain verified by inspection, as the spec
says: both need third-party credentials that a test would have to fake.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
