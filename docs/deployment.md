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
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — the sheet-sync route reads the whole portfolio |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | **secret** |
| `GOOGLE_PRIVATE_KEY` | **secret** — keep the `\n` escapes and the surrounding quotes |
| `GOOGLE_SHEET_ID` | the mirror's target |
| `SHEETS_SYNC_SECRET` | **secret** — the shared secret the cron job presents |

Only the first two reach the browser. The rest are read exclusively by
`/api/sheets/sync`, which runs on the server.

Generate the sync secret with `openssl rand -hex 32`.

Set the region to **Singapore (sin1)** in Project Settings → Functions. The database
is in ap-southeast-1, and the default (Washington) puts a Pacific round trip in front
of every query.

## 4. Point the scheduled mirror at the deployment

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

## Scheduled jobs, once everything is in place

| Job | When (UTC) | What |
|---|---|---|
| `g-cme-daily-expiry-reminders` | 00:15 | Writes notification rows. Pure SQL, no network. |
| `g-cme-daily-reminder-email` | 00:20 | Invokes the Edge Function to deliver them. |
| `g-cme-daily-sheets-mirror` | 00:30 | Posts to `/api/sheets/sync`. |

07:15, 07:20 and 07:30 in Jakarta. The reminder rows are written by a job that cannot
fail on a network hop, so a broken mail or mirror configuration never costs anyone
their in-app notification.

## Verifying a deployment

```sh
pnpm sheets:sync --dry-run   # payload, without writing
pnpm test:rls                # against whatever .env.local points at
```

`pnpm test:e2e` refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` is the local stack —
it wipes and rewrites the database. Point it at the local stack rather than
overriding the guard.
