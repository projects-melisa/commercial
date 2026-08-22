-- Enam akun demo untuk enam role baru, satu per role.
--
-- Tidak ada orang yang dikarang: profil dinamai menurut peran yang dipegangnya,
-- sesuai aturan bahwa tidak ada yang ditampilkan tanpa dasar.
--
-- UUID ditulis tetap, bukan gen_random_uuid(), supaya menjalankan ulang migrasi
-- ini pada lingkungan lain menghasilkan id yang sama dan tes RLS bisa menyebut
-- mereka langsung.
--
-- Kolom token diisi string kosong, bukan NULL: GoTrue membacanya ke dalam string
-- Go yang tidak nullable, dan NULL membuat setiap sign-in gagal dengan
-- "Database error querying schema".

do $$
declare
  akun record;
begin
  for akun in
    select * from (values
      ('11111111-0000-4000-8000-000000000001'::uuid, 'dirut@gapura.test',      'Direktur Utama', 'direktur_utama'),
      ('11111111-0000-4000-8000-000000000002'::uuid, 'finance@gapura.test',    'Finance KPS',    'finance_kps'),
      ('11111111-0000-4000-8000-000000000003'::uuid, 'op@gapura.test',         'OP KPS',         'op_kps'),
      ('11111111-0000-4000-8000-000000000004'::uuid, 'os@gapura.test',         'OS KPS',         'os_kps'),
      ('11111111-0000-4000-8000-000000000005'::uuid, 'ocs@gapura.test',        'OCS KPS',        'ocs_kps'),
      ('11111111-0000-4000-8000-000000000006'::uuid, 'superadmin@gapura.test', 'Super Admin',    'super_admin')
    ) as t(id, email, nama, peran)
  loop
    if exists (select 1 from auth.users u where u.id = akun.id) then
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', akun.id, 'authenticated', 'authenticated',
      akun.email, extensions.crypt('Gapura2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      json_build_object('nama', akun.nama)::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), akun.id, akun.id::text, 'email',
      json_build_object('sub', akun.id::text, 'email', akun.email, 'email_verified', true)::jsonb,
      now(), now(), now()
    );

    insert into public.profiles (id, nama, role, business_line, cabang)
    values (akun.id, akun.nama, akun.peran::public.user_role, null, null);
  end loop;
end $$;
