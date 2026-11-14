# Dispatcher initial assignment

The unassigned queue implements the initial assignment UI for FR-D02/TC-D02.
Dispatcher and Admin can open Assign courier for a Created row. It uses the
existing shadcn Dialog, Calendar/Popover date picker, table and buttons. Courier
selection, service date and parcel are explicitly confirmed before any write.

## Backend dependency and behavior

Deploy the backend assignment feature and its approved constraint migration
before using this UI. The contract is documented in
swiftdrop-backend/docs/dispatcher-assignment.md. Shared database application remains
deferred; the UI is implemented and tested without claiming shared readiness.

GET /api/v1/deliveries/{parcelId}/assignment-options returns server business
today/timezone, selected date, exact parcel version and eligible couriers with
ID, current duty flag, date-specific active count and daily capacity. It is a new
Dispatcher read, requiring central proposed contract review. Candidates use
independent 20-row pages. The server defaults to business today. Calendar dates
remain YYYY-MM-DD calendar strings regardless of the browser timezone. Past days
are disabled; date/page/refresh changes clear the selected courier.

An active operational profile and delivery-zone membership are always required.
Today requires on duty; future service dates may use off-duty couriers. Capacity
counts Active assignments for that date only. Existing workload monitoring still
shows outstanding work across all dates, alongside informational daily capacity.
Service dates do not block early pickup through existing Courier operations.
There are no fabricated courier names, profiles or future roster assumptions.

POST /api/v1/deliveries/assign sends parcelId, courierId, expectedVersion,
reassign=false and the explicit selected serviceDate with Idempotency-Key. Exact
JSON parsing/serialization preserves the Int64 version supplied by eligibility;
the queue's ordinary numeric version is not used to authorize the write. Response
ID/status/version are validated before showing confirmed assignment.

## Reliability and data isolation

The route checks Dispatcher/Admin before private components mount. Eligibility
keys include the account, parcel, date and page and consume AbortSignal. Changing
accounts unmounts the dialog, clears private cache and ignores late results.

Confirmation is guarded against duplicate clicks. There is no automatic mutation
retry. Network/server/in-progress or invalid-success outcomes retain the exact
request and key. Explicit retry honors Retry-After; editing or dismissing the
pending dialog cannot replace the retained attempt. Session/navigation unmounts
cancel the local request; cancellation does not imply a server rollback. Reload
the parcel to determine its current state before starting a later attempt.

Definite validation/eligibility/stale-version conflicts clear the selection and
require explicit reload and renewed confirmation. Denied access blocks further
writes. Initial loading, empty eligibility, failed reads and safe read retry are
distinct. A failed response is never converted to successful zero availability.

Confirmed success invalidates the operational queue, parcel detail, all-date
workload, operations assignment projection, eligibility and zone summary for the
current account. Queue paging already corrects when assignments remove its last
row. Focus returns to the original action, or queue Refresh when that row leaves.
Reassignment is available from eligible Assigned parcel details.

## Verification

Transport tests cover exact Int64 values, byte-identical retries, response
identity/date/count validation and uncertain versus definite failure. UI tests
cover Dispatcher/Admin, explicit confirmation, future-date selection, conflicts,
uncertain retries, data states, StrictMode and account changes during a write.
The production-browser fixture at the EAD root checks 1280/390/320px, keyboard and
focus, Light/Dark/Device appearance, calendar dates in a different browser
timezone, courier paging, explicit retry, conflict/error/empty states and denied
roles. Fixtures intercept all API traffic and establish UI behavior only.

Exact tested bases, worktree fingerprints, full-check results and shared/startup
acceptance limits are recorded in the EAD root DISPATCHER-PLAN.md.

## Pre-pickup reassignment (P4)

Dispatcher/Admin can open Reassign courier from an Assigned parcel with an Active,
unpicked-up assignment. Workload drill-down already links to this detail route.
The reused detail view has a generic action slot; Customer behavior and existing
Admin-only proof/receipt permissions remain unchanged. The dialog remains mounted
through parcel refreshes until dismissed, even if the original action disappears.
Account changes remount the owning Dispatcher feature and discard late results.

GET assignment-options uses reassign=true (strict lowercase boolean). Its response
adds reassign and currentAssignment={courierId,serviceDate}; ordinary assignment
returns false/null. Existing current courier is excluded. The default selected
date keeps the scheduled date if today/future, or business today if overdue.
The original date remains visible separately. Explicit dates use the existing
Calendar/Popover; submitted dates are always explicit calendar strings.

POST uses reassign=true and reason, trimmed and required at 1–500 characters.
It confirms original/replacement courier, selected date and reason. Selecting the
current courier is rejected by the server with 400 validation/errors.courierId.
The server remains authoritative for status, version, eligibility and daily slots.

Every draft options refresh clears courier selection and confirmation, including
invalidation-driven refetch. Selection binds to one response object with structural
sharing disabled. Submission also checks live query-cache identity/fetch status,
preventing an event before a React rerender from pairing an old courier choice
with a newer parcel version. The reason draft survives refresh; a fresh selection
and confirmation are required. Once submitted, the original immutable request/key
is separate from draft state and cannot be replaced by refreshed options.

No automatic mutation retry is introduced. Explicit uncertain retry preserves the
exact normalized reason/body/key and observes Retry-After. Cancelling a local
request does not guarantee server rollback. If navigation/session change loses
local attempt context, reload authoritative state before starting another write.
All Dispatcher projections are invalidated after success. Real shared startup,
existing migration rollout and operational Courier-data acceptance remain pending.
