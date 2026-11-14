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

Backend TC-D05 tests cover persisted counts, exact date boundaries and HTTP
authorization. See `swiftdrop-backend/docs/dispatcher-zone-summary.md`. Release
the backend's strict date validation before relying on it from the period UI.
No schema, response-shape, migration or zone-administration changes are needed.

Shared acceptance remains pending: compare real authorized API/page output
against a known persisted zone/status/date dataset and record Docker startup
acceptance for the reviewed source. Isolated fixtures do not establish shared
identity, audit/schema readiness or live data correctness. Shared migrations,
provisioning, deployment and existing-service restarts remain deferred.
