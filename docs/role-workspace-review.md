# Role and page access review

Reviewed on 15 November 2026 against the SRS, security/authorization.md, frontend routes and service application handlers. Implementation is grouped into backend permission/filter commits and frontend access, customer-management and review commits.

## Approved decisions

- Signed-out visitors to protected URLs see /401 with a Sign in action. Sign-in preserves a validated internal destination.
- Signed-in users without a required role are redirected to /403 before private page components mount.
- Admin and Dispatcher can use operational tracking and history. Customer booking remains Customer-only; Courier actions remain assigned-Courier-only.
- Dispatcher cannot download receipts or proof. Those reads require the owning Customer or an Admin, including JSON, PDF and image formats. Accounts have one role; Dispatcher access never includes receipts or proof.
- Customer accounts are the default user-management view. Other roles and All users have separate tabs. Each user appears under their single assigned role.

## Implemented role-to-page mapping

| Pages                                                               | Required role                         | Additional server boundary                                                            |
| ------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| Dashboard, profile                                                  | Any authenticated account             | Current subject; non-Customer dashboards do not request Customer parcels              |
| Business registration (/merchant)                                   | Customer applicants / Merchant owners | Own application; keys require approved business ownership                             |
| Merchant webhooks                                                   | Merchant                              | Approved business owner; scoped business membership                                   |
| Merchant orders list and order detail (read-only)                   | Merchant                              | Approved business owner; foreign or missing orders return 404                         |
| Merchant business overview (/merchant/overview)                     | Merchant                              | Approved owner JWT only; figures from the business's own orders                       |
| Customer booking                                                    | Customer                              | Authenticated owner; quote/confirmation validation                                    |
| Customer tracking, history, receipts and parcel details             | Customer                              | Own parcel; foreign or missing resources retain 404 semantics                         |
| Courier manifest, history and parcel details                        | Courier                               | Current assignment; state/version/proof rules still apply                             |
| Dispatch zone summary                                               | Dispatcher or Admin                   | Operations read policy                                                                |
| Dispatch parcel list, history and live detail                       | Dispatcher or Admin                   | Existing GET /api/v1/parcels and parcel detail/events APIs                            |
| Dispatch unassigned queue (/dispatch/unassigned)                    | Dispatcher or Admin                   | GET /api/v1/parcels with status=Created; delivery-zone/search/date filters and paging |
| Dispatch parcel receipt/proof controls                              | Admin                                 | Admin read scope; Dispatcher pages never request proof or show download controls      |
| User management, audit, merchant approvals, zones, pricing, reports | Admin                                 | Live Admin check for Identity administration; last-active-Admin protection            |
| Public tracking, authentication, 401, 403 and missing-page screens  | Public                                | Public tracking returns a limited summary                                             |

Route access is centralized in app/features/identity/route-access.tsx. Feature guards retain the same restrictions for standalone composition. Query keys include the user identity; operational parcel queries have a separate scope. Business and webhook queries wait for the appropriate role/approval. Each account has one enum role; navigation and query guards follow that role without ownership or assignment bypasses.

The 401/403 screens are client routes in the static SPA. Protected APIs return actual HTTP 401/403 statuses; a static hosting document response can remain HTTP 200.

## User management

Customers open first, followed by Couriers, Merchants, Dispatchers, Admins and All users. The Identity list endpoint supports role, search and status filters before pagination. The filtered count and rows use one repeatable-read database snapshot; users are counted once per result. Search matches literal name/email text, including SQL wildcard characters, through parameters.

The API is GET /api/v1/users?page=1&pageSize=20&role=Customer&status=active&search=name. Role is one of the five exact role names; status is active or inactive; search is bounded to 200 characters. Omit filters for all results. Duplicate, unknown and invalid parameters return 400. Audit pagination does not accept these filters.

Shadcn tabs, row dropdowns and account/role/status dialogs replace the persistent inline editor forms. A separate confirmation dialog protects mutations. The UI retains last-Admin error state, self-account session refresh, password clearing, no automatic mutation retry, loading/error/empty states, and focus restoration. The selected tab supplies the new account role; subsequent role replacements require confirmation.

## Workflows still awaiting implementation

Initial assignment, pre-pickup reassignment, Courier workload and active-assignment monitoring are implemented for Dispatcher and Admin. See [assignment integration](dispatcher-assignment.md) and [workload integration](dispatcher-workload.md).

Backend PRs #23 and #24 added Merchant API-key authentication, scoped order intake and owner reads after the initial review. The Merchant Orders workspace is now enabled at /merchant/orders: a read-only list (state filter, paging, tracking links) and order detail (progress, failure reason, parcel status with refresh age). Orders are still submitted only by the merchant's systems through the API; there is no web order form.

Business overview (FR-M06) is enabled at /merchant/overview and reads GET /api/v1/merchants/me/dashboard. It shows orders received in the chosen UTC period, deliveries finished in it with success and failure rates (Cancelled excluded), parcels by status, recent orders and when parcel statuses were last refreshed; data that was already more than 15 minutes old when loaded is labelled. All figures come from the server; the page computes no totals of its own.

## Validation

Current Courier and Merchant integration results are recorded in
[courier workspace experience](courier-workspace-experience.md). Broader browser
scenarios below were recorded during the earlier role review.

- Frontend npm run check passes formatting, lint, type checking, 705 tests in 46 files and the production build.
- Backend Release build and all 2,084 tests pass on this feature branch: Identity 409, Delivery 1,217, Merchant 383, Gateway 70 and Notification 5. Persistence tests use disposable databases.
- The 13-project foundation dependency audit passes locally. Backend CI runs service startup, gateway forwarding and fail-closed authentication probes on a clean runner; the active local development stack occupies the smoke-test ports.
- Production-browser checks use isolated API fixtures. They verify Customer-first tabs and server pagination, role-filter page reset, last-Admin rejection, nested dialog Escape behavior and row-focus restoration, 390px page/dialog bounds, Dispatcher tracking without proof/receipt requests, Admin proof/receipt access, wrong-role direct URLs before private reads, and 401 sign-in returning to the protected destination.
- Desktop and mobile screenshots were inspected. Browser fixture checks do not claim a live Google-consent or production-database workflow.

## Single-role account contract

Each account has exactly one role from Customer, Courier, Merchant, Dispatcher
or Admin. The v1 `roles` field remains a singleton enum array for compatibility;
empty/multiple/unknown roles are rejected before establishing a session. The
role editor replaces one value through a dropdown; navigation must never union
permissions across role assignments. Previously described combined-role examples
are superseded by this contract. Multiple actor roles in historical audit records
remain immutable snapshots, not current account permissions.
