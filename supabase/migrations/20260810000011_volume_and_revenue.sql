-- Volume, and therefore revenue.
--
-- The source workbook has no volume, which is why the spec put revenue out of scope:
-- tarif alone cannot be summed, because Ground Handling is priced per handling, Cargo
-- per kg and Ancillary as a flat fee. Adding those together is arithmetic on
-- incompatible units.
--
-- Volume fixes that rather than working around it. Rp/kg × kg and Rp/handling ×
-- handlings are both Rupiah, so once a contract carries a volume its revenue is
-- comparable with every other contract's and a portfolio total means something.
--
-- Nullable on purpose, and seeded null: no volume is invented. A contract without one
-- reports no revenue rather than zero, and the dashboard says how much of the book it
-- is actually totalling.
alter table contracts add column volume numeric(18, 2);

alter table contracts add constraint contracts_volume_positive
  check (volume is null or volume > 0);
