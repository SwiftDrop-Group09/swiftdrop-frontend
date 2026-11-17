# Dispatcher zone summary

The Dispatcher/Admin `/dispatch/zones` page implements FR-D05 through
`GET /api/v1/zones/summary`. Route guards run before private reads. The table
presents a grouped status matrix with Zone first and authoritative API Total
parcels last. Configured zero-count zones remain visible, and omitted status
keys mean zero.

## Status matrix

The two-row header groups Booked/Assigned/Collected under Before transit,
In transit/Out for delivery under On the road, Delivered under Done, and
Delivery unsuccessful/Cancelled under Problems. Additional returned status keys
appear alphabetically under Other statuses, with a consistent column for every
zone. The underlying API status keys and enum labels are reused.

Zones are ordered descending by Created + Failed + Cancelled, then by name and
zone ID. This ordering uses current counts in the selected booking-period
response. The API total remains authoritative even when it differs from the
sum of recognized status columns.

Each status column uses its own maximum across the full response. Positive
counts receive four intensity levels at 25/50/75/100% of that maximum.
The matrix composes shared shadcn Table and Badge surfaces and reuses the existing
StatusBadge palette: amber before transit, sky on the road, emerald for delivered,
and the theme's destructive red for problems. Text and borders retain the system
status colors in Light/Dark/Device; background shades vary within each family to
show relative volume. Additional unknown statuses use neutral shades. Muted dashes indicate zero,
and screen readers receive the numeric value. Counts below one million stay
fully formatted. Larger counts use compact notation with at most one decimal,
with exact values available through focus/hover Tooltip and accessible labels.

The official shadcn ScrollArea is installed through the registry CLI and reuses
the shared class-name utility and existing Radix dependency. A single named,
keyboard-focusable viewport scrolls horizontally on narrow screens. The table
uses its natural height, with no fixed height cap or nested vertical scrollbar:
larger displays can show more zones, and longer lists use normal page scrolling.
Zone names remain visible during horizontal scrolling. Zone names and column
headings wrap. The shared Table's optional containerClassName and ScrollArea's
optional viewportProps/scrollbarOrientation support this composition while
retaining their default behavior for existing consumers.

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
transport. They cover the grouped matrix, authoritative API totals, UTC Calendar
Apply/Clear/Cancel/validation, separate catalog caches, prefix invalidation,
cancellation and account/role isolation. Shared period tests cover keyboard
selection/focus and compatibility with existing report inputs. Run
`npm run check` and browser checks for changed controls before review.
Refresh tests also verify retained rows, an honest failure notice and recovery.
Matrix tests cover attention ordering, stable ties, unknown-status columns,
independent maxima, intensity boundaries, accessible zero values, large-count
tooltips and 100 configured zones. Browser checks establish page/horizontal scrolling,
sticky zone names, uncapped height on tall displays, theme contrast and small-screen layout. The jsdom
ResizeObserver stub is renewed before each test for Radix measurements.

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
