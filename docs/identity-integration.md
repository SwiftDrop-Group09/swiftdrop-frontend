# Identity client integration

This feature implements Part A Phase 8 against the Identity backend on
`feat/identity-sessions-google`. It extends the clean frontend baseline
`c062b11` on `feat/identity-clients`; it does not merge the independent
`origin/feat/customer-quote-booking` branch.

## Implemented

The Router routes `/register`, `/login`, `/profile`, and `/admin/users` compose
one shared Identity feature. Registration, local login, Google SDK sign-in,
explicit password-confirmed Google linking, profile editing, restoration,
refresh, logout, paged user/audit views, user creation/update, role replacement,
and deactivation have loading, validation, and safe error states.

The existing Query provider, React Hook Form, Zod, Router, and test tools are
reused. No runtime packages are added. Server-side authorization remains
authoritative; hiding Admin navigation is only a user interface affordance.
Profile changes never submit account IDs, email, roles, or activation flags.
Profile updates include required `fullName` and `phoneNumber` fields; phone may be
null/empty, with optional address. Unknown or missing required fields are rejected.

The user approved the create-only `password` field on 26 October 2026.
Admin creation submits `{email, fullName, isActive, password}`; updates submit
only `{email, fullName, isActive}`. Web Crypto generates a unique 192-bit initial
password. It can be revealed for private distribution, then is cleared after
submission. It is not stored in Query mutation variables, persistent browser
storage, URLs, or logs. Password reset/email delivery are not implemented.

## Browser transport and configuration

`VITE_API_BASE_URL` defaults to `/api` and must be a same-origin path. For example,
login calls `/api/v1/auth/login`, and profile reads call `/api/v1/users/me`.
The browser never submits JSON refresh credentials. Access tokens live only in
the session instance's memory; Identity owns its HttpOnly refresh cookie.

Before mutations the client obtains `GET /api/v1/auth/csrf` with
`credentials: include`, then submits `X-CSRF-Token`. Bootstrap and Identity API
responses use `cache: no-store`. No automatic mutation replay is performed,
including after an ambiguous network failure. Concurrent refresh calls share
one promise per provider. The authenticated transport may refresh and retry a
GET once. Logout clears private Query caches and memory even if server revocation
cannot be confirmed, and reports that distinction to the user.

In-flight authorized responses are rejected if logout or a new login changes the
session, so a prior account's data is not published into a new session. Disabled
or demoted accounts rejected by management endpoints are signed out locally.
An incorrect fresh password during Google linking does not silently log out an
otherwise valid local session.

Deploy frontend and public Gateway behind the same HTTPS origin/site. Configure
Identity's exact `Identity:Browser:AllowedOrigins`, explicit trusted proxy IPs,
forwarded public host/protocol, and persistent shared Data Protection keys.
Secure `__Host-`/`__Secure-` cookies are retained. No cross-site cookie design or
CSRF weakening is introduced. The existing HTTP-only Vite/Compose workflow is
not evidence that production browser cookies work. In particular, Vite currently
rewrites upstream Host: a same-origin bootstrap GET may omit Origin, making
correct public host/protocol forwarding necessary. Infrastructure must supply
and test that configuration; no infrastructure changes are included here.

Parallel refreshes across independently opened tabs are not coordinated by this
provider. A genuine reuse/concurrency rejection signs the client out; the server
remains responsible for atomic rotation and family revocation.

## Google integration

Set public `VITE_GOOGLE_WEB_CLIENT_ID` to the Google Web OAuth client ID and
configure its exact authorized JavaScript origin. Match that audience in
Identity's allowlist. No Google client secret belongs in a Vite variable.

The official Google Identity Services script renders a popup sign-in button.
Its callback credential is exchanged as `{idToken}`. Initialization includes the
server-issued `googleNonce`. One button is mounted per route; cleanup cancels the
SDK interaction and ignores late callbacks. A completed attempt renews bootstrap
nonce before another attempt, including after the server's ten-minute nonce
expires. Cancellation produces no Identity login request. A local account
collision displays instructions to sign in locally and link from the profile.
Logout calls `disableAutoSelect` when the SDK is available.

Implementation references: [Google JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
and [displaying the sign-in button](https://developers.google.com/identity/gsi/web/guides/display-button).
SDK configuration/callback behavior is tested with a stub; real provider consent,
configured audiences/origins, and deployed browser TLS are still integration
dependencies.

## Booking and other client handoff

`useIdentity().session.authenticatedRequest` has the teammate's
`AuthenticatedRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`
shape. It accepts same-origin paths under the configured API base, adds the
current bearer token, retains original Request headers plus explicit overrides,
and does not retry booking mutations. Supply it to `CustomerBookingApi` when
the independently owned booking branch is integrated. The `user.id` and
server-returned `user.roles` provide the current principal for its attempt store.
Private cache/attempt state must clear when the principal changes or logs out.
No booking source, Delivery implementation, or Gateway route was changed.

Courier and Customer use the same server Identity contract. An authenticated
Courier requires a real server-assigned `Courier` role; there is no privileged
signup choice or local role override. Flutter implementation is separately
blocked and documented in the mobile repository's `docs/identity-handoff.md`.

## Verification and limits

Run the repository's pinned Node 24.16.0 / npm 11.13.0, `npm ci`, then
`npm run check`. The default workstation Node 24.11.1 is below the declared
engine, so an external portable pinned runtime was used for feature checks.
Observed results on 26 October 2026:

| Command                            | Actual result                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `npm ci --ignore-scripts`          | 272 packages installed, 273 audited, zero vulnerabilities; initial workstation engine warnings recorded |
| `npm run check` on pinned Node/npm | Passed formatting, lint, strict types, 46 tests in four files, production SPA and root prerender build  |
| `npm audit --omit=dev`             | Zero vulnerabilities reported                                                                           |
| `git diff --check`                 | Passed                                                                                                  |

Tests exercise actual React forms and the fetch transport with HTTP response
fixtures, plus session concurrency, expiration, cache clearing, rejection,
Google nonce/collision/link behavior, Admin authorization visibility, confirmed
creation/roles/deactivation, and audit paging. They do not replace a real browser,
Google provider, PostgreSQL-backed Gateway environment, Docker image check, or a
hosted GitHub Actions run. Those checks must not be reported as completed here.

Canonical source documentation remains Proposed. This handoff records the
supporting CSRF bootstrap, nonce transport, audit projection, and approved
create-only password extension; it does not silently amend the documentation
repository. Main's earlier setup-only README statements are superseded by this
feature. No UI for deferred password reset, email changes, unlinking providers,
or immediate downstream JWT revocation is introduced.

Identity errors include an opaque UUID `correlationId` and matching `X-Correlation-ID` response
header. The UI maps stable error codes to fixed messages and does not expose raw
server details or credentials. Private Query caches clear on principal or role
changes as well as logout.
