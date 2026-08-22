-- Three enum values for the new capabilities. Their own migration, because Postgres
-- refuses to read a value inside the transaction that added it (SQLSTATE 55P04) —
-- the policies that call caller_may('keputusan', …) live in the next file.

alter type app_module add value if not exists 'keputusan';
alter type app_module add value if not exists 'audit';
alter type grant_action add value if not exists 'export';
