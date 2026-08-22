-- A line-scoped Commercial account, because the RLS suite needs one and the Admin API
-- of the local GoTrue no longer accepts the legacy HS256 service token to mint users
-- at test time. Seeded like its nine siblings: fixed uuid, role-named, empty tokens.
--
-- Cargo Handling is the line used by scope.test / scenarios.test / reminders.test as
-- "the other line" — Ground Handling is what every unscoped account already covers.

do $$
declare
  akun_id uuid := '11111111-0000-4000-8000-000000000007'::uuid;
begin
  if exists (select 1 from auth.users u where u.id = akun_id) then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', akun_id, 'authenticated', 'authenticated',
    'cargo@gapura.test', extensions.crypt('Gapura2026!', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    json_build_object('nama', 'Commercial KPS Cargo')::jsonb,
    now(), now(), '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), akun_id, akun_id::text, 'email',
    json_build_object('sub', akun_id::text, 'email', 'cargo@gapura.test', 'email_verified', true)::jsonb,
    now(), now(), now()
  );

  insert into public.profiles (id, nama, role, business_line, cabang)
  values (akun_id, 'Commercial KPS Cargo', 'commercial_kps', 'Cargo Handling', null);
end $$;
