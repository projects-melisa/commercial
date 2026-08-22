-- The ancillary natural key grows to the width of the row it identifies.
--
-- `(cab, plan_actual, customer, periode, group_1_gl)` was checked against all 8,155
-- Sheet rows on 22 Aug 2026: zero collisions. But the row carries more attributes than
-- the key names — `group_2_gl`, `group_3_gl`, `text_pl`, `production` — and the day one
-- customer books two `group 3 GL` lines on the same day and LoB, merge-duplicates would
-- quietly overwrite one with the other and the revenue would vanish without an error.
-- A silent loss is worse than a failed pull, so the key is widened before the data can
-- produce the collision rather than after.
alter table ancillary_revenues drop constraint ancillary_revenues_sheet_key;

alter table ancillary_revenues
  add constraint ancillary_revenues_sheet_key
  unique nulls not distinct
    (cab, plan_actual, customer, periode, group_1_gl, group_2_gl, group_3_gl);

notify pgrst, 'reload schema';
