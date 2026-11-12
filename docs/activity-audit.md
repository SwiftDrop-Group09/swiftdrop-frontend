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
