-- The renewal follow-up flag gets its own narrow write path.
--
-- Withdrawing contract CRUD left `contracts` with a SELECT policy and nothing else,
-- which is right for everything the Sheet owns. But `followed_up_at` is not the
-- Sheet's: there is no column for it in `Compiled_Contracts`, the daily pull never
-- sends it, and it records something only this application knows — that somebody
-- chased this renewal.
--
-- The symptom was a button on `/kritis` that had been silently doing nothing. An
-- update with no matching policy affects zero rows and raises no error, so the queue
-- kept showing every contract as untouched and nobody was told why.
--
-- Two halves, and the second is what keeps this from reopening contract editing:
--
--   1. A policy allowing UPDATE to anyone who may already read the row.
--   2. A *column* grant, so that is the only column an update can name. RLS cannot
--      restrict columns; only `grant update (col)` can, and without it the policy
--      would hand back the ability to rewrite tarif and cost.

revoke update on public.contracts from authenticated;
grant update (followed_up_at) on public.contracts to authenticated;

create policy contracts_update_followup on public.contracts
  for update to authenticated
  using (caller_may('kontrak', 'view') and in_caller_scope(business_line, cabang))
  with check (caller_may('kontrak', 'view') and in_caller_scope(business_line, cabang));

comment on column public.contracts.followed_up_at is
  'When this renewal was last chased. Application state, not the Sheet''s: the only
   column of this table an authenticated session may write.';

notify pgrst, 'reload schema';
