/**
 * Expiry reminders: select, record, deliver.
 *
 * The daily pg_cron job and the "Kirim Reminder Sekarang" button in the interface
 * both invoke this one function, so the demo path and the scheduled path cannot pick
 * contracts differently or word the email differently.
 *
 * Selection itself lives in Postgres (`send_expiry_reminders`), because the business
 * rule — 60 / 30 / 14 days, once per milestone — has to agree with the status bands
 * the interface renders. This function is the delivery half: it triggers selection,
 * then emails whatever notifications are still owed one.
 *
 * Deploy:  supabase functions deploy send-reminders
 * Secrets: supabase secrets set SMTP_HOST=… SMTP_PORT=… SMTP_USERNAME=… \
 *            SMTP_PASSWORD=… SMTP_FROM=… [REMINDER_RECIPIENT_OVERRIDE=…]
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

interface PendingReminder {
  id: string
  title: string
  body: string
  severity: 'critical' | 'warning' | 'info'
  recipient_id: string
}

const env = (key: string): string | undefined => Deno.env.get(key)

const required = (key: string): string => {
  const value = env(key)
  if (!value) throw new Error(`${key} is not set`)
  return value
}

/**
 * Where the mail actually goes.
 *
 * Outside production every message is redirected to one configured inbox, so a demo
 * against real seeded data cannot email colleagues who are not expecting it. Set
 * REMINDER_RECIPIENT_OVERRIDE in every non-production environment.
 */
const resolveRecipient = (intended: string): string =>
  env('REMINDER_RECIPIENT_OVERRIDE') ?? intended

const renderEmail = (reminder: PendingReminder, intended: string): string => {
  const urgency =
    reminder.severity === 'critical'
      ? 'SEGERA — '
      : reminder.severity === 'warning'
        ? 'Perlu perhatian — '
        : ''

  return [
    `<div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111827">`,
    `<p style="margin:0 0 4px;font-size:12px;color:#6b7280">G-CME — Contract &amp; Margin Engine</p>`,
    `<h2 style="margin:0 0 12px;color:#1a5c3a">${urgency}${reminder.title}</h2>`,
    `<p style="font-size:14px;line-height:1.6">${reminder.body}</p>`,
    `<p style="font-size:12px;color:#6b7280">Buka dashboard untuk menyiapkan posisi renegosiasi.</p>`,
    env('REMINDER_RECIPIENT_OVERRIDE')
      ? `<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
         <p style="font-size:11px;color:#9ca3af">
           Lingkungan non-produksi. Penerima sebenarnya: ${intended}.
         </p>`
      : '',
    `</div>`,
  ].join('')
}

Deno.serve(async (request) => {
  // Sending is a POST. A GET is a liveness probe and must never send anything, so
  // that checking whether the function is up cannot mail anybody.
  if (request.method !== 'POST') {
    return Response.json({ status: 'ok', function: 'send-reminders' })
  }

  try {
    const supabase = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    )

    /*
     * Selection runs as whoever called this function, not as the service role.
     *
     * `send_expiry_reminders` is security definer, so it re-imposes the caller's
     * business line by hand. Running it as the service role would make that check
     * vacuous and turn this endpoint into a way around RLS — a Commercial user could
     * prompt on another line's contract and learn its customer name. Forwarding the
     * caller's token keeps the boundary intact on the manual path; on the scheduled
     * path the token is the service role and no contract id is supplied, so the
     * scope clause is not reached.
     */
    // Supabase injects SUPABASE_ANON_KEY into every function; newer projects also
    // expose a publishable key. Either authenticates as the `anon` role.
    const publicKey = env('SUPABASE_PUBLISHABLE_KEY') ?? required('SUPABASE_ANON_KEY')
    const caller = createClient(required('SUPABASE_URL'), publicKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    })

    // An optional contract id narrows this to the manual, single-contract path.
    const payload = await request.json().catch(() => ({}))
    const targetContractId: string | null = payload.contract_id ?? null

    // 1. Selection — in the database, so it matches the status bands exactly.
    const { data: selected, error: selectionError } = await caller.rpc('send_expiry_reminders', {
      target_contract_id: targetContractId,
    })
    if (selectionError) throw new Error(`selection failed: ${selectionError.message}`)

    // 2. Delivery — everything still owed an email, including anything a previous
    //    run recorded but could not send.
    const { data: pending, error: pendingError } = await supabase
      .from('notifications')
      .select('id, title, body, severity, recipient_id')
      .not('milestone_key', 'is', null)
      .is('emailed_at', null)
      .order('created_at')
      .returns<PendingReminder[]>()
    if (pendingError) throw new Error(`could not read pending reminders: ${pendingError.message}`)

    if (!pending || pending.length === 0) {
      return Response.json({
        selected: selected?.length ?? 0,
        written: (selected ?? []).filter((row) => row.notification_id !== null).length,
        emailed: 0,
        message: 'Tidak ada reminder yang perlu dikirim.',
      })
    }

    // The local Mailpit instance speaks plaintext and wants no credentials; Gmail
    // requires TLS and an App Password. `allowUnsecure` is tied to TLS being
    // explicitly disabled, so it can never loosen a real connection.
    const useTls = env('SMTP_TLS') !== 'false'
    const client = new SMTPClient({
      connection: {
        hostname: required('SMTP_HOST'),
        port: Number(env('SMTP_PORT') ?? 587),
        tls: useTls,
        auth: env('SMTP_USERNAME')
          ? { username: required('SMTP_USERNAME'), password: required('SMTP_PASSWORD') }
          : undefined,
      },
      debug: { allowUnsecure: !useTls },
    })

    let emailed = 0
    const failures: string[] = []

    for (const reminder of pending) {
      // The recipient's address lives in auth.users, not in profiles, so it is read
      // through the admin API rather than duplicated into a second column.
      const { data: user } = await supabase.auth.admin.getUserById(reminder.recipient_id)
      const intended = user?.user?.email
      if (!intended) {
        failures.push(`${reminder.id}: recipient has no email address`)
        continue
      }

      try {
        await client.send({
          from: env('SMTP_FROM') ?? 'G-CME <no-reply@gapura.local>',
          to: resolveRecipient(intended),
          subject: reminder.title,
          html: renderEmail(reminder, intended),
        })
        // Stamped only after the send succeeds, so a failure is retried tomorrow
        // rather than silently dropped.
        await supabase.rpc('mark_notification_emailed', { notification_id: reminder.id })
        emailed += 1
      } catch (error) {
        failures.push(`${reminder.id}: ${(error as Error).message}`)
      }
    }

    await client.close()

    return Response.json({
      selected: selected?.length ?? 0,
      written: (selected ?? []).filter((row) => row.notification_id !== null).length,
      emailed,
      failures,
    })
  } catch (error) {
    console.error('[send-reminders]', error)
    return Response.json({ error: (error as Error).message }, { status: 500 })
  }
})
