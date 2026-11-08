# Courier clients — Phase 7

The Courier workflow, Customer booking and shared shadcn/Identity workspace are
merged into default branch `dev`. `/courier`, `/courier/parcels/:id` and
`/courier/history` reuse IdentityProvider, IdentityShell, QueryClient and
IdentitySession.authenticatedRequest. There is no additional login, token store
or Courier ID input. The booking route is `/customer/book`; both features retain
exact numeric parsing. Their controls use shared shadcn components, with no
Courier stylesheet or duplicate sidebar. The signature canvas remains a domain
input surface. See [combined PR review](pr-integration-review.md) for validation.

## Verified contracts

All requests use the existing same-origin API base, followed by `/v1`:

| Method | Resource                   | Client behavior                                                                                                       |
| ------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/couriers/me/assignments` | Optional service date, includeOverdue, page/pageSize; default day comes from Delivery's Asia/Colombo operations clock |
| GET    | `/parcels/{id}`            | Active assigned private details and real server history                                                               |
| PUT    | `/deliveries/{id}/status`  | Only the next stage, or Failed with an explicit canonical reason; version and Idempotency-Key                         |
| POST   | `/deliveries/{id}/pod`     | OutForDelivery only; recipient name, version, photo or signature (both allowed) and Idempotency-Key                   |
| GET    | `/couriers/me/history`     | Minimal terminal summaries, pagination only; no protected detail links                                                |

Version tokens and monetary values are parsed before floating-point conversion.
No price calculation or locally fabricated status history is used. Stage notes
are nonblank and at most 500 UTF-16 code units. Failed reasons are exactly
RecipientUnavailable, AddressUnreachable, Damaged or Other. Optional failure
notes are transmitted without silently dropping the selected reason.

Proof is JPEG/PNG, at most 5 MiB per image. Browser file selection supports
camera capture where available; a pointer-based signature pad exports PNG.
Recipient name is nonblank and at most 120 code units. Files remain in memory;
there is no localStorage, IndexedDB, persistent proof URL or public bucket URL.
Fetch through the Identity adapter does not expose upload byte progress, so the
screen shows an indeterminate confirmation state. Only a valid matching 200
receipt can confirm Delivered. The status endpoint is never used for Delivered.

## Concurrency and recovery

Each immutable attempt freezes parcel/version/status, body or File objects and
one random idempotency key. Double clicks are serialized. No write is retried
automatically. Network/timeout/503/operation_in_progress retain the original
attempt and disable other actions. An explicit retry preserves bytes/body/key,
uses a fresh deadline, and respects Retry-After. Reads/status requests have a
20-second deadline; proof uses 120 seconds. A refresh outage is a network
failure, distinct from a revoked session.

Stale/invalid transition responses discard the attempted action, remove the old
detail and reload; a new action is required. 404 hides lost-assignment details.
401/403 remove private views. Account/role scope changes unmount private forms,
clear pending proof, and the Identity owner clears private Query caches. Late
responses cannot repopulate a disposed workflow. React's development effect
probe reconnects before final microtask teardown; genuine unmounts release
the retained request. Keep an uncertain session open: closing it loses the
in-memory key/files. Reopening starts with fresh server reads, not an offline
write queue or automatic replay with a new key.

Access denial also invalidates in-flight workflow results, so a late write cannot
restore a receipt after private access ends. Unexpected success/redirect codes remain
unconfirmed outcomes: only the documented 200 receipt confirms delivery, and the
screen directs an explicit retry of the original request.

## Verification and boundaries

Run pinned Node 24.16.0/npm 11.13.0, `npm ci`, then `npm run check`.
Courier API/workflow/UI tests include StrictMode, stage availability, proof,
failure reason, stale state, uncertain retry, long versions/prices, role changes
and terminal privacy. Existing Identity tests remain in the same suite.

The explicit scripts under `test_support` are never imported by application
routes. Start the owned backend fixture from its checkout:

```text
dotnet run --project tests/SwiftDrop.Delivery.Harness -c Release --no-build -- --actor courier --port 5088 --courier-workflow
```

Set the backend's existing owned PostgreSQL test variables as documented there.
Then run `node test_support/courier-http-smoke.mjs`. A fresh fixture contains
two Assigned and two OutForDelivery parcels plus one Failed summary, shared by
the React and Flutter checks. Each check consumes one pair. The proof object
adapter is test-only memory storage; it does not prove private bucket deployment.

For browser checks, run the existing dev server with
`DEV_GATEWAY_TARGET=http://127.0.0.1:5088`, then
`node test_support/courier-browser-smoke.mjs` with Playwright and Chrome installed.
`PLAYWRIGHT_MODULE` may specify a file URL to an already-installed Playwright
module. Browser Identity responses are explicit test stubs; Delivery HTTP goes
to the real fixture. This is not live JWT acceptance. Screenshots use fictional
data in the backend's ignored `artifacts/courier-phase7-browser` directory.

Production Delivery still fails closed pending real issuer/JWKS integration.
Live Courier provisioning, encrypted proof storage acceptance, gateway routing,
outbox relay/consumers and native-device validation remain integration work.
The original Phase 7 handoff predates the backend Phase 8 verification harness;
the combined browser/HTTP checks are now recorded in the PR review.
