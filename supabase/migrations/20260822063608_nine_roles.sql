-- Sembilan role, dari matriks klien plus satu yang matriksnya lupa.
--
-- 'commercial' diganti nama, bukan ditambah lalu dimigrasi: RENAME VALUE bawa
-- kelima baris profiles yang megang nilai itu tanpa satupun UPDATE. 'vp' dan
-- 'cabang' sudah bernama benar dan tidak disentuh.
--
-- Nilai baru ditambahkan di migrasi ini dan baru DIPAKAI di migrasi berikutnya.
-- Postgres melarang sebuah nilai enum dibaca dalam transaksi yang menambahkannya.

alter type user_role rename value 'commercial' to 'commercial_kps';

alter type user_role add value if not exists 'direktur_utama';
alter type user_role add value if not exists 'finance_kps';
alter type user_role add value if not exists 'op_kps';
alter type user_role add value if not exists 'os_kps';
alter type user_role add value if not exists 'ocs_kps';
alter type user_role add value if not exists 'super_admin';
