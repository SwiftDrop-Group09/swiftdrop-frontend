# Dispatcher dashboard

Dispatcher accounts now see a current-operations overview at `/dashboard`,
instead of navigation-only workspace cards. The page adapts the official shadcn
`dashboard-01` KPI, chart and table composition to existing Delivery reads.
It reuses the installed shared components and Lucide icons; no demo data,
replacement shell, table-dragging dependencies or new packages are installed.
The sidebar, breadcrumbs, account menu and Light/Dark/Device appearance remain
owned by the existing shell. Other roles keep their existing dashboards.

## Counts and previews

All figures span all booking dates. There is no reporting-period filter or
historical comparison. Counts represent current states, not transitions today.

- **Awaiting assignment** uses the Created-parcel query's `totalCount`, not the
  five displayed rows or the sum of configured-zone counts.
- **In progress** sums Assigned, PickedUp, InTransit and OutForDelivery across
  the zone summary. Delivered, Failed, Cancelled and unknown statuses are excluded.
- **Out for delivery** sums OutForDelivery and is explicitly part of In progress.
- **Zones with backlog** counts zones with at least one Created parcel. Missing
  status keys mean zero; empty catalogs differ from configured zero-workload zones.

The stacked horizontal chart previews up to six zones with positive status
counts. Like Zone summary, it ranks by Booked + Delivery unsuccessful + Cancelled,
then name and zone ID, so delivered volume does not determine operational priority.
Zero-count zones remain available in the full Zone summary.

The chart and matrix share their status groups: Before transit (Booked, Assigned,
Collected), On the road (In transit, Out for delivery), Done (Delivered), and
Problems (Delivery unsuccessful, Cancelled). They use the system's amber, sky,
emerald and destructive red families. Chart fills match the matrix's strongest
background shades: amber/sky/emerald 200 in Light, their 900 shades at 70% in Dark,
and destructive at 10% for problems. Subtle status borders preserve segment edges.
Unknown returned statuses form a neutral Other statuses
series when present, rather than being discarded or inferred from the API total.

The shadcn Chart legend labels each group. Plain text below the ranking caption
shows full zone names, exact per-status counts, group sums and the authoritative
API Total parcels, kept separate from the sum of status counts. The first shown
zone is selected initially; pointer and keyboard chart selection update this
inline area, which retains the selected values after leaving the chart. No
floating detail card covers the bars. A polite status region announces updates.
A screen-reader table exposes full zone names, every returned status and API totals
for the same six-zone preview. Large axis values use compact formatting, while
inline and accessible values remain exact. Empty catalogs, configured zero
zones and missing status breakdowns have distinct notices. The dashboard's
operational KPIs retain their existing definitions above.

The courier card shows the first five entries of workload page 1, preserving
server order and labeling the partial preview. Names are resolved only for those
five IDs. Stable codes, active/duty status and outstanding-assignment/capacity
values remain visible when names are unavailable. These are not a fleet-wide
availability ranking or assignment eligibility checks. Use **View workload** for
the full fleet and active-parcel drill-down.

The parcel table requests the five newest Created parcels, shows pickup/delivery
cities and booking timestamps, and links to authorized Dispatcher parcel details.
Use **Open queue** to filter the full queue or assign a courier. The dashboard
does not duplicate mutation dialogs or imply that newest means highest priority.

## Reads, isolation and refresh

No backend endpoint, public response, schema or migration changes are required.
The guarded Dispatcher component mounts only for a single Dispatcher role;
Admin's existing dashboard and its Dispatcher tool access are preserved.

- Zone summary: `['delivery-zone-summary', userId]`, undated.
- Parcel preview: `['customer-parcels', userId, true,
{ status: 'Created', page: 1, pageSize: 5 }]`, using the existing operations mode.
- Fleet preview: `['dispatch-workload', userId, 1]`, using the existing 20-row page.
- Names: the existing user-scoped `courier-directory` key for displayed IDs.

The shared QueryClient keeps private results in memory and uses existing
freshness policies. Reads consume AbortSignal. Account changes remount the
Dispatcher view; session/account/role changes clear private caches. Existing
assignment/reassignment invalidation already covers the dashboard's query keys.

**Refresh** refetches the current dashboard reads, including names when present.
Sections fail independently. Initial failures show unavailable values rather than
invented zero counts; failed refreshes label retained data as previously loaded
and provide safe read retries. Separate endpoints can observe different commits,
so queue and zone snapshots are not presented as an atomic response. Changes
from other browsers appear on normal revalidation or Refresh.

## Verification

Focused tests cover authoritative counts, current-state aggregation, bounded
previews, ordering and accessible chart values, real SPA destinations, empty and
failure states, retained refresh results, name fallbacks, account/role isolation,
and read cancellation. The existing full workflow test also primes the dashboard
before assignment and checks its refreshed counts and both courier workloads
after assignment and reassignment.

Run `npm run check` with the pinned Node/npm, plus production-browser checks at
1280/768/390/320px in all appearance modes. Browser transport fixtures establish
UI behavior; they do not establish signed-in shared-environment acceptance.
Current evidence and any startup limits are recorded separately during review.

### Local review — 16 November 2026

Tested the uncommitted dashboard patch based on frontend `d1c199b`, on Linux,
Node 24.16.0 and npm 11.13.0. The final unmodified `npm run check` passed
formatting, lint, TypeScript, all **755 tests / 50 files**, and the production
build. One earlier full-suite repeat reproduced the previously documented
Identity ambiguous-role heading timeout (754 passing); the Identity test,
assertion, timeout and worker configuration were not changed. The final pass
does not establish that this intermittent owner issue is resolved.

Production Chrome 157.0.8103.78 passed **23 isolated-fixture browser groups**:
1280/768/390/320px, Light/Dark/Device, contained table scrolling, bounded previews,
keyboard and SPA navigation, empty/loading/failure states and retained-refresh
recovery. Desktop and mobile screenshots were visually inspected. These checks
used no real signed-in account or shared parcel writes.

`sh swiftdrop-infra/development/run.sh build web` passed for the final application
source. Full Docker startup acceptance was not renewed: the current runner's
`up` path executes shared migration tasks, and task-specific migration/startup
authorization remains deferred. Older README wording that startup does not
apply DDL is inconsistent with current runner source. Image build and browser
fixtures do not substitute for that pending acceptance. No backend, infra or
other-role implementation was changed; nothing was committed or pushed.
