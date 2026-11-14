# Dispatcher courier workload

`/dispatch/workload` implements FR-D03 monitoring for Dispatcher, preserving
existing Admin operations access. It uses the shared workspace shell, breadcrumbs,
account/theme controls, shadcn table/buttons/badges and the existing shadcn Dialog.

## Behavior and API dependency

The authenticated `GET /api/v1/couriers/workload` returns all operational profiles,
including inactive, off-duty and zero-workload couriers. The page shows actual
courier IDs, active/duty status, zone names (IDs as fallback), outstanding counts
and configured capacity. Counts span all Active assignments, including overdue
and future service dates. Capacity is informational; no availability or parcel
eligibility is claimed. Courier names need a separately authorized source.

View active parcels opens a paginated dialog using the new operations-authorized
`GET /api/v1/couriers/{courierId}/assignments`. It shows tracking number, current
parcel status, service date and assignment time, and links to existing Dispatcher
parcel details. Calendar service dates remain unchanged by browser timezone;
assignment timestamps use the browser's date/time presentation. Each list uses
independent 20-row pages. Closing/reopening the dialog resets its page. Shrinking
results correct to the last valid page.

The Delivery backend handoff is `swiftdrop-backend/docs/dispatcher-workload.md`.
Roll out those reads before this UI. The response's `active` flag and per-courier
projection were selected for this milestone and require the central proposed
REST/route catalog's owning contract review. No response/endpoint is fabricated
by the frontend. Assignment and reassignment writes remain later milestones.

## Data and access states

Role guards run before private query components mount. Query keys include user
identity, pagination and the selected courier; requests consume AbortSignal.
Account changes remount page/selection and the existing session clears private
cache. API responses are validated, including the assignment response courier ID.

Initial loading, an empty fleet, zero assignments, read failure and a missing
courier have distinct feedback. Refresh failures retain loaded data with an
explicit stale-data notice. Retrying only replays reads. Dialog Refresh updates
the selected assignments, workload and zone catalog. Its current response total
is authoritative; separate reads may observe different committed revisions.
Zone-catalog failure keeps workload usable with IDs and a safe retry.

The workload feature was developed independently from the unassigned queue. After
the queue merged into dev, integration preserves both navigation links,
breadcrumbs, route permissions and sign-in return paths. Navigation tests cover
both implemented destinations for Dispatcher and Admin. No new package, custom
CSS or UI primitive is introduced by workload monitoring.

Shared migrations remain deferred. Docker startup and real shared-environment
FR-D03/TC-D03 acceptance require an authorized ready environment and verified
Courier profiles. Browser transport fixtures establish UI behavior only.
