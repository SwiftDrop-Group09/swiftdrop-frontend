# Query caching and freshness

The shared QueryClient keeps private reads in memory for this application
instance. Sign-out, account changes and role changes clear private caches.
Results are not persisted to browser storage or a service worker. A full browser
reload restores the session and reads fresh data.

Fresh navigation reuses cached results without a request. General reads stay
fresh for two minutes; zone/pricing catalogs and courier names for five minutes.
Operational parcels, assignments, workload and zone summaries use 30 seconds.
Inactive entries remain for 15 minutes before garbage collection. Background
revalidation on stale mounts, focus and reconnect remains enabled. Refresh
explicitly refetches regardless of freshness; mutations are never replayed.

Admin and Dispatcher zone summaries share a user-scoped key, avoiding duplicate
reads between dashboards, workload, the queue and zone summaries. Zone/pricing
mutations invalidate dependent catalogs and booking lookups. Account edits
invalidate courier and audit name lookups. Existing parcel SSE version checks
continue to invalidate details when a newer version arrives. The integrated
Customer tracking view also polls active parcel details every four seconds and
stops for terminal outcomes; that live view deliberately overrides normal
navigation freshness. Assignment saves invalidate the shared zone summary,
queue, parcel details, options and fleet workload.

Unchanged JSON retains structural sharing, reducing UI updates. Policies follow
[TanStack Query's freshness model](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).
Other browsers/processes' changes are discovered on revalidation or Refresh;
this is not instant fleet-wide push. Backend prices, roles and mutations remain
authoritative. Actual requests still write server activity audits. Integration
worker polling is separate from page reads and is not disabled by this change.

Production-browser checks at 390, 768 and 1920 pixels verify that returning from
Zone summary to Courier workload issues no additional fresh workload or summary
request, while a hard reload obtains fresh reads. The unit suite verifies
expiry, invalidation, unchanged-data sharing and application-instance isolation.
