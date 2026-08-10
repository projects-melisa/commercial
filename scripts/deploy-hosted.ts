/**
 * Applies the migrations and seed to the hosted Supabase project.
 *
 *   pnpm deploy:db          apply anything not yet recorded as applied
 *   pnpm deploy:db --seed   also run supabase/seed.sql
 *
 * Runs SQL through the Management API rather than a direct Postgres connection, so
 * it needs only SUPABASE_ACCESS_TOKEN — no database password.
 *
 * Applied versions are recorded in `supabase_migrations.schema_migrations`, the same
 * table the Supabase CLI uses, so a later `supabase db push` agrees with what this
 * has already done.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const token = process.env.SUPABASE_ACCESS_TOKEN
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set — see .env.example')

const projectRef = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const match = /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)
  if (!match) throw new Error(`could not read a project ref from NEXT_PUBLIC_SUPABASE_URL: ${url}`)
  return match[1]!
})()

const runSql = async (query: string, label: string): Promise<unknown> => {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
  )
  const body = await response.text()
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${body.slice(0, 600)}`)
  try {
    return JSON.parse(body)
  } catch {
    return body
  }
}

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

console.log(`Project ${projectRef} — ${migrations.length} migrations on disk\n`)

await runSql(
  `create schema if not exists supabase_migrations;
   create table if not exists supabase_migrations.schema_migrations (
     version text primary key,
     statements text[],
     name text
   );`,
  'migration bookkeeping',
)

const appliedRows = (await runSql(
  'select version from supabase_migrations.schema_migrations',
  'read applied migrations',
)) as { version: string }[]
const applied = new Set(appliedRows.map((row) => row.version))

for (const file of migrations) {
  const version = file.split('_')[0]!
  if (applied.has(version)) {
    console.log(`  skip   ${file} (already applied)`)
    continue
  }

  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  await runSql(sql, file)
  await runSql(
    `insert into supabase_migrations.schema_migrations (version, name)
     values ('${version}', '${file.replace(/'/g, "''")}')
     on conflict (version) do nothing`,
    `record ${file}`,
  )
  console.log(`  apply  ${file}`)
}

if (process.argv.includes('--seed')) {
  console.log('\nSeeding…')
  const seed = readFileSync(join(process.cwd(), 'supabase', 'seed.sql'), 'utf8')
  await runSql(seed, 'seed.sql')

  const counts = (await runSql(
    `select
       (select count(*) from public.contracts)     as contracts,
       (select count(*) from public.customers)     as customers,
       (select count(*) from public.cases)         as cases,
       (select count(*) from public.profiles)      as profiles,
       (select count(*) from auth.users)           as users`,
    'verify seed',
  )) as Record<string, number>[]
  console.log('  ', JSON.stringify(counts[0]))
}

console.log('\nDone.')
