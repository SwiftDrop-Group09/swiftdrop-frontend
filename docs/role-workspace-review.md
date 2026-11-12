# Role workspace review

Reviewed the SRS sections 3.1–3.5, authorization/ownership matrix, use-case
specifications and technical design against the current router and backend
endpoint implementations on 12 November 2026. Work remains frontend-only on
`feat/admin-workspace-shell`, including the earlier admin refinements.

## Implemented frontend changes

- Customer booking, dashboard, tracking, history and receipts, Courier manifest,
  history and detail, Merchant portal/webhooks and account profile compose the
  shared responsive workspace design. Domain-specific tracking status, receipt
  printing, signature drawing and Google controls retain their behavior.
- Private Customer routes require Customer before mounting their query content.
  Customer queries also check restoration/role and include user identity in their
  cache keys. Non-Customer dashboards show authorized workspace shortcuts without
  requesting Customer parcels. Failed Customer metric reads show unavailable
  values rather than successful zero totals.
- Courier status/proof actions remain Courier-only and assignment-bound. Admin
  or Dispatcher access does not grant Courier operational actions.
- Merchant onboarding remains available to authenticated applicants. API keys and
  webhooks retain approved-business ownership checks. Business queries wait for
  session restoration and private caches are scoped to the signed-in owner.
- Added `/dispatch/zones` using the existing Delivery `/api/v1/zones/summary`
  endpoint, available only to Dispatcher and Admin. It handles loading, empty,
  unavailable and refresh states and displays persisted per-zone status counts.
- Shared shell breadcrumbs identify each implemented workspace. AGENTS.md now
  records full-width responsive composition, spacing, flat surfaces, role guards,
  account navigation, data states and API-boundary requirements.
- The account dropdown includes an Appearance submenu with shadcn Light, Dark and
  Device options. Its account heading shows assigned roles instead of repeating
  the sidebar email.
  Browser preferences persist across reloads, Device follows system changes, and
  the saved theme is applied before paint on authenticated and public pages.

## Backend blockers retained explicitly

| Required workflow                                          | Current implementation evidence                                                                                    | Frontend disposition                                                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| FR-D01/D02/D04 unassigned parcels, assignment/reassignment | No exposed operations list or assignment/reassignment endpoint in the current Delivery presentation layer          | Existing navigation stays disabled; do not reuse owner Customer listing as a global operations feed       |
| FR-D03 courier workload                                    | No exposed courier workload/capacity endpoint                                                                      | Existing navigation stays disabled                                                                        |
| FR-M06 owned order dashboard                               | Current Merchant endpoints provide onboarding, approvals, keys and webhooks; no owner job/statistics read endpoint | Role landing exposes available tools, without invented order statistics; Business overview stays disabled |
| FR-M04/M07 order submission/read                           | No merchant order/job submission or owner-read route in the current backend presentation layer                     | Orders stays disabled; a mock order form would not satisfy the documented API-key/ownership contract      |

These are unresolved functional requirements, not completed pages. Per the user's
scope decision, this task does not implement missing backend features or modify
other repositories. Backend follow-up must provide authenticated, ownership-aware
contracts and tests before these destinations can be enabled.

## Validation

`npm run check` passes formatting, lint, type checking, all 267 tests in 19 files
and the production build. New role tests verify that non-Customer dashboards
make no Customer parcel requests, Customer-only routes reject an Admin-only
account before private reads, and all five roles follow the Dispatcher/Admin
zone-summary policy. Existing registration, account, booking, courier and merchant
workflow tests remain passing.

Production-browser checks use isolated API fixtures for all five roles at 390,
768 and 1920 pixels. Implemented role pages and profile screens have one page
heading, no document overflow or page errors, and no Customer parcel reads by
other roles. These checks do not claim live backend integration for the blocked
APIs above. No database, secrets, backend or other repository changes were made.
