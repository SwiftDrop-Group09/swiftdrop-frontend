# Dispatcher integration

P1–P5 queue, workload, initial assignment, pre-pickup reassignment and zone summary
are implemented. The sections recording 14 November checks below are historical;
current whole-workflow verification and remaining live acceptance appear in the
P6 section at the end. Use the linked owning feature contracts for current behavior.

The `/dispatch/unassigned` page is available to Dispatcher and Admin. It reuses
the existing dashboard shell, sidebar, top bar, breadcrumbs, account menu and
appearance settings. The portal delegates to the Dispatch feature. Controls and
surfaces compose shared shadcn/ui components. The official shadcn CLI adds
Calendar and Popover, with date-fns and react-day-picker recorded in the npm
lockfile. Their imports reuse the project's shared class-name utility and Button.
Delivery-zone selection uses the official shadcn Select added through the CLI.

## Queue behavior

The page uses the existing authenticated `GET /api/v1/parcels` read through
`useCustomerParcels(query, true)`. Every request sets `status=Created` and uses
20 rows per page, preserving the server's newest-first ordering. Search matches
tracking number or recipient. Booking dates are optional UTC days: From is
inclusive; Through includes the selected day by sending the next midnight as
the API's exclusive `to` bound. Reversed ranges are rejected before querying.

Delivery zone is a draft filter applied with search and dates. All delivery zones
omits `zoneId`; selecting a named zone sends its UUID and resets to page 1 on
Apply filters. Clear filters restores all zones, clears dates/search and resets
pagination. The existing user-scoped zone-summary query supplies options,
including inactive zones and configured zones with zero parcels. The selector
is disabled while initial options load or after an initial failure, while the
other filters remain available. Empty catalogs, load failures and refresh
failures have distinct feedback. Refresh updates both queries. Previously loaded
options and the selection are retained after a catalog refresh failure.

Both date filters use the user-supplied shadcn Date Picker composition of Button,
Popover and Calendar, with formatted selected dates and a Pick a date placeholder.
The calendar supports keyboard selection, Escape/focus return and deselecting an
optional date. Clear filters resets both selections. Selected calendar days are
converted to UTC boundaries independently of the browser's timezone.
The visible date labels are Booked from and Booked through, without timezone
suffixes; this display choice does not change those query boundaries.

Filters apply on submission, reset pagination and can be cleared. Draft edits
do not change the active query. Filters and pages are local to the mounted page;
leaving and reopening the queue resets them. The table shows tracking number,
pickup/delivery cities, recipient, package size/weight, booking timestamp and a
link to the existing authorized parcel detail. Matching totals come from the
API, never the number of rows on the current page.

Loading, an empty queue, no filter matches and read failures have distinct states.
Refresh retains loaded rows; a failed refresh labels them as previously loaded
and offers a safe read retry. A shrinking result set returns to the last valid
page. Route and feature guards run before private reads; query keys retain the
authenticated user and operations scope. Changing accounts remounts the filter
state, and existing session handling clears private cached data.

## Requirements and remaining integration

The Created-only queue now supports the zone-filtering capability in FR-D01.
It requires the corresponding Delivery `zoneId` read extension, documented in
`swiftdrop-backend/docs/dispatcher-parcel-reads.md`. Delivery should be rolled out
before this UI. Priority semantics remain undefined. Full FR-D01/TC-D01
acceptance still requires the pending shared-environment and startup checks.

FR-D03 workload monitoring is now integrated at `/dispatch/workload`; see
[workload integration](dispatcher-workload.md) for the fleet and active-assignment
read contracts. Initial FR-D02/TC-D02 assignment is now implemented through the
confirmed dialog; see [assignment integration](dispatcher-assignment.md).
FR-D04 pre-pickup reassignment is implemented from authorized Assigned parcel
details; its contract and retained retry behavior are in the assignment integration
handoff. Existing operations detail and Admin-only receipt/proof rules are preserved.
Customer reads remain unchanged and owner-scoped by the backend.

Earlier queue verification deferred shared database migrations. The workspace previously recorded
an audit-schema dependency affecting authenticated Delivery reads; source and
fixture tests do not establish live database readiness. Subsequent database-data
verification is recorded separately in the backend's `docs/development-data.md`;
it does not replace end-to-end startup acceptance.

## Verification — initial queue, 14 November 2026

Tested the uncommitted queue patch based on frontend commit
`06557ee8947e9675703861f369fa1bd7918f9a5d` on Linux, Node 24.16.0 and npm 11.13.0.

- `npm run check` passed formatting, lint, TypeScript, all 450 tests in 23 files
  and the production SPA build. The new queue suite contains 16 behavior cases;
  central route/navigation tests include the new destination.
- Chrome 157.0.8103.38 checks against the production build passed at 1280px,
  390px and 320px with isolated browser API fixtures. These covered contained
  table scrolling, labels/focus, keyboard search, submitted dates, invalid ranges,
  pagination, detail URLs, refresh failure/retry, the mobile sidebar and
  Light/Dark/Device appearance, including saved preference and device changes.
  Screenshots were visually inspected. Admin access, Customer/Courier/Merchant
  denial before private reads and signed-out sign-in return also passed.
- `sh swiftdrop-infra/development/run.sh build web` built the frontend image.
  Compose startup was not run because the existing host stack occupies the
  required ports 5000 and 5173. A coordinated switch and the documented
  Docker startup/Gateway/web checks remain required before merge.

Browser fixtures establish UI behavior, not live API authorization, database
readiness or full TC-D01 acceptance. No shared migrations, commits or pushes were
performed. Backend, mobile and infra source were unchanged.

## Verification — shadcn date pickers, 14 November 2026

The user requested the official Calendar and Popover through the shadcn CLI and
provided the Date Picker composition. The generated components reuse the existing
Button and class-name utility. The installed date dependencies are date-fns 4.4.0
and react-day-picker 10.0.2, recorded in package-lock.json.

On the uncommitted frontend patch based on the same `06557ee` commit, using Node
24.16.0 and npm 11.13.0, `npm run check` passed all gates, including 451 tests in
23 files and the production build. The queue suite now has 17 cases, exercising
actual calendar day selection, keyboard navigation, Escape/focus restoration,
optional-date deselection, cleared filters and inclusive UTC day boundaries.

Production Chrome checks passed at 1280px, 390px and 320px with isolated API
fixtures. Calendar popovers fit the viewport. Date selection and API boundaries
were checked with America/Los_Angeles and Asia/Colombo browser timezones. Shared
navigation, appearance, authorization and sign-in return checks also passed.
`sh swiftdrop-infra/development/run.sh build web` built the updated image. Compose
startup and live database acceptance retain the existing pending status above.

## Verification — zone filtering, 14 November 2026

The patch based on frontend `07d788fe92d6cd391db62bfa7478898169fd7225` passes
`npm run check` with Node 24.16.0 and npm 11.13.0, including all 472 tests in
26 files and the production build. The queue suite covers draft zone selection,
combined filters, empty matches, page reset, catalog loading/failure/retry,
retained options after refresh failure and account changes. The shared DOM test
setup supplies jsdom's missing pointer-capture/scroll methods for Radix Select.

Production Chrome 157.0.8103.38 checks with isolated API fixtures passed at
1280px, 390px and 320px. They cover Select keyboard opening/typeahead/selection,
focus return, long zone names within popup bounds, draft and combined filters,
zero matches, catalog refresh recovery, Calendar/Popover selection, UTC date
boundaries, mobile navigation and Light/Dark/Device appearance. Screenshots were
visually inspected. Role denial before both private reads, Admin access and
signed-out sign-in return also passed. These fixtures do not establish live
database readiness.

Backend Release checks pass all 1,874 tests with isolated PostgreSQL 18.6,
including real HTTP and persistence coverage for the zone predicate, pagination,
UUID validation and Customer ownership. The foundation dependency audit passed;
its host probes stopped before launch because the existing host stack occupies
the fixed test listeners. The infra runner built both `web` and `delivery-service`
images successfully. Shared migrations remain deferred. The synced runner applies
migrations on `up`, so Docker startup remains pending; the existing host stack also
owns ports 5000 and 5173. No shared migrations or deployment were performed.

## Whole Dispatcher integration (P6) — 15 November 2026

Test commit `bac38e8`, based on current shared frontend `45c0dc6`, adds a combined
queue/detail/workload/summary journey for Dispatcher and Admin. It uses the real
application QueryClient and default freshness policies with isolated authenticated
HTTP fixtures. It primes both Courier assignment lists, parcel detail and a dated
summary before assignment, then verifies actual reads and visible rows after
initial assignment and replacement. Dated/undated summaries and both Courier
caches refresh; another account's queries and the Customer query scope remain
untouched. Each new action uses its own key and current preview version/date.
Existing suites retain uncertain-write exact retry, role/account changes,
cancellation, stale-preview and failed-refresh coverage.

The standard `npm run check` passes formatting, lint, TypeScript, **735 tests in
49 files** and production SPA generation on Node 24.16.0/npm 11.13.0. The initial
baseline hit the historically recorded Identity lazy sign-in heading timeout;
that focused test and the subsequent full standard check passed without changing
Identity source, test assertions or global test settings. The paired backend
workflow tests exercise actual HTTP handlers and disposable PostgreSQL through
booking, proof completion and reassignment/failure; see its assignment handoff.

Production Chrome fixture checks pass **49 groups**: queue/date controls 4,
initial assignment 9, reassignment 10, workload 9, summary 13 and the combined
cached workflow 4. Responsive groups cover 1280/768/390/320px and Light/Dark/Device;
additional groups cover denied roles, empty/error/retry states and exact write
recovery. Keyboard/focus, contained table scrolling, Calendar bounds and UTC
periods pass; representative desktop/tablet/mobile screenshots were inspected.
The combined journey uses actual SPA navigation and changes both Couriers' cached
workload/active-parcel views after replacement. All browser API traffic is isolated
test data, never shared-account authentication or live workflow evidence.
The canonical infra runner built all six current application images successfully;
authorized startup and restoration evidence follows below.

P6 adds no UI primitive, runtime dependency, public API or schema change. Existing
shadcn controls, Calendar/Popover, shared shell, neutral primary action tokens,
UTC booking periods and business-date assignment policy remain authoritative.
Central contract gaps and draft capacity/event-reason discrepancies are owner
handoffs documented in the backend assignment handoff, not new frontend behavior.

Real user-assisted acceptance must use agreed test parcels and existing accounts:
booking → Created queue → assignment → Courier manifest/stages/proof → workload
release/Delivered summary; and assignment → pre-pickup replacement → new-Courier
failure → workload release/Failed summary. Compare rendered/API counts against
independent read-only persistence. The user or workflow owner performs shared-data
actions; no fixture principal is used against a shared API. Other-role client,
proof-storage and broker gaps remain owner dependencies.

Read-only readiness found no pending Identity/Delivery/Merchant migrations and nine
active/on-duty Courier profiles with zones. After task-specific user authorization,
canonical `run.sh up --mode docker --build` passed on frontend `6b33c39`, backend
`9e5a2ba` and infra `785f0dc`. All seven expected containers used the expected
images, and the six configured container health checks were healthy. Dispatcher
deep pages, Identity bootstrap and internal trusted JWKS returned 200; anonymous
private reads and assignment/Courier-status/proof writes returned 401.

The original non-watch host mode was restored through the canonical runner. All
six service health probes, the workload deep page and CSRF bootstrap returned 200;
anonymous summary returned 401. Before/during/after migration histories matched:
Identity 5/5, Delivery 11/11, Merchant 7/7, with no pending versions. No shared
test-parcel mutation, account provisioning, schema reset or downgrade was performed.
These results supersede historical startup/schema deferrals above.

The user explicitly chose to leave the two-parcel signed-in live workflow pending.
P6 remains incomplete until that user-assisted acceptance is recorded. Startup,
anonymous authorization refusal and fixtures do not prove signed-in workflow
behavior, shared proof storage, Flutter or broker delivery. Nothing was pushed.

## Integrated dev verification and local scheduling limit

Normal merge `797242e` integrates reviewed frontend dev `17aaa30` while preserving
all three P6 commits. Its tree is the previously reviewed combined tree
`5522380c4cb3c54c0db1f823065c4078692b5e57`. Incoming changes belong to Merchant/public
tracking; no Dispatcher, Identity, shared authorization, package or test-setup
source changed. The P6 change relative to dev remains its workflow tests and this
handoff. No other-role fixes were authored during integration.

The unrestricted local standard check reproduces one existing Identity heading
timeout, with 734 tests passing. The complete Identity file passes 67/67 alone.
Current dev's [standard CI run](https://github.com/SwiftDrop-Group09/swiftdrop-frontend/actions/runs/43685537254)
passes all 733 upstream tests, including those 67 Identity cases, and build.
CI on upstream dev does not establish a pass for the unpublished P6 merge.

The unchanged local `npm run check`, launched as `taskset -c 0,1 npm run check`,
passes all formatting/lint/type gates, **735 tests / 49 files** and production
build on both the pre-merge feature and exact integrated tree. This limits CPU
affinity only for the newly created check process; the workstation retains its
16-CPU affinity. No source, assertion, timeout, Vitest worker configuration or
host setting was changed. Results support a scheduling-sensitive local test;
the underlying cause and unrestricted-run stability remain an Identity-owner
handoff. Do not describe the unrestricted local check as passing or an Identity
production defect as fixed.

The integrated production browser journey passes at 1280/768/390/320px with all
three themes, actual SPA navigation and assignment/replacement cache refresh.
Representative desktop/mobile screenshots were inspected; API traffic remains
intercepted fixture data. The isolated preview was stopped afterward.

Runtime acceptance was renewed at backend `265e2dc`, frontend `797242e`, infra
`785f0dc`: full foundation checks and canonical Docker build/start passed, with
seven expected service images, six healthy container checks and 14 HTTP/JWKS
probes. Current preflight found the previous stack stopped. Canonical non-watch
host mode is now running with all nine restoration probes passing. Read-only
Identity/Delivery/Merchant migration histories match before/during/after at
5/11/7 applied, with no pending versions. No shared test-parcel write, account
provisioning, reset or downgrade was performed. The user-deferred signed-in
two-parcel workflow remains pending; no push or PR has been performed.
