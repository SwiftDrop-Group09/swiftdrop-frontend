# Workspace navigation

## Current role review

See [role workspace review](role-workspace-review.md) for the current route and
API audit. `/dispatch/zones` is implemented for Dispatcher and Admin; other
Dispatcher operations and Merchant order/dashboard links remain disabled pending
their backend contracts. Customer-only pages are guarded before private reads.
Non-Customer dashboards display their authorized workspace links. The shared
responsive shell and design rules are documented in `AGENTS.md`.

The current user's name and email appear in the sidebar footer. Selecting this
control opens a shadcn dropdown containing My profile and Sign out, available to
every role. Profile is no longer duplicated in the navigation groups. The menu
supports keyboard navigation and closes the mobile drawer when opening profile.
The shared `BrandLogo` text wordmark is used across application headers, public
tracking and receipt views, with a matching SVG favicon.

The sidebar follows the current documentation contracts, inspected on 9 November
2026: [SRS sections 3.1-3.5](../../swiftdrop-docs/requirements/srs.md),
[authorization and ownership](../../swiftdrop-docs/security/authorization.md),
[use cases](../../swiftdrop-docs/requirements/use-case-specifications.md), and
[React scope](../../swiftdrop-docs/architecture/technical-design.md). Those
documents identify themselves as a proposed baseline; this change implements the
navigation without claiming that all underlying features are complete.

`app/features/identity/workspace-navigation.ts` defines the groups. Visibility
uses only the roles returned in the authenticated Identity profile. Multiple
assigned roles produce the union of the relevant groups, once each. Dashboard,
My profile and Business registration are shared. Business registration is
available to an authenticated applicant under the documented authorization rule;
it must not require an already assigned Merchant role.

| Group          | Menu items                                                                                           | Documentation                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Workspace      | Dashboard; My profile; Business registration                                                         | Authenticated shell; FR-C03; FR-M01/M02            |
| Customer       | Book a delivery; Track a parcel; Delivery history; Receipts                                          | FR-C04/C05; FR-C06; FR-C07; FR-C08                 |
| Courier        | Assigned deliveries; Delivery history                                                                | FR-R01 through FR-R04; FR-R05                      |
| Merchant       | Business overview; Orders; API keys; Webhooks                                                        | FR-M06; FR-M04/M07; FR-M03; FR-M05                 |
| Dispatch       | Unassigned parcels; Courier workload; Zone summary                                                   | FR-D01/D02/D04; FR-D03; FR-D05                     |
| Administration | User administration; Merchant approvals; Delivery zones; Pricing tiers; Delivery reports; Audit logs | FR-A01/A02; FR-A03; FR-A04; FR-A05; FR-A06; FR-A07 |

The Courier assignment workflow owns status changes, proof upload and failure
reporting; these are contextual actions on an assigned delivery, not separate
global actions. Fee estimation belongs to booking before confirmation. Merchant
order submission remains a scoped API integration, rather than a fabricated web
order form. Business overview is reserved for actual owned-business statistics;
the current empty dashboard does not pretend to show them. Delivery reports do
not introduce revenue or payment features.

Dispatch navigation is visible to Dispatcher and Admin because authorization
explicitly permits both to assign/reassign parcels and read operations data.
An Admin-only account does not receive Customer booking or Courier operational
actions. Navigation visibility never grants API permission or proves resource
ownership. Merchant approval and business membership must still be checked by the
owning service when its screens are implemented.

## Current destinations

The actual router currently implements `/dashboard`, `/profile` and
`/admin/users` and Customer-only `/customer/book`, plus Courier-only `/courier`, `/courier/history` and assigned parcel details at `/courier/parcels/:id`. The audit item links to `/admin/users#identity-audit`, the existing
Identity audit section; its explicit View audit log control loads the records.
This is Identity auditing, not a completed cross-service audit projection.

Every remaining documented item is a disabled shadcn sidebar button marked **Soon**
with an accessible explanation. These items have no invented URL, API call, or
placeholder success screen. Their feature branches are not merged by this
navigation change. Enable an item only after registering its real route and
implementing its authorization and ownership checks.

Desktop collapse, mobile drawer navigation/close, active links including the
audit fragment, and shared sign-out remain part of the dashboard shell. Tests
cover all five roles, combined roles, profile role changes, disabled destinations,
and audit navigation. Server enforcement and live provider consent require
separate integration checks.

## Verification on 9 November 2026

`npm run check` passed formatting, lint, TypeScript, 71 tests in four files, and
the production build on the pinned Node/npm toolchain. Chromium checks against
that build covered each role, combined roles, root restoration/redirects, the
signup alias, audit navigation, and mobile drawer navigation at 320px without
horizontal overflow. API responses in those checks were isolated fixtures.

The official Google SDK also rendered its real inline control at desktop,
375px and 320px widths. This verified provider rendering and sizing, without
performing Google consent or a real account/token exchange.
