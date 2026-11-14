# Delivery zone configuration workspace

Admin-only /admin/zones uses shared shadcn controls and the full workspace width.
The coverage table shows three postal-code badges, expanding the remainder on
request. Expanded rows load the existing zone workload summary and zone-scoped
pricing independently, with separate failure/retry states. Missing data is not
reported as zero. Pricing previews show up to three records from the first page;
Manage zone pricing opens /admin/pricing?zoneId=... with the filter applied.
Workload is recorded parcel status across all dates, not courier capacity.

Search (name/city/postal code), city Is/Is not and active/inactive status are sent
to GET /api/v1/zones before server-side counts and pagination. City options come
from all configured zones, independent of the selected page/filter. Empty filtered
results differ from an unconfigured system. The reusable filter popover and chips
support single removal and Clear all, including applied text search. A filtered
request requires the new cities response metadata to avoid silently accepting an
old backend that ignores filters. Deploy the corresponding backend changes.

The responsive right-side Sheet has details, postal coverage and availability.
Code chips support typing, pasting comma/semicolon/whitespace-separated lists,
case-insensitive deduplication and removal. Codes remain strings; leading zeros
are retained. Five-digit examples are guidance for Sri Lanka, not a restriction
on previously supported alphanumeric postal codes. Uncommitted input is included
when saving. Closing a dirty editor requires explicit discard; browser refresh
also warns. Availability changes require an inline confirmation before saving.
There is no nested confirmation modal.

Updates keep expectedVersion from the opened row. Failed saves preserve the draft
and show postal/name field errors where returned. Version conflicts instruct the
operator to close, refresh and reopen the latest saved zone, retaining the current
draft until explicitly discarded. Mutation retries are manual. Pending writes
block dismissal. Successful writes invalidate zone, pricing-label and summary
caches, return pagination to page one and restore focus to Add zone.

No maps, polygon editing, geographic lookup, bulk migration or seed changes are
included. Postal coverage is the existing data contract. Verify with npm run
check, relevant UI/browser checks and backend administration persistence tests.
