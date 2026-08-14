# Gapura Commercial: Contract Monitoring & Dynamic P&L Simulator

Specification for PT Gapura Angkasa — Gapura Innovation Summit 2026.
Tracked as [issue #1](https://github.com/projects-melisa/commercial/issues/1),
whose body still holds revision 1; this file is authoritative.

> **Revision 2** — rewritten against the real source workbook
> (`Master_Database_Komersial_Compiled.xlsx`, 4 sheets, 20 customers). The first
> revision assumed a branch-scoped schema with monthly revenue history; neither
> exists in the real data. Changes are summarised at the end.

## Problem Statement

Renewing a commercial contract at PT Gapura Angkasa means assembling a picture that
does not exist in any one place. Contract terms sit in one sheet, the margin target
that judges whether a renewal is acceptable sits in another, customer standing in a
third, and service failures in a fourth. Nothing joins them.

The consequences the commercial team lives with:

- Nobody can see which contracts are about to expire without going and looking.
  Contracts pass their end date before anyone has prepared a position, so the
  renegotiation starts from the back foot or the revenue is simply lost. In the
  current data three contracts are **already past their end date** and three more
  fall due inside a fortnight.
- Each contract carries its own minimum margin target, ranging from 20% to 35%.
  Checking a proposed tarif against the right target means finding the right row in
  a different sheet. It is slow enough that it is often not done at all.
- Whether a customer is worth fighting for, and whether they have open service
  complaints against them, are two more lookups in two more places — so a
  renegotiation often starts without either.
- Consolidating all of this creates the risk that stopped it happening before:
  tarif and cost are commercially sensitive, and one shared view means every
  business line can see every other line's margins.

## Solution

A single web dashboard, **Gapura Commercial (Contract & Margin Engine)**, holding contract,
margin, customer and case data in one governed database, showing each person only
what their role and their business line entitle them to see.

Three kinds of user:

- **VP / Dirut DC** monitor. They see all 20 contracts across all three business
  lines with full tarif and cost, and they approve or reject the pricing scenarios
  Commercial puts forward. They do not enter data.
- **Commercial** work one business line. They see and edit only contracts in their
  own `business_line`, and run pricing simulations against each contract's own
  margin target.
- **GM Cabang** hold Commercial's authority over one station. They see and edit
  every contract at their own airport, across all three business lines, and none
  anywhere else.

Scope is therefore two dimensions — business line and station — and they compose. A
profile carrying neither is unconfined on that axis, which is what lets one
Commercial user cover all three lines; a profile carrying a station is confined to
it whatever its line.

Access is enforced in the database by Postgres row-level security, not by hiding
things in the interface — a Cargo Handling user querying for Ground Handling
contracts gets nothing back, and so does a Cabang KNO user querying for Cabang CGK,
because those rows are not visible to their session.

On top of that:

- A **single panel view** of portfolio health — contract counts by status band,
  margin against target, composition by business line, expiry timeline.
- A **critical contracts** queue, banded by urgency, so renewals are worked from a
  list rather than from memory.
- A **Dynamic P&L Simulator**: move tarif and cost, watch gross profit margin
  recompute live **against that contract's own `Min_GPM_Target`**, save the
  scenario, submit the chosen one for VP approval.
- **Customer insight**: the customer's RFM standing, their contract, and their open
  and closed service cases in one place.
- **Automatic reminders** at 60, 30 and 14 days before expiry, by email and in-app,
  using the same thresholds that drive the status badges.
- A **Google Sheets mirror** that reproduced the workbook's four tabs so existing
  spreadsheet work kept functioning. **Suspended** — see "Who owns what" below: the
  Sheet became the source of truth, and a job that writes the database back over it
  would overwrite newer data with older.

## Source Data

**The Google Sheet `Master_Database_Komersial_Compiled` is authoritative.** Where the
database and the Sheet disagree, the database is wrong and gets adjusted. Nothing on
screen is invented; every figure traces to a cell. `pnpm seed:generate` reads the
Sheet directly and writes `supabase/seed.sql`.

| Tab | Rows | Columns used |
|---|---|---|
| `Compiled_Contracts` | 12 | ContractID, CustomerID, CustomerName, Station, BusinessLine, ContractStartDate, ContractEndDate, Tarif/Handling, Cost/Handling, PIC Customer, Number PIC, Email PIC, Remarks, Latest Contract |
| `CRM_Data` | 9 | CustomerID, CustomerName, RFM_Status, Frequency/Monetary/Recency Score |
| `CS_Data` | 10 | CustomerID, CaseDescription, CaseStatus |
| `Revenue_Data` | 20 | **Stale.** Still keyed on the retired `CUST-GH-*` ids; nothing reads it. |

Shape of it: `CustomerID` keys everything, and customers are **1:many** with
contracts — Garuda Indonesia holds both a Ground Handling contract and a Cargo one,
Batik Air holds two. `Station` may name one airport, several, or "All Station"; the
importer stores one row per station, which is what the Sheet itself already does for
K-010 (CGK and DPS, priced differently at each). 12 rows therefore become **15
contract lines**: Ground Handling 11, Cargo Handling 2, Ancillary Business 2, and
All Station 6 / CGK 3 / SUB 2 / BTH, DPS, MDC, UPG 1 each.

**Superseded.** `Master_Database_Komersial_Compiled.xlsx` was the original source and
is no longer read; `scripts/lib/read-workbook.ts` is kept for the record only. Its
customers (`CUST-GH-001`, "Garuda Nusantara Airlines") were replaced wholesale by the
Sheet's real ones (`CUST-001`, "Garuda Indonesia"), so the two cannot be reconciled
row by row — the Sheet simply replaced them.

**What the Sheet does not contain**, and is therefore null rather than invented:

- **`Min_GPM_Target`** — no column at all, and `Revenue_Data` still keys on the retired
  ids so it cannot supply one. Every imported contract has a null target: it is
  excluded from below-target counts, the simulator computes GPM but reports no verdict
  and no tarif floor, and the interface says "belum ditetapkan" rather than "0%".
  **This is the one gap worth closing in the Sheet**, because margin against target is
  the product's whole subject.
- **`ServiceType`** — absent. `Remarks` (Airlines, FBO, GSE, Cargo, Joumpa, Learning
  Centre) reads like a segment and is imported as `remarks` rather than quietly
  renamed into `service_type`, which stays null.
- No volume, no revenue amounts, no transaction history.

**Tarif units are not comparable across business lines** — Ground Handling is priced
per handling (Rp 7.5M–31M), Cargo per kg (Rp 4,200–11,500), Ancillary as flat fees
(Rp 250,000–120,000,000). Without volume there is no meaningful portfolio revenue
total, so none is shown. Margin percentages remain comparable and are used instead.

## User Stories

### Access and identity

1. As a Commercial user, I want to sign in with an email and password, so that I can reach data that is not public.
2. As a Commercial user, I want my role and business line to come from my account rather than from something I select at sign-in, so that I cannot grant myself access I am not entitled to.
3. As a judge evaluating the demo, I want to pick a demo persona and have its credentials filled in for me, so that I can get in without being handed a password list.
4. As a Commercial user in Cargo Handling, I want to see only Cargo Handling contracts, so that I am not exposed to other lines' commercial terms.
5. As a VP, I want to see contracts across all three business lines, so that I can monitor the portfolio as a whole.
6. As a security reviewer, I want business-line scoping enforced by the database rather than the interface, so that the restriction holds even if a query is written incorrectly.
7. As any user, I want to sign out, so that I do not leave an authenticated session open on a shared screen.
8. As any user, I want to be sent to sign-in when my session expires, so that I am never shown a broken page instead of data.

### Portfolio overview

9. As a VP, I want to see the total number of contracts, so that I know the size of the portfolio.
10. As a VP, I want to see how many contracts fall due within 60 days, so that I know the size of the renewal workload.
11. As a VP, I want to see how many contracts are already past their end date, so that I know what has been missed.
12. As a VP, I want to see the average gross profit margin, so that I can judge commercial health.
13. As a VP, I want to see how many contracts sit below their own margin target, so that I know where margin is leaking.
14. As a Commercial user, I want the headline figures to reflect only the contracts I can see, so that they agree with the table beneath them.
15. As a Commercial user, I want a contract list showing customer, business line, service type, status, days remaining, end date, RFM standing, tarif, GPM and GPM-versus-target, so that I can triage without opening each row.
16. As a Commercial user, I want to search that list by customer name, so that I can find a contract quickly.
17. As a Commercial user, I want to filter by status band, business line and RFM standing, so that I can narrow to what I am working on.
18. As a Commercial user, I want the list sortable by days remaining and by margin, so that I can order it by whichever risk I am chasing.
19. As a VP, I want to see contracts distributed across status bands, so that I can see the shape of the renewal pipeline.
20. As a VP, I want to see the portfolio composed by business line and service type, so that I can see where the book is concentrated.
21. As a VP, I want an expiry timeline by month, so that I can anticipate future workload rather than only current urgency.
22. As a VP, I want the distribution of margin across contracts, so that I can see spread rather than only the average.

### Contract detail

23. As a Commercial user, I want to open a contract and see customer, business line, service type, end date, tarif, cost, margin and margin target, so that I have the full position before a negotiation.
24. As a Commercial user, I want current GPM shown against that contract's own `Min_GPM_Target`, so that I know whether it is acceptable by its own terms rather than a generic threshold.
25. As a Commercial user, I want days remaining and end date shown prominently, so that I know how much time I have.
26. As a Commercial user, I want to see that customer's RFM standing on the contract, so that I know how hard to fight for it.
27. As a Commercial user, I want to see that customer's open service cases on the contract, so that I go in knowing what they will raise.
28. As a Commercial user, I want to open the simulator from a contract with its figures and target pre-loaded, so that I do not retype them.
29. As a Commercial user, I want to edit a contract in my business line, so that I can correct or update its terms.
30. As a Commercial user, I want to be prevented from editing a contract outside my business line, so that I cannot write outside my scope.
31. As a VP, I want editing to be unavailable to me, so that the monitoring role cannot alter commercial data.
32. As a Commercial user, I want validation on tarif, cost and end date before saving, so that impossible values never reach the database.
33. As a Commercial user, I want to be warned when an edit would push margin below the contract's target, so that I do not breach it by accident.

### Critical contracts

34. As a Commercial user, I want a dedicated view of contracts approaching or past their end date, so that renewals are worked from a queue.
35. As a Commercial user, I want that queue grouped into urgency bands, so that I deal with the most urgent first.
36. As a Commercial user, I want expired contracts shown separately, so that they do not crowd out the ones I can still save.
37. As a Commercial user, I want each entry to state why it needs attention, so that I can decide without opening it.
38. As a Commercial user, I want a suggested next action on each entry, so that the queue tells me what to do rather than only what is wrong.
39. As a Commercial user, I want open service cases surfaced in this queue, so that a renewal with unresolved complaints is visibly harder.
40. As a Commercial user, I want to send a reminder for a specific contract from this view, so that I can prompt a colleague at the moment I notice.

### Dynamic P&L Simulator

41. As a Commercial user, I want to adjust tarif with a slider and see gross profit margin recompute immediately, so that I can find a price that protects the margin.
42. As a Commercial user, I want to adjust cost the same way, so that I can model a change in the cost base.
43. As a Commercial user, I want baseline figures shown beside simulated ones, so that I can see exactly what my change does.
44. As a Commercial user, I want the resulting margin compared against this contract's own target, so that acceptable and unacceptable are unambiguous.
45. As a Commercial user, I want the display to change state the moment the simulated margin crosses the target, so that the limit is obvious without arithmetic.
46. As a Commercial user, I want to see the minimum tarif that still meets the target at the current cost, so that I know my floor before I negotiate.
47. As a Commercial user, I want a written insight explaining the result, so that I have language to take into the meeting.
48. As a Commercial user, I want to reset to the contract's real figures, so that I can start over.
49. As a Commercial user, I want to save a scenario with a name, so that I can compare options later.
50. As a Commercial user, I want to see the scenarios saved against a contract, so that I can revisit my reasoning.
51. As a Commercial user, I want to submit a saved scenario for approval, so that a VP can sign off the pricing.
52. As a Commercial user, I want to see whether a submitted scenario is pending, approved or rejected, so that I know where it stands.
53. As a VP, I want a queue of scenarios awaiting my decision, so that I know what needs me.
54. As a VP, I want to see proposed tarif and cost against current ones, and the resulting margin against target, so that I can judge the change.
55. As a VP, I want to approve a scenario, so that Commercial can proceed.
56. As a VP, I want to reject a scenario with a reason, so that Commercial understands why.
57. As a Commercial user, I want to be notified when my scenario is decided, so that I need not keep checking.
58. As a VP, I want a decided scenario to be unchangeable, so that the record of what was approved is trustworthy.

### Customer insight

59. As a Commercial user, I want to open a customer and see their RFM standing, so that I can judge the relationship.
60. As a Commercial user, I want to see the customer's contract, terms and margin position, so that standing and commercials sit together.
61. As a Commercial user, I want to see all service cases logged against a customer with their status, so that I know the service history.
62. As a Commercial user, I want open cases counted and highlighted, so that unresolved problems are visible before I negotiate.
63. As a Commercial user, I want a recommendation combining RFM standing, margin position and open cases, so that the insight leads to an action.
64. As a Commercial user, I want to see customers with high standing but open cases, so that I can protect relationships that are quietly at risk.

### Reports and analytics

65. As a VP, I want margin distribution across the portfolio, so that I can see spread rather than only an average.
66. As a VP, I want every contract's GPM plotted against its own target, so that I can see who is close to breaching.
67. As a VP, I want performance compared across business lines, so that I can see which line runs the healthiest book.
68. As a VP, I want an expiry timeline by month, so that I can plan renewal workload.
69. As a VP, I want the RFM composition of the customer base, so that I can see how it is weighted.
70. As a VP, I want service cases summarised by status and business line, so that I can see where operational problems concentrate.
71. As a VP, I want to export the current view, so that I can use it in a paper pack.
72. As a VP, I want reports to obey the same access rules as everything else, so that figures stay consistent across the application.

### Notifications and reminders

73. As a Commercial user, I want a notification centre listing alerts relevant to me, so that I have one place to check.
74. As a Commercial user, I want unread notifications visibly counted, so that I notice new ones.
75. As a Commercial user, I want to mark a notification read, and to mark all read, so that the list stays useful.
76. As a Commercial user, I want to filter notifications by severity, so that I can find the critical ones.
77. As a Commercial user, I want to click a notification and land on the contract it concerns, so that I can act immediately.
78. As a Commercial user, I want an email when one of my contracts reaches 60, 30 or 14 days from expiry, so that I am prompted without opening the dashboard.
79. As a Commercial user, I want the same event in the notification centre, so that the two are never out of step.
80. As a Commercial user, I want reminders to fire automatically each day, so that the system does not depend on anyone remembering.
81. As a Commercial user, I want to send a reminder on demand, so that I can prompt a colleague at will.
82. As a Commercial user, I want the same reminder not to be sent twice for the same milestone, so that the emails stay meaningful.
83. As a VP, I want to be notified when a scenario is submitted to me, so that the approval queue does not stall.

### Settings

84. As any user, I want to see my profile, role and business line, so that I can confirm which identity I am working under.
85. As any user, I want to see the status bands and reminder milestones in effect, so that I know what "Kritis" means and when alerts fire.
86. As a VP, I want to see that margin targets are set per contract, so that I do not mistake them for one global threshold.
87. As a VP, I want to see when data was last synced, so that I know how current the figures are.

### Sheets mirror

88. As a Commercial user, I want a Google Sheet mirroring the source workbook's four sheets, so that existing spreadsheet work keeps functioning.
89. As a Commercial user, I want the mirror to use the same headers as the source, so that formulas and pivots built against it do not break.
90. As a Commercial user, I want it refreshed automatically, so that it does not silently go stale.
91. As a VP, I want the sheet to be a copy rather than an input, so that the database remains the single source of truth.

### Cross-cutting

92. As any user, I want a loading state while data is fetched, so that the interface does not appear frozen.
93. As any user, I want a clear message when something fails, with a way to retry, so that I am not stuck on a blank screen.
94. As any user, I want an explanatory empty state when there is genuinely no data, so that I do not mistake it for an error.
95. As a Commercial user in Ancillary Business, I want my five contracts to fill the screen sensibly, so that a small scope does not look broken.
96. As any user, I want to use the dashboard on a phone or tablet, so that I can check it away from my desk.
97. As a keyboard user, I want to reach and operate every control without a mouse, so that I can use the application at all.
98. As a screen reader user, I want controls and status indicators announced meaningfully, so that colour is not the only carrier of meaning.
99. As an Indonesian-speaking user, I want the interface in Indonesian with Rupiah formatted to local convention, so that it reads naturally.

## Implementation Decisions

### Framework and hosting

- **Next.js 16.3, App Router**, React 19, TypeScript. 16.2.11 is the Active LTS if pinning becomes necessary.
- Server Components for data-heavy pages; **Server Actions** for mutations. No separate REST layer except where an external trigger needs an endpoint.
- Tailwind v4, `lucide-react`, Recharts — carried over from the prototype.
- Deployed on **Vercel free tier**.
- The Vite/Figma Make prototype is replaced in place, preserved at commit `e633559` as the visual reference.

### Data layer

- **Supabase (Postgres) is the system of record and the only thing the application reads.** Supabase Auth for identity.
- **Superseded in part.** Supabase is no longer where the commercial data *originates*: the Google Sheet is, and Supabase is loaded from it. Supabase remains the source of truth for everything the Sheet cannot express — identity, roles, scopes, scenarios, notifications, and the row-level security that is the point of the system.
- Rejected: SharePoint. The free Microsoft 365 E5 developer sandbox requires a Visual Studio Professional/Enterprise subscription, ISV Success/MAICPP partnership, or a Premier/Unified Support contract. A new personal Microsoft account qualifies for none, and the sandbox is 90-day and documented as unsuitable for production data.
- Rejected at the time: Google Sheets as source of truth, for having no row- or column-level read security. **That reasoning still holds and is why the Sheet is not read at request time.** It is read once, offline, by `pnpm seed:generate`; every user request is served by Postgres under RLS. The Sheet decides what the numbers are, Postgres decides who may see them.

### Schema

Normalised from the four sheets. `Revenue_Data` duplicates tarif and cost from
`Compiled_Contracts`; the duplication is dropped on import and only
`Min_GPM_Target` is carried across onto the contract row.

- `profiles` — one row per auth user: `nama`, `role` (`vp` | `commercial` | `cabang`), `business_line` and `cabang` (both null for `vp`; null on either means "all of them"). Role is never client-supplied.
- `cabang` — the station list: `kode` (IATA), `nama`, `kota`. Reference data carried by the migration rather than the generated seed, because the source workbook has no stations. Readable by any signed-in user; written by nobody.
- `customers` — 9 rows from `CRM_Data`: `customer_id` (natural key, e.g. `CUST-001`), `nama`, `rfm_status` (`HIGH` | `MEDIUM` | `LOW`), and the three RFM component scores.
- `contracts` — 15 contract lines from 12 Sheet rows, **1:many** with customers: `contract_no`, `customer_id`, `business_line`, `cabang`, `service_type`, `contract_start_date`, `contract_end_date`, `tarif`, `cost`, `min_gpm_target`, PIC fields, `remarks`, `latest_contract`.
- `cases` — 10 rows: `customer_id`, `description`, `status` (`OPEN` | `CLOSED`). Commercial and GM Cabang may log and close them; nobody may delete.
- `scenarios` — contract, name, proposed tarif/cost, computed GPM, author, `status` (`draft` | `pending` | `approved` | `rejected`), decided-by, decided-at, rejection reason.
- `notifications` — recipient, severity, title, body, related contract, read flag, milestone key for idempotency.

Derived, never stored: GPM as `(tarif - cost) / tarif`; days remaining from
`contract_end_date`; status band from days remaining; margin health as GPM against
`min_gpm_target`.

Deliberately absent: no `revenue_bulanan`, no hub. The earlier revision's
monthly-revenue table has been removed rather than populated with invented figures.

**Superseded.** `volume` and `cabang` were both listed here as absent because the
source workbook supports neither. Both have since been added, for reasons the
workbook does not settle: volume because revenue is meaningless without it (see
"Volume, and therefore revenue"), and `cabang` because a station-scoped role was
asked for and a role needs something to be scoped by. The station assignment for the
20 seeded contracts is therefore the one figure in this system the source data does
not supply — it is stated in full in `scripts/generate-seed.ts` rather than derived,
so what each branch sees is reviewable rather than accidental.

### Status bands

Aligned to the reminder milestones so a badge and an email can never disagree:

| Days remaining | Band |
|---|---|
| past end date | `Nonaktif` |
| 0–14 | `Kritis` |
| 15–60 | `Perlu Perhatian` |
| over 60 | `Aman` |

On the source data this yields Nonaktif 3, Kritis 3, Perlu Perhatian 5, Aman 9 —
every band populated.

### Date handling

Contract end dates in the workbook cluster July–December 2026 and will age. Seeded as
**offsets from import date**, preserving the same relative spacing, so the renewal
pipeline stays populated whenever the demo is given. The original absolute dates are
retained in a `source_end_date` column so nothing is lost.

### Access control

- Row-level security enabled on every table; no table readable without a policy.
- `vp`: select on everything. No insert or update except the scenario decision transition.
- `commercial`: select and mutate restricted to rows whose `business_line` matches the caller's profile.
- `cabang`: the same rights as `commercial`, restricted instead to rows whose `cabang` matches the caller's profile. Writing is expressed as "not a VP" rather than as a list of writing roles, so a fourth role that manages contracts needs no policy edited.
- **Null means "all of them" on both sides.** A caller with no `cabang` is confined to no station; a *contract* with no `cabang` is the Sheet's "All Station" and belongs to every station, so it is visible at each of them. Migration 12 originally read a null contract station as portfolio-level work and hid it from every branch — the exact inverse — and migration 13 corrects it.
- Both dimensions are read through one function, `in_caller_scope(business_line, cabang)`, used by every policy. Leaving a single policy on the old line-only predicate would let a GM Cabang read the whole portfolio, because a station-scoped profile carries no business line and so passes a line check on its own.
- Policies are written against the authenticated user's profile, so scoping cannot be bypassed by a client-supplied parameter.
- The demo seeds three logins, one per role, and the GM Cabang is the confined one: scoped to CGK, it receives 9 of the 15 contract lines — 3 at CGK itself plus 6 "All Station" — and never sees the 6 that belong only to other airports. The property that used to be assertable only against a fixture user is now visible by signing in.
- **Superseded.** This originally seeded one Commercial user per business line plus one VP — four logins, four distinct row sets, the largest Commercial scope still hiding 60% of the portfolio. The demo now seeds **two logins, one per role**, and the Commercial account carries a null `business_line` meaning every line. A Commercial profile *with* a line is still confined by the policies exactly as before; no seeded account is. See "The demonstration of business-line confidentiality" below.

### Scenario approval state machine

```
draft ──submit──▶ pending ──approve──▶ approved   (terminal)
                     │
                     └────reject───▶ rejected     (terminal)
```

- Only the author (Commercial, matching `business_line`) may `submit`.
- Only `vp` may `approve` or `reject`; `reject` requires a reason.
- `approved` and `rejected` are terminal — no edits, no re-decision.
- Every transition writes a notification to the counterparty.

### Reminders

- A daily **`pg_cron`** job inside Supabase invokes an Edge Function that finds contracts at 60, 30 and 14 days from expiry, writes a notification row, and sends email.
- Not Vercel Cron: the Hobby plan allows one run per day and fires anywhere within the scheduled hour. Running the scheduler in Supabase also keeps the project from auto-pausing.
- Email via **Gmail SMTP with an App Password** (requires 2-Step Verification on the sending account).
- The manual "Kirim Reminder Sekarang" control invokes the **same** function, so demo and production paths cannot diverge.
- Idempotency on `(contract_id, milestone)`.
- Recipients are overridden to a configured address in non-production environments.

### Who owns what

One owner per stage, so nothing round-trips:

| Stage | Owner | Mechanism |
|---|---|---|
| The commercial figures themselves | **The Google Sheet** | Edited by hand by the commercial team |
| Reading them into the repo | `pnpm seed:generate` | `scripts/lib/read-sheet.ts`, read-only scope, raw cell values |
| Loading a database | `supabase db reset` (local) / `pnpm deploy:db --seed` (hosted) | The generated `supabase/seed.sql`, which **replaces** rather than merges |
| Everything the Sheet cannot express | **Postgres** | Identity, roles, scope, scenarios, notifications, RLS |
| Edits made in the application | **Postgres, and they do not flow back** | See the caveat below |

**The unresolved seam:** a contract edited in the application — a renewal, an approved
scenario applied to tarif and cost — changes Postgres and not the Sheet. The next
`seed:generate` and reseed would overwrite that edit with the Sheet's older figure.
Nothing currently reconciles the two, and this is the sharpest thing to settle before
the system is relied on beyond a demo.

### Google Sheets mirror — suspended

- Was one-way, Supabase → Sheets, written by a Google service account, reproducing the workbook's four tabs with identical headers so existing formulas kept working.
- **It now points the wrong way.** It clears each tab and rewrites it from the database, so a run would replace hand-maintained `Compiled_Contracts`, `CS_Data` and `CRM_Data` with an older copy of themselves.
- The daily `g-cme-daily-sheets-mirror` cron has been unscheduled on the hosted project. `pnpm sheets:sync` and `/api/sheets/sync` still exist and are still dangerous; removing them is a decision for whoever owns this spec.

### Design

- Retain the prototype's identity so the frozen deck's appendix screenshots still broadly match: primary `#1a5c3a`, Plus Jakarta Sans, the same eight sections, Indonesian copy.
- Add what the prototype lacks: responsive breakpoints (two responsive utilities across 1,788 lines today), keyboard and focus handling and ARIA (two ARIA attributes total), and skeleton/empty/error states, which only become reachable once data is remote.
- Extract the single-file prototype into modules per route with shared UI primitives.
- The login screen's "Role Akses" dropdown becomes a **demo-account picker that fills credentials**. It must never influence the role actually granted.
- Currency formatting must handle the three orders of magnitude in the data (Rp 4,200 per kg through Rp 120,000,000 flat) without collapsing small values to "Rp 0.0jt".

## Testing Decisions

A good test asserts **externally observable behaviour** — what a user sees, or what
the database returns for a given identity. No reaching into component internals, no
asserting on implementation details. There is no prior art: the repo has no tests and
no test framework, so both seams are new. They were chosen to be as few and as high
as possible.

### Seam 1 — End-to-end through the browser

Playwright against a local Supabase stack seeded from the source workbook, driving the
real interface as each persona.

Covers: sign-in and sign-out; a Commercial user seeing only their business line; a VP
seeing all three; editing a contract; write access denied to a VP; simulate, save,
submit; approve and reject including the counterparty's notification; the critical
queue and its bands; customer insight showing cases and RFM standing; loading, empty
and error states; the Ancillary user's five-row scope rendering sensibly.

Derived calculations — GPM, margin-versus-target, status banding, Rupiah formatting
across three orders of magnitude — are asserted through rendered output within this
seam rather than given a seam of their own.

### Seam 2 — Row-level security at the database

A small suite authenticating directly as each seeded user, asserting the exact row set
returned and the rejection of out-of-scope writes.

This is the one deliberate exception to the single-seam preference. From the browser,
a row hidden by an RLS policy and a row dropped by a mistaken query filter are
indistinguishable — and that distinction is the confidentiality guarantee the system
exists to provide.

Covers: both seeded roles read all 20 contracts; a **line-scoped Commercial user the
suite creates for itself** reads only their own line's 7 and cannot read, write,
author against or prompt a reminder on any other; a VP write to contracts is rejected;
scenario decisions permitted only to a VP; unauthenticated access returns nothing from
every table.

The scoped user is a fixture rather than a seeded login because no seeded account is
confined any more. The property is the reason this seam exists, so it is asserted
against a user the test brings with it rather than dropped along with the accounts that
used to demonstrate it.

### Not separately tested

The Sheets mirror and live SMTP delivery are verified by inspection — both depend on
third-party credentials that would have to be faked to the point where the test proves
nothing. Reminder *selection* is tested through seam 1 via the manual trigger.

## Out of Scope

- **Revenue, volume and any time-series analysis.** The source data has none. No revenue totals, no monthly trend, no true RFM derivation, no per-hub breakdown.
- **Creating or editing service cases.** `CS_Data` is imported read-only; no role owns case entry.
- **Branch or `cabang` scoping.** Does not exist in the data; `business_line` replaces it.
- **SharePoint, Power Automate, Power BI and DAX.** Replaced by Supabase, `pg_cron` and Recharts. The deck still names all four.
- **Two-way sync with Google Sheets.** Considered and rejected: it needs conflict resolution and a tiebreak rule for simultaneous edits, disproportionate here.
- **Single sign-on against Gapura's corporate directory.** A production concern.
- **Production hardening** — audit logging, backup and retention policy, data-residency review, penetration testing.
- **Contract document storage.** The system holds contract terms, not contract files.
- **Offline support and native mobile applications.** Responsive web only.

## Further Notes

**The submission deck is frozen and will not be edited.** Its appendix contains eight
screenshots of the prototype, which is why the visual identity is preserved rather
than redesigned. Several deviations are knowingly accepted; the deck describes an
architecture and a dataset the build does not use.

Specifically, the deck shows 33 contracts and 12 customers with per-hub revenue
breakdowns and four-name customer segments. The real data has 20 contracts, 20
customers, no hubs, no revenue, and three RFM levels. Screens will not match those
screenshots figure for figure.

**The margin narrative is weakly supported by the data.** Only 1 of 20 contracts sits
below its target (Samudera Cold Chain, 29.1% against a 30% target). A "contracts
breaching margin" panel is therefore nearly empty by construction. The simulator is
where margin pressure becomes visible, because a what-if can push any contract below
its target on demand — that is the better demo of the same claim.

**Scope confidentiality is demonstrable again, by station rather than by line.** The
demo seeds three accounts, and the GM Cabang one is confined to CGK: signing in as it
returns 9 of the 15 contract lines — 3 at CGK plus the 6 marked "All Station" — while
the 6 lines held only by other airports never reach the session. That is the
same machinery and the same guarantee the Problem Statement's fourth bullet claims,
shown on screen rather than only in a test.

What is still not shown on screen is that boundary drawn along a **business line**
specifically. The seeded Commercial account covers all three lines, so no login
demonstrates one Commercial user being denied another line's tarif and cost. The
policies still express it, a Commercial profile with a `business_line` set is still
confined by it, and `tests/rls/scope.test.ts` still asserts it against a user the test
creates.

**The confidentiality boundary is demonstrated in the application, not enforced at the
data source.** The Sheets mirror is an ordinary sheet without special permissions, so
anyone with its link can read every business line's tarif and cost. The Postgres
policies are real and demonstrable; the mirror alongside them means the guarantee is
not airtight end to end.

**Purpose.** A demonstration artifact for the Gapura Innovation Summit 2026, judged by
opening a live URL. Production deployment is a later phase. Choices were made to
survive that promotion, but nothing here has been through security review.

### Pre-demo checklist

- Supabase free projects pause after roughly a week of inactivity — confirm the project is awake. The `pg_cron` job should prevent this; verify.
- Gmail App Password valid, demo inbox open on screen for the live reminder.
- Reminder recipients overridden to a real inbox.
- Confirm seeded dates still produce a populated pipeline (see Date handling).
- Vercel's Hobby plan permits non-commercial use only, defining commercial usage as any deployment serving the financial gain of anyone involved in building it. A corporate innovation-summit entry is a grey area.
- `projects-melisa/commercial` is a **public** repository. The tarif and cost figures, the summit deck PDF and the Gapura framing are all world-readable.

---

### Changes from revision 1

| Area | Revision 1 | Revision 2 |
|---|---|---|
| RLS scope | `cabang` (5 branches) | `business_line` (3 lines) — no branch exists in the data |
| Revenue | `revenue_bulanan`, monthly per contract | Removed — no revenue or volume in the data |
| Segmentation | Computed RFM, 4 segments | Given `RFM_Status`, HIGH/MEDIUM/LOW, displayed as-is |
| Margin threshold | Global, configured in Settings | Per contract, from `Min_GPM_Target` (20%–35%) |
| Irregularities | Cut from scope | Restored read-only from `CS_Data`; still no owning role |
| Reports | Revenue trend, YTD totals, per-hub | Margin distribution, GPM vs target, expiry timeline, composition, case summary |
| Status bands | Unspecified | ≤14 Kritis, 15–60 Perlu Perhatian, >60 Aman, past Nonaktif — aligned to reminder milestones |
| Volume | ~33 contracts, 12 customers | 20 contracts, 20 customers, 1:1 |
| Sheets mirror | Shape unspecified | Reproduces the source workbook's four sheets and headers |
| Dates | Absolute | Seeded as offsets from import date so the pipeline does not age out |
