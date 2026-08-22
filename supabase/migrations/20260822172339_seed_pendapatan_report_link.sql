-- Initial Power BI link for `pendapatan`, editable afterward from Pengaturan by
-- anyone holding `report_links:manage` (super_admin). A migration seeds it once so
-- the button is not empty on first deploy; it is not the only way to change it.
insert into report_links (modul, judul, url, aktif) values (
  'pendapatan',
  'Dashboard Power BI',
  'https://app.powerbi.com/reportEmbed?reportId=7832b105-f3b2-4210-a209-060cac6ec072&autoAuth=true&ctid=f279df50-142d-4efa-b0bb-01ea6518db58&actionBarEnabled=true',
  true
)
on conflict (modul) do update set judul = excluded.judul, url = excluded.url, aktif = excluded.aktif;
