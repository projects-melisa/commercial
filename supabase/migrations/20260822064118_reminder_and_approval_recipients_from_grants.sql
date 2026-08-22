-- Dua tempat terakhir yang masih menyebut nama role secara harfiah.
--
-- Keduanya benar ketika hanya ada tiga role. Dengan sembilan, keduanya melebar
-- diam-diam: `p.role <> 'vp'` kini mencakup super admin — satu-satunya role yang
-- sengaja dibuat tidak melihat data bisnis — dan isi pengingat memuat nama
-- pelanggan serta tanggal berakhir kontrak.
--
-- Keduanya dialihkan ke tabel grant, sehingga penerima sebuah pesan dan pemegang
-- sebuah izin tidak bisa lagi berbeda pendapat.

/**
 * Penerima pengingat kedaluwarsa.
 *
 * Dipilih lewat `simulator:input`, bukan `kontrak:view`. Isi pengingatnya berbunyi
 * "siapkan posisi renegosiasi sekarang" — dan menyusun posisi itu persis yang
 * diizinkan `simulator:input`. Role yang hanya memantau tidak diminta bertindak,
 * jadi ia tidak dikirimi permintaan bertindak.
 *
 * Cabang keluar dari daftar ini sebagai akibat langsung dari keputusan bahwa
 * cabang tidak memegang kontrak sama sekali.
 */
create or replace function send_expiry_reminders(target_contract_id uuid default null)
  returns setof reminder_outcome
  language plpgsql
  security definer
  set search_path = ''
as $function$
declare
  result public.reminder_outcome;
  new_notification_id uuid;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for result in
    select
      c.id,
      cu.nama,
      (c.contract_end_date - today)::integer as days_remaining,
      case
        when (c.contract_end_date - today) <= 14 then 14
        when (c.contract_end_date - today) <= 30 then 30
        else 60
      end as milestone,
      p.id,
      null::uuid
    from public.contracts c
    join public.customers cu on cu.customer_id = c.customer_id
    join public.profiles p
      on exists (
           select 1 from public.role_module_grants g
           where g.role = p.role and g.modul = 'simulator' and g.aksi = 'input')
     and (p.business_line is null or p.business_line = c.business_line)
     and (p.cabang is null or c.cabang is null or p.cabang = c.cabang)
    where
      (c.contract_end_date - today) <= 60
      and (
        target_contract_id is null
        or (
          c.id = target_contract_id
          -- Re-impose the caller's scope: RLS does not apply inside a security
          -- definer function, so a caller must not reach a contract here that they
          -- could not have selected directly.
          and public.in_caller_scope(c.business_line, c.cabang)
        )
      )
  loop
    insert into public.notifications (
      recipient_id, severity, title, body, contract_id, milestone_key
    )
    values (
      result.recipient_id,
      (case
        when result.days_remaining <= 14 then 'critical'
        when result.days_remaining <= 30 then 'warning'
        else 'info'
      end)::public.notification_severity,
      case
        when result.days_remaining < 0
          then format('Kontrak %s sudah lewat tempo', result.customer_nama)
        when result.days_remaining = 0
          then format('Kontrak %s berakhir hari ini', result.customer_nama)
        else format('Kontrak %s H-%s', result.customer_nama, result.days_remaining)
      end,
      case
        when result.days_remaining < 0 then format(
          'Kontrak %s telah melewati tanggal berakhir %s hari lalu. Segera konfirmasi status perpanjangan.',
          result.customer_nama, abs(result.days_remaining))
        else format(
          'Kontrak %s akan berakhir dalam %s hari. Siapkan posisi renegosiasi sekarang.',
          result.customer_nama, result.days_remaining)
      end,
      result.contract_id,
      format('expiry-%s', result.milestone)
    )
    on conflict (recipient_id, contract_id, milestone_key) where milestone_key is not null
    do nothing
    returning id into new_notification_id;

    result.notification_id := new_notification_id;
    return next result;
  end loop;
end;
$function$;

/**
 * Penerima pemberitahuan "skenario menunggu persetujuan".
 *
 * Dulu `p.role = 'vp'`. Kini siapa pun yang memegang `simulator:approve`, sehingga
 * menambah pemberi persetujuan kedua kelak berarti satu baris di tabel grant, bukan
 * mengingat bahwa ada trigger yang juga perlu disunting.
 */
create or replace function scenarios_enforce_transitions()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $function$
declare
  contract_row public.contracts%rowtype;
  customer_nama text;
  author_nama text;
begin
  if old.status = new.status then
    if old.status = 'pending' then
      raise exception 'a pending scenario cannot be edited; it awaits a decision';
    end if;
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'pending')
    or (old.status = 'pending' and new.status in ('approved', 'rejected'))
  ) then
    raise exception 'invalid scenario transition: % -> %', old.status, new.status;
  end if;

  if old.status = 'pending' and (
    new.proposed_tarif is distinct from old.proposed_tarif
    or new.proposed_cost is distinct from old.proposed_cost
    or new.contract_id is distinct from old.contract_id
    or new.nama is distinct from old.nama
  ) then
    raise exception 'a scenario under decision cannot have its figures changed';
  end if;

  select * into contract_row from public.contracts where id = new.contract_id;
  select nama into customer_nama from public.customers where customer_id = contract_row.customer_id;
  select nama into author_nama from public.profiles where id = new.author_id;

  if new.status = 'pending' then
    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    select
      p.id,
      'info',
      'Skenario menunggu persetujuan',
      format(
        'Skenario "%s" untuk %s diajukan oleh %s. GPM usulan %s%% terhadap target %s.',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id),
        coalesce(author_nama, 'Commercial'),
        to_char(new.gpm * 100, 'FM990.0'),
        coalesce(to_char(contract_row.min_gpm_target * 100, 'FM990.0') || '%', 'yang belum ditetapkan')
      ),
      new.contract_id
    from public.profiles p
    where exists (
      select 1 from public.role_module_grants g
      where g.role = p.role and g.modul = 'simulator' and g.aksi = 'approve');

  elsif new.status = 'approved' then
    -- ponytail: contracts_cost_below_tarif refuses a scenario whose cost exceeds its
    -- tarif, so an unapplicable proposal fails the approval rather than silently
    -- landing. Blocking such a scenario at submission would be the nicer error.
    update public.contracts
      set tarif = new.proposed_tarif,
          cost = new.proposed_cost
      where id = new.contract_id;

    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    values (
      new.author_id,
      'info',
      'Skenario disetujui',
      format(
        'Skenario "%s" untuk %s disetujui dan sudah diterapkan ke kontrak.',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id)
      ),
      new.contract_id
    );

  elsif new.status = 'rejected' then
    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    values (
      new.author_id,
      'warning',
      'Skenario ditolak',
      format(
        'Skenario "%s" untuk %s ditolak. Alasan: %s',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id),
        new.rejection_reason
      ),
      new.contract_id
    );
  end if;

  return new;
end;
$function$;

-- Tidak lagi dipanggil kebijakan mana pun; persetujuan kini dibaca lewat grant.
drop function if exists caller_is_vp();
