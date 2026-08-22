-- Agent or Non-Agent, from the Sheet rather than from a guess.
--
-- The LoB tab splits RFM into B2B and B2C, which here means organisations against
-- individual people. That split was briefly inferred from the shape of the customer's
-- name and it read "Citilink" as a person — an airline listed under *pelanggan
-- perorangan* is a mistake that looks entirely plausible, which is the worst kind.
--
-- `CRM_Data` now carries a `Customer Type` column and the daily pull brings it across.
-- Nullable, because a customer added to the Sheet before the column was filled in has
-- no answer, and inventing one is what this migration exists to stop.

create type customer_type as enum ('agent', 'non_agent');

alter table customers add column tipe customer_type;

comment on column customers.tipe is
  'Agent (organisation, B2B) or Non-Agent (individual, B2C), from CRM_Data.
   Null means the Sheet has not said — never guess from the name.';

create index customers_tipe_idx on customers (tipe);

notify pgrst, 'reload schema';
