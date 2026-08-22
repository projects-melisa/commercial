# Deploying Gapura Commercial

The database and its scheduled jobs live in Supabase; only the web application goes
to Vercel. Migrations are **not** run by Vercel — pushing a branch never changes the
schema.

Hosted project: `commercial` (`aixotkyuhhuapqsldapu`), ap-southeast-1.

## 1. Database

```sh
pnpm deploy:db          # apply anything not yet recorded as applied
pnpm deploy:db --seed   # …and load the 20 contracts (first time only)
```

Runs SQL through the Supabase Management API, so it needs `SUPABASE_ACCESS_TOKEN`
and no database password. Applied versions are recorded in
`supabase_migrations.schema_migrations`, the table the Supabase CLI uses, so a later
`supabase db push` agrees with what this has done.

`--seed` is destructive to existing rows and should not be re-run against a project
that is already carrying demo state.

## 2. Reminder Edge Function

```sh
export SUPABASE_ACCESS_TOKEN=…
supabase link --project-ref aixotkyuhhuapqsldapu
supabase secrets set --env-file supabase/functions/.env.local
supabase functions deploy send-reminders
```

`REMINDER_RECIPIENT_OVERRIDE` must be set in every environment that is not
production. Without it, reminders go to whatever addresses are in `auth.users`.

## 3. Vercel

Framework and build command are detected automatically. Node is pinned to 22 by
`engines`; pnpm by `packageManager`.

Set these in **Project Settings → Environment Variables**:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — the pull route writes the whole portfolio |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | **secret** |
| `GOOGLE_PRIVATE_KEY` | **secret** — keep the `\n` escapes and the surrounding quotes |
| `GOOGLE_SHEET_ID` | the pull's source |
| `SHEETS_SYNC_SECRET` | **secret** — the shared secret the cron job presents |

Only the first two reach the browser. The rest are read exclusively by
`/api/sheets/pull`, which runs on the server.

Generate the sync secret with `openssl rand -hex 32`.

Set the region to **Singapore (sin1)** in Project Settings → Functions. The database
is in ap-southeast-1, and the default (Washington) puts a Pacific round trip in front
of every query.

## 4. Point the scheduled pull at the deployment

The daily `pg_cron` job reads its target from Vault, so it does nothing until told
where the application lives. After the first deploy, run this against the hosted
database with the real values:

```sql
select vault.create_secret('https://<your-deployment>.vercel.app', 'app_base_url');
select vault.create_secret('<the SHEETS_SYNC_SECRET>', 'sheets_sync_secret');
```

Same pattern for the reminder email job, if it is not already configured:

```sql
select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'functions_base_url');
select vault.create_secret('<service role key>', 'service_role_key');
```

Until these exist the jobs log a notice and return, rather than failing.

## 5. Supabase Auth

Set **Authentication → URL Configuration → Site URL** to the Vercel domain. Sign-in
is email and password so no redirect is involved, but the setting also governs the
allow-list used elsewhere.

Two dashboard toggles that no migration can reach (audit R-6 / U-12):

1. **Authentication → Policies → leaked password protection** — turn it on. The CLI's
   `config.toml` has no key for it, so local dev runs without it; hosted should not.
2. **MFA for the executive accounts** (`vp`, `direktur_utama`, `super_admin`) — the
   three most guessable passwords in the book belong to the three least-used logins.
   Enforce MFA (or Google Workspace SSO) per account; Supabase has no per-role switch,
   so this is three enrollments and a note, not code.

## Migration history vs the hosted project

The four migrations of 22 Aug recorded on hosted under later timestamps
(`…071414`, `…083303`, `…100817`, `…130310`) are named exactly that on disk since the
audit (P0-1/P0-3), so `pnpm deploy:db` skips them and applies only what is genuinely
new. If a future deploy ever half-applies again, the fix is
`supabase migration repair --status applied <version>`, not renaming files — the file
list is now deliberately identical to the hosted ledger.

## Scheduled jobs, once everything is in place

| Job | When (UTC) | What |
|---|---|---|
| `g-cme-daily-expiry-reminders` | 00:15 | Writes notification rows. Pure SQL, no network. |
| `g-cme-daily-reminder-email` | 00:20 | Invokes the Edge Function to deliver them. |
| `g-cme-daily-sheets-pull` | 19:00 | Posts to `/api/sheets/pull`. |

The reminders run at 07:15 and 07:20 Jakarta; the pull runs at 02:00 Jakarta the
following day, ahead of them, so the reminders read end dates the pull has already
refreshed. The reminder rows are written by a job that cannot fail on a network hop,
so a broken mail or pull configuration never costs anyone their in-app notification.

## Verifying a deployment

```sh
curl -X POST "$APP_BASE_URL/api/sheets/pull" -H "Authorization: Bearer $SHEETS_SYNC_SECRET"
```

A run answers `200` when every tab succeeded and `207` when some did not, with a
per-tab breakdown either way. `pnpm test:rls` runs against whatever `.env.local`
points at.

`pnpm test:e2e` refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` is the local stack —
it wipes and rewrites the database. Point it at the local stack rather than
overriding the guard.
