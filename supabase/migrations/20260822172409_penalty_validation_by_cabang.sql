-- U-2: cabang becomes the penalty validator, and C-12's penalty half lands for os_kps.
--
-- The requirement writes its own ideal flow — customer → cabang (validasi) → klaim
-- terbit → laporan internal ke OP — while `cabang` held zero access to penalties, so
-- the validation step could not happen here at all. The scope is real, unlike piutang:
-- `penalties.cabang_asal` is a station code, the same axis `ancillary_revenues.cab` uses.
--
-- The validation itself follows the `followed_up_at` precedent rather than overwriting
-- `tahap`: the Sheet owns the stage column and the nightly pull would stomp a web-written
-- value straight back. So validation gets its own column the pull never sends, and the
-- displayed position reads "the Sheet's stage, and validated on top".

alter table penalties add column validated_at timestamptz;

comment on column penalties.validated_at is
  'When the originating cabang validated this case. Application state the pull does not
   carry; the Sheet''s Stage column keeps owning `tahap`.';

-- ─── Grants ──────────────────────────────────────────────────────────────────
insert into role_module_grants (role, modul, aksi) values
  ('cabang', 'penalty', 'view'),
  ('cabang', 'penalty', 'input'),
  -- OS = Operation Support shares penalty handling with OP (C-12, proposed answer).
  ('os_kps', 'penalty', 'input');

-- ─── Policies ────────────────────────────────────────────────────────────────
drop policy penalties_select on penalties;
create policy penalties_select on penalties
  for select to authenticated
  using (
    caller_may('penalty', 'view')
    and (caller_cabang() is null or cabang_asal = caller_cabang())
  );

-- Rows are born in the Sheet. A station-scoped caller may act on existing cases but
-- has no reason to mint one, so inserts stay an unscoped affair.
drop policy penalties_insert on penalties;
create policy penalties_insert on penalties
  for insert to authenticated
  with check (caller_may('penalty', 'input') and caller_cabang() is null);

-- The one write a session may make, confined twice over: RLS decides WHICH rows,
-- and this column grant decides WHICH columns — RLS alone cannot.
revoke update on public.penalties from authenticated;
grant update (validated_at) on public.penalties to authenticated;

-- The blanket update policy from the four-tables migration is replaced, not left
-- beside its successor: permissive policies OR, and an unconfined one would make
-- the narrow one decorative.
drop policy penalties_update on penalties;

create policy penalties_update_validation on penalties
  for update to authenticated
  using (
    caller_may('penalty', 'input')
    and (caller_cabang() is null or cabang_asal = caller_cabang())
    and tahap = 'dilaporkan'
    and validated_at is null
  )
  -- Without this clause Postgres would reuse USING against the NEW row, where
  -- validated_at is by definition set — every validation would fail its own write.
  with check (
    caller_may('penalty', 'input')
    and (caller_cabang() is null or cabang_asal = caller_cabang())
    and tahap = 'dilaporkan'
  );

notify pgrst, 'reload schema';
