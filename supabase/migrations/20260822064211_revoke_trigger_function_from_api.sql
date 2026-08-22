-- Fungsi trigger tidak boleh bisa dipanggil sebagai RPC.
--
-- CREATE OR REPLACE mengembalikan hak EXECUTE ke PUBLIC, sehingga fungsi ini —
-- yang menulis notifikasi dan menerapkan tarif ke kontrak — sempat terbuka lewat
-- /rest/v1/rpc. Ia dijalankan oleh triggernya, bukan oleh siapa pun yang memanggil.
revoke execute on function scenarios_enforce_transitions() from public, anon, authenticated;
