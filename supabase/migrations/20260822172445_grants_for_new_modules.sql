-- The grant rows for the three new capabilities. A separate migration because
-- Postgres will not let a transaction read the enum values it just added.

insert into role_module_grants (role, modul, aksi) values
  -- keputusan: everyone who holds kontrak:view may read; commercial records, vp stamps.
  ('commercial_kps', 'keputusan', 'view'),
  ('vp',             'keputusan', 'view'),
  ('direktur_utama', 'keputusan', 'view'),
  ('finance_kps',    'keputusan', 'view'),
  ('op_kps',         'keputusan', 'view'),
  ('os_kps',         'keputusan', 'view'),
  ('ocs_kps',        'keputusan', 'view'),
  ('commercial_kps', 'keputusan', 'input'),
  ('vp',             'keputusan', 'approve'),

  -- audit: the watchers of the system, none of whom may write or erase.
  ('super_admin',    'audit', 'view'),
  ('vp',             'audit', 'view'),
  ('direktur_utama', 'audit', 'view'),

  -- export: a separate right from view, and withheld from cabang until the client
  -- decides otherwise (audit U-6 / question §7.3).
  ('commercial_kps', 'pendapatan', 'export'),
  ('finance_kps',    'piutang',    'export'),
  ('op_kps',         'penalty',    'export');

-- Irregularities stays OCS-exclusive by decision: os_kps gets penalty:input only,
-- and no irregularities grant anywhere in this file is the record of that.
