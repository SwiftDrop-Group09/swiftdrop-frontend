# Dispatcher zone summary

The Dispatcher/Admin `/dispatch/zones` page implements FR-D05 through
`GET /api/v1/zones/summary`. Route guards run before private reads. The existing
three-column table remains: Zone, Total parcels and Status breakdown. Totals
come from the API, and all returned status keys remain visible. Configured
zero-count zones remain in the table; omitted status keys mean zero.

## Booking period

The default is **All booking dates**. Reporting period uses the shared shadcn
Popover and Calendar composition, with Today/7-day/30-day presets. From and
Through are inclusive UTC calendar days. Custom drafts require Apply, both
dates, Through on or after From, and at most 366 inclusive days. Cancel, Escape
and outside dismissal discard drafts. Clear dates restores All booking dates.

Dispatcher date controls omit the UTC badge and label suffixes. This changes
display text only; booking ranges and presets continue to use UTC boundaries.

Requests send From midnight as inclusive `from` and the midnight after Through
as exclusive `to`, independently of the browser timezone. The period filters
booking creation time; the counts show current parcel statuses grouped by
delivery zone, rather than status changes occurring during that period.

Existing Admin report/dashboard imports remain compatible through re-exports;
their input controls, required periods and defaults retain their prior behavior.

## Private queries and compatibility

Undated reads retain `['delivery-zone-summary', userId]`. Dated reads append
normalized UTC `from` and `to`. Queue, workload, assignment and Admin snapshot
consumers continue using the undated catalog. Existing user-prefix invalidation
also invalidates dated summaries. New-period loading/failure does not show rows
from another period. Refresh explicitly refetches the current key.

Same-period refresh keeps loaded rows visible. A failed refresh identifies them
as previously loaded results for this period and offers a safe read retry.
Initial failures never display invented zero counts. An empty zone catalog has
its own notice, distinct from configured zones with zero parcels.

Reads consume the abort signal; private results stay in memory and session
changes clear caches. Account changes also reset the page's local period.
Customer, Courier, Merchant and signed-out users cannot mount summary reads.

## Verification and handoff

The summary page tests use the real shared QueryClient and isolated identity
transport. They cover the original table, authoritative API totals, UTC Calendar
Apply/Clear/Cancel/validation, separate catalog caches, prefix invalidation,
cancellation and account/role isolation. Shared period tests cover keyboard
selection/focus and compatibility with existing report inputs. Run
`npm run check` and browser checks for changed controls before review.
Refresh tests also verify retained rows, an honest failure notice and recovery.

Backend TC-D05 tests cover persisted counts, exact date boundaries and HTTP
authorization. See `swiftdrop-backend/docs/dispatcher-zone-summary.md`. Release
the backend's strict date validation before relying on it from the period UI.
No schema, response-shape, migration or zone-administration changes are needed.

## Shared acceptance — 15 November 2026

Canonical Docker build/startup passed at backend `706cfd1` and frontend
`3930c1c`: all seven containers used the expected images, six defined health
checks passed, web/gateway/bootstrap returned 200 and anonymous summary reads
returned 401. Before/after Identity, Delivery and Merchant migration histories
matched; no test accounts, roles or parcels were created for acceptance.

Following manual sign-in, user-saved API response bodies matched independent
read-only SQL for every zone ID/name, total and status count: 25 zones / 268
parcels for all booking dates, and 25 zones / 33 parcels for 14 November UTC
(`from` 14 November inclusive, `to` 15 November exclusive). The user confirmed
that Clear dates and Refresh restored the displayed all-date sample totals
(Ampara 13, Anuradhapura 12) without errors. Browser actions are user-reported
manual evidence; the response/SQL comparisons were checked independently.

These observations apply to those tested revisions. Later integration changes
require relevant regression and Docker checks; this does not establish the
entire booking/assignment/Courier workflow or authorize provisioning/deployment.
