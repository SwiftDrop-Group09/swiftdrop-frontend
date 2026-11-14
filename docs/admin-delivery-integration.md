# Delivery administration integration

Work branch: `fix/admin-delivery-integration`, based on `dev`.
Reviewed and incorporated `origin/feat/admin-delivery-config-reports(f)`
(`84f9278`) while preserving its source branch and existing application routes.

The Admin sidebar now links to zones, pricing and delivery reports. Route modules
delegate to feature pages. Application controls and surfaces use shared shadcn/ui
components and semantic Tailwind utilities; no custom CSS was added.

The API adapter uses the existing authenticated transport and configured API
base. Failed requests never generate successful placeholder responses, invented
catalogs or report figures. Responses are validated against their contracts;
mutation requests carry the persisted concurrency version and are not replayed.
Query keys include the signed-in user and queries wait for an authorized session.
Save errors remain visible inside the open configuration dialog.

Validation: `npm run check` passes formatting, lint, type checking, all 252 tests
and the production build. Production-browser checks render all three pages at
390px and 1280px without horizontal overflow or page errors, using isolated API
fixtures. Transport tests cover unauthorized, forbidden, conflict, unavailable,
network and malformed-response failures without fabricated success.

The corresponding backend change provides real storage, authorization, audit
records, concurrency checks and an additive migration. Existing Google sign-in,
Identity session behavior and merchant approval routes are preserved.

The integration is committed and merged into `dev`. Source and integration
branches are removed after the remote merge is verified.

## Pricing and report workspace refinement

The current implementation is on `feat/zone-configuration-workspace`.
Pricing uses one row per delivery zone, with Small/Medium/Large active-rate
columns. A zone expands into independently paginated version history and
availability actions. The grouped overview API paginates zones before joining
active tariffs, so parcel sizes cannot split across overview pages. Unconfigured
sizes and inactive zones are explicit. Deploy the corresponding Delivery API
alongside this frontend; the overview requires no database migration.

Zone choices search and page on the server, rather than truncating at 100.
New pricing versions use a responsive shadcn Sheet, preserve failed/dirty drafts,
show field errors, and provide a clearly labelled rate preview. Rates are never
edited in place. Active creation and availability changes require confirmation;
status writes carry persisted expectedVersion and do not retry automatically.

Reports use explicit UTC date application, inclusive date labels, a maximum
366-day range, semantic summary cards and paginated daily results. Cancellation
is excluded from success/failure denominators. CSV export includes the complete
loaded period, even when the daily table is paginated. Unapplied date edits block
export to avoid mismatched filenames/data; failures hide stale summary values and
provide a read-only retry. Both routes enforce Admin access before mounting
private queries, and private cache keys include the user.

### Drift investigation

Merge `9bed68b` (PR #17) brought the divergent admin portals onto dev. Merge
`dd9df1a` inside that branch retained direct implementations in the pricing and
report portal files instead of dev's two-line feature wrappers. Earlier `c2bf023`
modified those older copies, while the shared feature pages continued separately.
The copies bypassed WorkspacePage and added AdminNav, page subtitles, inconsistent
spacing/colours and differently scoped query keys. Feature-only page tests missed
the route copies. Pricing and report portals now delegate to their feature pages;
the unused AdminNav has been removed, and new behavior tests import the actual
portal entry points. Shared headings use `text-xl sm:text-2xl`.

Verification for this refinement: all 477 frontend tests, formatting, lint,
type checking and production build pass. Chromium checks at 390/768/1920px
verify the real route entry points with isolated API fixtures, including CSV
download after daily pagination and versioned status confirmation. Delivery
administration tests pass 31/31 against disposable local PostgreSQL; the solution
build has no warnings or errors. No shared database data was changed.
