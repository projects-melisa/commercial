-- `Penalty_Data` gets pulled too, now that it has a header row.
--
-- The tab was empty and headerless until this project wrote one, so these column
-- names are ours rather than the client's — recorded as C-15 in the spec. The natural
-- key follows from what the tab actually identifies a penalty by: who it is against,
-- what happened, and when it was reported.
--
-- `nulls not distinct` for the same reason as the other keys: `ReportedDate` may be
-- blank on a penalty nobody has dated yet, and under the default the pull would
-- insert a fresh copy of that row every night.
alter table penalties
  add constraint penalties_sheet_key
  unique nulls not distinct (customer_id, deskripsi, dilaporkan_pada);

notify pgrst, 'reload schema';
