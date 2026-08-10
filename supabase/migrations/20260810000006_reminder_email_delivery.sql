-- Email delivery for reminders.
--
-- Writing the notification row and sending the email are separated deliberately.
-- Selection happens in `send_expiry_reminders` and is idempotent on
-- (recipient, contract, milestone); delivery is idempotent on `emailed_at`. If the
-- mail hop fails — bad credentials, SMTP down, the Edge Function cold — the
-- notification is still recorded and the email is simply retried on the next run,
-- rather than the whole reminder being lost.

alter table notifications
  add column emailed_at timestamptz;

comment on column notifications.emailed_at is
  'When this notification was emailed. Null means delivery is still owed.';

-- Reminder rows awaiting delivery. Only ever read by the Edge Function under the
-- service role, so there is no policy: RLS denies it to every user-facing session.
create index notifications_pending_email_idx
  on notifications (created_at)
  where milestone_key is not null and emailed_at is null;

/**
 * Stamps a notification as emailed. Called by the Edge Function after the SMTP hop
 * succeeds, so a failed send leaves the row eligible for the next run.
 */
create function mark_notification_emailed(notification_id uuid)
  returns void
  language sql
  security definer
  set search_path = ''
as $$
  update public.notifications
     set emailed_at = now()
   where id = notification_id
     and emailed_at is null
$$;

revoke execute on function mark_notification_emailed(uuid) from public, anon, authenticated;
grant execute on function mark_notification_emailed(uuid) to service_role;
