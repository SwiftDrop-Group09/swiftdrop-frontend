# Admin operations dashboard

The Admin `/dashboard` route now mounts the operations dashboard through RoleHome.
Other roles retain their existing home screens. The Admin guard runs before
private query components mount; cache keys include the current user. The chart
bundle loads only when the Admin workspace is opened, with the normal workspace
heading and skeleton retained during loading.

The default reporting period is the last 30 UTC dates, including today. A shared
ReportPeriod button beside Refresh opens shadcn Popover with Today/7-day/30-day
presets and custom date inputs. Custom dates require Apply; Cancel, Escape and
outside dismissal discard edits. Both dates are inclusive in the UI and translate
to inclusive-from/exclusive-to API timestamps. Maximum range is 366 days. Delivery
reports reuse the compact control, retain CSV export, and accept validated
`from`/`through` date-only links from the dashboard.

Delivery performance uses the existing DeliveryReport API twice: selected period
and the immediately preceding equal-length UTC period. KPI cards show terminal
outcomes, delivered, failed, cancelled, success rate and failure rate. Counts use
percentage change; rates use percentage-point changes. A nonzero count following
a zero baseline says New activity; 0/0 says No change. Missing comparisons remain
unavailable, never fabricated as zero. The current UTC day may be incomplete.
Cancelled outcomes are excluded from the delivered+failed rate denominator.

Daily stacked area and outcome donut charts use the official
[shadcn Chart component](https://ui.shadcn.com/docs/components/radix/chart) with
Recharts. Charts use shared semantic chart tokens with coordinated red shades
matching SwiftDrop's brand in light/dark themes, have
keyboard/tooltip support, explicit dimensions and numeric summaries. The registry
component is adapted to the repository's class-name utility and strict payload
typing. No feature stylesheet or inline feature CSS is added; the shared chart
primitive retains its standard library rendering and theme-variable handling.

Current zone workload and merchant approvals are explicitly separate snapshots,
independent of the reporting period. Workload uses the existing all-dates zone
summary. In progress = Assigned + PickedUp + InTransit + OutForDelivery; Created
means awaiting assignment. Delivered, Failed and Cancelled are excluded from
current work. The chart shows the six busiest returned zones, with numeric values
available to assistive technology and a link to the real zone summary page.
These are parcel status counts, not courier capacity or historical throughput.

Pending merchant applications use the existing Admin merchant list via the
configured authenticated transport, filter Pending, and show the oldest four.
The total is computed over the complete returned list. Review opens the existing
merchant approval page; the dashboard performs no approval mutations. An
unavailable source has its own retry and does not suppress successful sources.
Refresh refetches active dashboard sources; no mutation is automatically replayed.

No backend changes, new endpoints, database migrations, revenue figures or
invented operational metrics are included. Verification covers role gates,
user-specific cache isolation, equal-length intervals, zero baselines, partial
failures, compact filter cancel/apply, real browser chart rendering and responsive
light/dark layouts.

## Verification on 14 November 2026

Metric definitions, comparison-period rules, chart explanations and snapshot
scope appear in accessible shadcn info tooltips beside their headings. Hover or
keyboard focus opens the explanation; Escape dismisses it. KPI values, comparison
changes, snapshot labels and actionable error/empty guidance remain visible.

After integrating the upstream dispatcher screens, `npm run check` passes
formatting, lint, type checking, all 547 tests in 32 files,
and the production build. Chromium checks at 390px, 768px and 1920px render
all three chart SVGs, exercise range presets/custom validation/cancel, follow
the period-specific report link, and verify light/dark themes and independent
source failures without page errors or viewport overflow. Browser API fixtures
are isolated and perform GET reads only. Workspace actions now wrap within the
available tablet width. Hover and keyboard-focus checks also verify the info
tooltips and Escape dismissal. These browser checks do not modify service data.
