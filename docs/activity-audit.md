# Admin audit workspace

`/admin/audit` replaces the audit section on User management. The sidebar and
User management link go to the new page; the previous `#identity-audit` bookmark
redirects there. Only Admin accounts mount the private audit queries.

The page uses the shared responsive workspace and shadcn components. Filters
cover service, local-time range, actor UUID, role, actor type, IP address, action,
method, outcome, record kind, resource UUID and correlation UUID. UUID/IP inputs
are validated; the backend independently validates all filters. Filter changes
apply on submission and reset pagination. Time ranges are inclusive/exclusive,
and records display UTC timestamps. IPv4/IPv6 and combined user roles are retained.

The client reads each authorized service and merges newest-first pages. Cursors
advance only for records consumed from that service, preserving interleaved
history across page sizes. A refresh creates a new upper time bound and resets
cursors; later requests do not shift the current page window. Source failures are
shown as errors, not silently presented as complete results. Disabled recording
is explicitly highlighted. All query keys include the signed-in Admin ID.

Record details show server metadata without request/response bodies. Historical
records cannot gain retroactive IP addresses or role snapshots: missing values
are shown as Not recorded. System background jobs show Not applicable for client
IP. A record without completion can represent an open stream or interrupted
request; it does not prove a failed operation.

Deploy the backend migrations and routes described in the backend activity audit
document before expecting live records. This feature does not merge, deploy or
silently migrate a shared database.

Actor names come from the Admin-only Identity directory for the visible page.
They reflect current profiles, not historical name snapshots. Recorded actor
UUIDs and roles remain unchanged in details. Missing accounts show Unknown or
deleted account; lookup errors show Actor name unavailable without hiding logs.
Refresh retries name resolution. Historical hash-derived PostgreSQL GUIDs are
accepted without requiring an RFC UUID version; malformed GUIDs remain invalid.

## Filter builder

The shared `FilterBuilder` / `FilterLabels` components compose shadcn controls.
Filters opens as an anchored, nonmodal popover beside Refresh. Choose Key, Is/Is not and Value, then Add filter.
Visible labels support individual removal and Clear all filters. One rule per
field is supported; adding that field again replaces its rule. Rules combine
with AND. Enum values are complete; actor/action/IP/resource/correlation options
come from the visible page (actor names resolve through Identity). Date bounds
remain available inside the popup and are included when clearing all filters.
Action comparisons retain substring semantics, labelled Action contains.
Exclusions are applied by the owning service before counts/cursor pagination;
service exclusion selects which services are queried. Unknown historical values
are retained in labels even when no longer present on the current page.

If users return 400 for valid role/search/status filters, restart the backend
hosts after pulling: an older running Identity build rejects those parameters.
The client does not silently drop filters or show misleading unfiltered results.
