-- The four KPS units — finance, op, os, ocs — could reach only "Kontrak Commercial"
-- on `/pilih`, a chooser with one card on it for four of nine roles. They sit at the
-- same unrestricted scope as commercial_kps (no business_line, no cabang — see
-- demo-accounts.ts), so there was no scope reason to hold them back from the
-- portfolio-performance read every other headquarters role already has.
insert into role_module_grants (role, modul, aksi) values
  ('finance_kps', 'pendapatan', 'view'),
  ('op_kps',      'pendapatan', 'view'),
  ('os_kps',      'pendapatan', 'view'),
  ('ocs_kps',     'pendapatan', 'view');
