# Dispatcher unassigned parcels integration

The `/dispatch/unassigned` page is available to Dispatcher and Admin. It reuses
the existing dashboard shell, sidebar, top bar, breadcrumbs, account menu and
appearance settings. The portal delegates to the Dispatch feature. Controls and
surfaces compose shared shadcn/ui components. The official shadcn CLI adds
Calendar and Popover, with date-fns and react-day-picker recorded in the npm
lockfile. Their imports reuse the project's shared class-name utility and Button.

## Queue behavior

The page uses the existing authenticated `GET /api/v1/parcels` read through
`useCustomerParcels(query, true)`. Every request sets `status=Created` and uses
20 rows per page, preserving the server's newest-first ordering. Search matches
tracking number or recipient. Booking dates are optional UTC days: From is
inclusive; Through includes the selected day by sending the next midnight as
the API's exclusive `to` bound. Reversed ranges are rejected before querying.

Both date filters use the user-supplied shadcn Date Picker composition of Button,
Popover and Calendar, with formatted selected dates and a Pick a date placeholder.
The calendar supports keyboard selection, Escape/focus return and deselecting an
optional date. Clear filters resets both selections. Selected calendar days are
converted to UTC boundaries independently of the browser's timezone.

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

This implements the Created-only queue portion of FR-D01/TC-D01. FR-D01 remains
incomplete until zone or defined priority filtering is supported. The parcel
endpoint currently rejects both filter parameters, and its list response has no
zone fields. A zone filter needs an authorized zone source and coordinated
backend validation/query/response and client changes. Priority semantics remain
undefined.

FR-D02/TC-D02 assignment, FR-D03 workload and FR-D04 reassignment remain separate
milestones. Their commands/read contracts must be implemented before enabling
assignment controls or the workload destination. This page has no placeholder
assignment dialog. Existing operations detail and Admin-only receipt/proof rules
are preserved. Customer reads remain unchanged and owner-scoped by the backend.

Shared database migrations remain deferred. The workspace previously recorded
an audit-schema dependency affecting authenticated Delivery reads; source and
fixture tests do not establish live database readiness.

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
