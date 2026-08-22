-- R-5 · a signed-in session no longer reads the whole organisation chart.
--
-- `profiles` was open to every session so scenario author names could render. Side
-- effect: a GM Cabang could list every account in production with its role, line and
-- station. That is not business data, but it is the map of who holds what — and it is
-- exactly one query away from "which stations have no manager".
--
-- Two halves, because RLS cannot restrict columns:
--
--   1. The base table narrows to your own row, or everything if you manage users.
--   2. A definer-view exposes just (id, nama) to everyone, which is all attribution
--      needs. Definer on purpose: security_invoker would re-apply the base policy and
--      the view would show nothing.
drop policy profiles_select_authenticated on profiles;

create policy profiles_select_own_or_manager on profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or caller_may('pengguna', 'manage')
  );

create view profiles_ringkas as
  select id, nama from public.profiles;

grant select on profiles_ringkas to authenticated;
