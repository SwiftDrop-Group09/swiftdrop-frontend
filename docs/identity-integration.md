# Identity client integration

Identity, Customer booking and Courier workflows are merged into the default
`dev` branch. The original Identity feature started at `c062b11` on
`feat/identity-clients`; these are historical checkpoints, not current branch
boundaries. The booking production adapter now consumes the shared session.

## Implemented

The Router routes `/register`, `/login`, `/dashboard`, `/profile`, and `/admin/users` compose
one shared Identity feature. Registration, local login, Google SDK sign-in,
explicit password-confirmed Google linking, profile editing, restoration,
refresh, logout, paged user/audit views, user creation/update, role replacement,
and deactivation have loading, validation, and safe error states.

The existing Query provider, React Hook Form, Zod, Router, and test tools are
reused. The current UI also uses shared shadcn/Radix primitives. Server-side authorization remains
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

Google script loading and the same-origin CSRF/nonce bootstrap are separate
dependencies. Bootstrap errors retain their safe Identity error messages: an
`audit_unavailable`/503 response reports temporary account-service unavailability,
and `csrf_rejected` reports browser verification failure. Script downloads or
timeouts report Google loading failure. Unexpected bootstrap JSON is rejected
before sending credentials, and unknown server failures never expose raw bodies.
Retry Google sign-in fetches a new bootstrap before enabling the provider control;
failed initialization does not exchange a Google token or replay a mutation.

For a local bootstrap returning `audit_unavailable`, check Identity `/ready` and
the owning database migrations. The audit recorder must be available before
authentication proceeds; Identity migration `004_actor_activity_audit` creates
the required append-only table and grants runtime access. Use the infrastructure
runner's explicit Identity migration command with migration credentials. Do not
disable auditing or weaken CSRF checks to recover sign-in.

Set public `VITE_GOOGLE_WEB_CLIENT_ID` to the Google Web OAuth client ID and
configure its exact authorized JavaScript origin. Match that audience in
Identity's allowlist. No Google client secret belongs in a Vite variable.

The shared development runner forwards `VITE_GOOGLE_WEB_CLIENT_ID` to both the
frontend and Identity's web audience list, unless `IDENTITY_GOOGLE_WEB_CLIENT_ID`
explicitly overrides the server audience. Restart a running host stack after
changing environment values. A missing/invalid server audience or a Google
verification outage returns `google_unavailable`/503; invalid signatures, claims
or nonce bindings continue to be rejected. Service outages do not automatically
replay a Google login; a new user attempt obtains a fresh nonce.

The official Google Identity Services script renders the provider sign-in
control directly in the form, without an application dialog. Its supported
outline/rectangular options and responsive width match the surrounding controls.
A scoped CSS exception styles only the host layout and keyboard focus; it does
not attempt to modify Google's iframe contents.
Its callback credential is exchanged as `{idToken}`. Initialization includes the
server-issued `googleNonce`. One button is mounted per route; cleanup cancels the
SDK interaction and ignores late callbacks. A completed attempt renews bootstrap
nonce before another attempt, including after the server's ten-minute nonce
expires. Cancellation produces no Identity login request. A local account
collision displays instructions to sign in locally and link from the profile.
Logout calls `disableAutoSelect` when the SDK is available.

Local and Google sign-in navigate to `/dashboard`. Customer registration validates
confirmation locally, submits only the existing registration fields, then performs
a separate login to establish a session. A confirmed registration followed by a
failed login offers a sign-in link without resubmitting account creation. The
responsive dashboard shell contains sign-out, an empty workspace, and
[documented menus for all five roles](workspace-navigation.md). Only implemented
screens have links; other menu items are disabled and marked Soon. It introduces
no booking workflows or demo data. The registration page does not show internal
role assignment instructions; the server still assigns Customer on signup.

The root `/` waits for session restoration before replacing the URL with
`/dashboard` or `/login`. `/signup` resolves to `/register` for signed-out visitors;
authenticated visitors to any auth entry go to the dashboard. There is no
intermediate landing card or application dialog.

The auth layouts adapt shadcn's `login-02` and `signup-02`; the dashboard shell
adapts `dashboard-01`. Pexels stock photos are stored locally with
[source and license credits](../public/images/auth/CREDITS.md).

Implementation references: [Google JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
and [displaying the sign-in button](https://developers.google.com/identity/gsi/web/guides/display-button).
SDK configuration/callback behavior is tested with a stub; real provider consent,
configured audiences/origins, and deployed browser TLS are still integration
dependencies.

## Profile settings and connected sign-in methods

The 9 November 2026 profile update adds a responsive personal-details editor,
server-assigned role badges and role descriptions, contact-address guidance, and
Admin access to the existing user administration screen. Email and roles are
read-only. Save is enabled for changed fields; reset restores the latest saved
values, and successful saves update the form, profile cache and sidebar name.

The sign-in card reads `GET /api/v1/auth/methods` using the current bearer token.
Its `{hasPassword, googleLinked}` response describes connected account methods;
it does not infer how this particular session was opened. Missing or unavailable
metadata shows a retry state and no connection action.

- Password only: Connect Google asks for the current password and uses the
  inline Google SDK control with a fresh nonce. The existing link endpoint checks
  the same verified email and provider ownership. Successful linking refetches
  the confirmed method state. A wrong password or rejected email leaves the
  existing local session usable; an actual authorization rejection still fails
  closed.
- Google only: Add password validates a 12-128 character password and confirmation
  locally, then requires the inline Google control to confirm the linked identity.
  `POST /api/v1/auth/password` submits only `{idToken, password}`; the backend
  validates the nonce and exact existing Google subject, hashes the password and
  commits its audit atomically. It cannot overwrite an existing password or merge
  accounts. Google remains connected.
- Both: the card shows both methods enabled without redundant connection forms.

Credential actions use no Query mutation variables or persistent browser storage.
Passwords are cleared after attempts and on cancelling/unmounting the editor.
Cancellation is disabled while an exchange is in progress. There is no automatic
credential mutation replay, password reset, email change or provider removal.

Deploy/rebuild the Identity changes alongside this frontend. See the backend's
[account-connections contract](../../swiftdrop-backend/docs/account-connections.md).
The existing schema and secrets suffice; no migration is required. The owning
service and Gateway boundaries are unchanged.

Checks on 9 November 2026: 84 frontend tests, formatting, lint, types and production
build passed; Chromium exercised all five role profiles, save/reset, both
connection directions, both-connected state, cancellation, payload allowlists
and 320px layouts using isolated API/provider fixtures. Backend tests exercise
the real PostgreSQL transactions and rejection paths. Google's live SDK control
also rendered inside the profile confirmation step at 320px, 375px and desktop
without overflow. Real Google account consent
and a deployed browser token exchange remain separate integration checks.

## Booking and other client handoff

`useIdentity().session.authenticatedRequest` has the teammate's
`AuthenticatedRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>`
shape. It accepts same-origin paths under the configured API base, adds the
current bearer token, retains original Request headers plus explicit overrides,
and does not retry booking mutations. The `/customer/book` workspace supplies
this transport to `CustomerBookingApi`, along with server-returned `user.id` and
`user.roles`. Its Customer-only area adapter uses `/api/v1/quotes/zones`.
Uncertain confirmations survive route navigation and clear on logout, account or
role changes. Courier clients use the same session/request seam. See the
combined PR review for current validation and the backend's separate IAM gate.

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

## Delivery rejection and session recovery (12 November 2026)

A Delivery/Merchant 401 is a resource-service rejection, not proof that the
Identity session is invalid. The shared transport verifies the session through
Identity refresh, retries a GET at most once, and returns a remaining service 401
to the feature's error UI. It does not clear a valid global session. Mutations
are never replayed automatically; a 401 can verify Identity through refresh but
the original response remains available to the feature's retry workflow.

A rejected Identity refresh still clears the session. Identity-owned auth/users/
audit resources rejecting a fresh token also clear it. Account/role private-cache
clearing and stale-response checks remain in place.

Validation: npm run check passed format, lint, types, all 239 tests and production
build. A Chromium regression against that build confirmed two Delivery 401s, a
successful Identity refresh, a visible resource error and no dashboard-to-login
redirect or page errors. Browser API responses were isolated fixtures. The
backend and infra companion PRs add Delivery's real token verifier/configuration.

### Startup and profile presentation

Initial hydration and session restoration use a shared full-screen SwiftDrop
loading view. `SessionReady` gates route rendering until verification completes;
it does not restore cached roles or expose private pages before authentication.
Signed-out users continue to the existing login/return-path behavior. No
artificial loading delay or persisted account data is introduced. The loading
indicator respects reduced-motion preferences and includes an accessible status.

My profile uses responsive personal-detail and sign-in cards with a full-width
workspace access section. Contact changes retain validation, reset/save feedback
and account-scoped queries. Connected Google/password workflows are unchanged.

Role and account-status review uses sequential modals. The editor finishes its
close lifecycle before confirmation mounts. Cancelling closes confirmation
before restoring the editor, preserving selected roles. No role/status mutation
runs until Confirm change is explicitly selected; server rejection stays in the
confirmation, and the editor choices remain available on cancel.

## Single-role account contract

Each account has exactly one role from Customer, Courier, Merchant, Dispatcher
or Admin. The v1 `roles` field remains a singleton enum array for compatibility;
empty/multiple/unknown roles are rejected before establishing a session. The
role editor replaces one value through a dropdown; navigation must never union
permissions across role assignments. Previously described combined-role examples
are superseded by this contract. Multiple actor roles in historical audit records
remain immutable snapshots, not current account permissions.

Admin POST /api/v1/users accepts an optional role enum name (defaults to Customer)
for tab-aware account creation. It is Admin-only and assigns exactly one role
atomically. Public registration continues to assign Customer unconditionally.
