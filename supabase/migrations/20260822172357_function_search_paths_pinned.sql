-- Both findings from Supabase's security linter that were accepted as fixable.
--
-- A trigger function's default search_path includes `public`, so a hostile schema
-- entry could shadow what the body resolves. These two bodies resolve nothing but
-- NEW/OLD and now(), so pinning the path to empty costs nothing and closes the warn.

create or replace function set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.contract_end_date is distinct from old.contract_end_date then
    new.previous_end_date = old.contract_end_date;
    -- A renewed contract is a fresh problem; whatever chasing was done is spent.
    new.followed_up_at = null;
  end if;
  return new;
end;
$$;

create or replace function notifications_only_read_flag_mutable() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if (new.recipient_id, new.severity, new.title, new.body, new.contract_id, new.milestone_key, new.created_at)
     is distinct from
     (old.recipient_id, old.severity, old.title, old.body, old.contract_id, old.milestone_key, old.created_at)
  then
    raise exception 'only the read flag may be updated on a notification';
  end if;
  return new;
end;
$$;
