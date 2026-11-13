# Role and page access review

Reviewed on 13 November 2026 against the SRS, security/authorization.md, frontend routes and service application handlers. Implementation is grouped into backend permission/filter commits and frontend access, customer-management and review commits.

## Approved decisions

- Signed-out visitors to protected URLs see /401 with a Sign in action. Sign-in preserves a validated internal destination.
- Signed-in users without a required role are redirected to /403 before private page components mount.
- Admin and Dispatcher can use operational tracking and history. Customer booking remains Customer-only; Courier actions remain assigned-Courier-only.
- Dispatcher cannot download receipts or proof. Those reads require the owning Customer or an Admin, including JSON, PDF and image formats. A combined Dispatcher/Customer account receives owner-only receipt/proof access unless it also has Admin.
- Customer accounts are the default user-management view. Other roles and All users have separate tabs. Multi-role users appear in each applicable group.

## Implemented role-to-page mapping

| Pages                                                               | Required role               | Additional server boundary                                                       |
| ------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------- |
| Dashboard, profile                                                  | Any authenticated account   | Current subject; non-Customer dashboards do not request Customer parcels         |
| Business registration (/merchant)                                   | Any authenticated applicant | Own application; keys require approved business ownership                        |
| Merchant webhooks                                                   | Merchant                    | Approved business owner; scoped business membership                              |
| Customer booking                                                    | Customer                    | Authenticated owner; quote/confirmation validation                               |
| Customer tracking, history, receipts and parcel details             | Customer                    | Own parcel; foreign or missing resources retain 404 semantics                    |
| Courier manifest, history and parcel details                        | Courier                     | Current assignment; state/version/proof rules still apply                        |
| Dispatch zone summary                                               | Dispatcher or Admin         | Operations read policy                                                           |
| Dispatch parcel list, history and live detail                       | Dispatcher or Admin         | Existing GET /api/v1/parcels and parcel detail/events APIs                       |
| Dispatch unassigned queue (/dispatch/unassigned)                    | Dispatcher or Admin         | Existing GET /api/v1/parcels with status=Created; search/date filters and paging |
| Dispatch parcel receipt/proof controls                              | Admin                       | Admin read scope; Dispatcher pages never request proof or show download controls |
| User management, audit, merchant approvals, zones, pricing, reports | Admin                       | Live Admin check for Identity administration; last-active-Admin protection       |
| Public tracking, authentication, 401, 403 and missing-page screens  | Public                      | Public tracking returns a limited summary                                        |

Route access is centralized in app/features/identity/route-access.tsx. Feature guards retain the same restrictions for standalone composition. Query keys include the user identity; operational parcel queries have a separate scope. Business and webhook queries wait for the appropriate role/approval. Accounts with multiple roles receive the union of permitted navigation, without granting ownership or assignment bypasses.

The 401/403 screens are client routes in the static SPA. Protected APIs return actual HTTP 401/403 statuses; a static hosting document response can remain HTTP 200.

## User management

Customers open first, followed by Couriers, Merchants, Dispatchers, Admins and All users. The Identity list endpoint supports role, search and status filters before pagination. The filtered count and rows use one repeatable-read database snapshot; combined-role users are counted once per result. Search matches literal name/email text, including SQL wildcard characters, through parameters.

The API is GET /api/v1/users?page=1&pageSize=20&role=Customer&status=active&search=name. Role is one of the five exact role names; status is active or inactive; search is bounded to 200 characters. Omit filters for all results. Duplicate, unknown and invalid parameters return 400. Audit pagination does not accept these filters.

Shadcn tabs, row dropdowns and account/role/status dialogs replace the persistent inline editor forms. A separate confirmation dialog protects mutations. The UI retains last-Admin error state, self-account session refresh, password clearing, no automatic mutation retry, loading/error/empty states, and focus restoration. New accounts receive Customer; additional roles require a separate confirmed change.

## Workflows still awaiting implementation

| Workflow                                       | Current gap                                                                                                                  | UI behavior                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Zone/priority filtering (remaining FR-D01)     | Current parcel query does not accept zone or priority filters                                                                | Created-only queue is enabled with search/date filters; see [Dispatcher integration](dispatcher-integration.md) |
| Assignment/reassignment (FR-D02/D04)           | No exposed assignment command                                                                                                | Assignment controls remain deferred                                                                             |
| Courier workload/capacity (FR-D03)             | No exposed workload/capacity endpoint                                                                                        | Remains disabled                                                                                                |
| Merchant business overview/statistics (FR-M06) | No business statistics endpoint; owned order reads are now available                                                         | Remains disabled; no invented totals                                                                            |
| Merchant orders (FR-M04/M07)                   | Backend dev now exposes scoped POST/GET /api/v1/merchant/orders and GET by ID; the web order workspace remains unimplemented | Remains disabled                                                                                                |

Backend PRs #23 and #24 added Merchant API-key authentication, scoped order intake and owner reads after the initial review. Merchant Orders stays disabled until its separate web workspace is implemented. Assignment, workload and business-statistics gaps remain. The role review does not fabricate endpoints or enable unavailable workflows.

## Validation

- Frontend npm run check passes formatting, lint, type checking, 428 tests in 22 files and the production build.
- Backend Release build and all 1,774 tests pass on the refreshed dev base: Identity 388, Delivery 1,011, Merchant 302, Gateway 68 and Notification 5. Persistence tests use disposable databases.
- The 13-project foundation dependency audit passes locally. Backend CI runs service startup, gateway forwarding and fail-closed authentication probes on a clean runner; the active local development stack occupies the smoke-test ports.
- Production-browser checks use isolated API fixtures. They verify Customer-first tabs and server pagination, role-filter page reset, last-Admin rejection, nested dialog Escape behavior and row-focus restoration, 390px page/dialog bounds, Dispatcher tracking without proof/receipt requests, Admin proof/receipt access, wrong-role direct URLs before private reads, and 401 sign-in returning to the protected destination.
- Desktop and mobile screenshots were inspected. Browser fixture checks do not claim a live Google-consent or production-database workflow.
