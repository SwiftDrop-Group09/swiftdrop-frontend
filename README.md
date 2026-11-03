# SwiftDrop frontend setup

React application foundation with the Phase 6 Customer quote and booking feature
at `/customer/book`. The public index remains blank. The normal booking route
requires a Customer session supplied by the application's IAM adapter; it does
not create a fictional user or implement login/token storage.

The Customer feature can be developed and verified independently using the
separate local integration test entry described below. Test identities and test
entry code are excluded from the normal application build.

## Start in the shared development environment

For routine iteration, developers may run the frontend and backend on the host
or use their Docker containers. Keep the three repositories side by side.
For host mode, install the pinned .NET SDK and Node/npm versions, then run
`npm ci` in this frontend repository. Start the services with:

```sh
./development/run.sh up --mode host
```

For Docker mode, start Docker and run:

```sh
./development/run.sh up --mode docker --build
```

Open `http://localhost:5173`. For a frontend-only Docker rebuild, use
`./development/run.sh up --mode docker --build web`. Docker build/start remains
required acceptance evidence before merging frontend/container changes; host
mode does not validate the image or Compose routing. See the
[shared infra guide](../swiftdrop-infra/README.md) for details.

## Frontend-only development

Tested with **Node 24.16.0 LTS and npm 11.13.0**. Select the Node version in
`.nvmrc` using your version manager. To work on the web server outside Compose:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

On POSIX shells, use `cp .env.example .env.local`. Open the URL printed by the
development server (normally `http://localhost:5173`). A blank page is expected.

## Included dependencies

| Area                 | Installed stack                                                              |
| -------------------- | ---------------------------------------------------------------------------- |
| Application          | React / React DOM 19.3.1, React Router 8.4.0 framework mode                  |
| Build and types      | Vite 8.3.4, TypeScript 6.0.3 with strict checking                            |
| Styling              | Tailwind CSS 4.3.3 and its Vite plugin                                       |
| Server state         | TanStack Query 5.104.3 with a root provider                                  |
| Forms and validation | React Hook Form 7.90.0, Zod 4.6.7, resolvers 5.9.1                           |
| Quality              | ESLint 10.12.0, typescript-eslint 8.71.2, React Hooks rules, Prettier 3.9.10 |
| Testing              | Vitest 5.0.5, React Testing Library, user-event, jest-dom, jsdom             |

One root `package.json`, npm lockfile, dependency tree, development server, and
production artifact serve the entire application. The lockfile records exact
resolved versions. The framework's Node adapter and `isbot` dependency support
its build-time root prerender; no production Node application server is required.

## Repository structure

```text
app/
  root.tsx                  Document, loading/error fallbacks, framework outlet
  routes.ts                 Public index, Customer booking and unknown-route fallback
  providers.tsx             TanStack Query provider with an isolated cache
  env.d.ts                  Types for public frontend environment variables
  portals/
    public/index.tsx        Blank starting route
    public/not-found.tsx    Minimal client-side 404 handling
    auth/                   Reserved for authentication screens
    customer/booking.tsx    Customer route, consuming injected session/client adapters
    courier/, merchant/, dispatcher/, admin/
                            Reserved for role-specific routes and layouts
  features/customer-booking/
                            Quote/confirmation UI, contracts, validation, exact JSON and tests
  shared/                   Reserved for general UI, transport, and utilities
  styles/app.css            Tailwind import; no product styling
  test/                     DOM test setup and provider cache-isolation test
.github/                    CI and pull-request template
scripts/preview.mjs         Static preview of build/client
test-harness/               Separate fictional-session integration entry; not a product route
public/favicon.ico          Neutral transparent browser favicon
Dockerfile, nginx.conf      Static container hosting
```

`.gitkeep` files retain intended empty source directories in Git; replace them
when adding real files. No feature scaffolds or placeholder workflows are present.
The favicon and plain-text unknown-route fallback avoid noisy unmatched development
requests without introducing product UI. Static SPA hosts still return the entry
HTML for extensionless routes; the browser router presents the 404 state.

Use the `~/` import alias consistently. Portal pages compose features. Features
own domain types, validation, API functions, and hooks. Shared code must not depend
on portals; avoid imports between different portals.

To add a screen, create its route module in the appropriate portal and register
it in `app/routes.ts`. Keep route modules separate to retain framework code
splitting. Type generation runs with both lint and typecheck, so a clean checkout
does not need a dev-server run first. For future data access, add native-fetch
transport in `app/shared/` and endpoint-specific functions in their features;
use Query hooks for reads, mutations, and invalidation.

## Quality commands

| Command                                   | Purpose                                               |
| ----------------------------------------- | ----------------------------------------------------- |
| `npm run dev`                             | Start the framework development server                |
| `npm run build`                           | Build the SPA into `build/client`                     |
| `npm run preview`                         | Serve the build on `127.0.0.1:4173`; `PORT` overrides |
| `npm run lint`                            | Generate route types and run type-aware ESLint        |
| `npm run typecheck`                       | Generate route types and run strict TypeScript        |
| `npm run format` / `npm run format:check` | Write/check formatting                                |
| `npm test` / `npm run test:ci`            | Watch / noninteractive tests                          |
| `npm run check`                           | Formatting, lint, types, tests, production build      |

The infrastructure test verifies Query cache isolation between application
instances; feature tests should be added alongside implementation. GitHub Actions
runs `npm ci` and `npm run check` on pull requests and pushes to the repository's
confirmed default branch, `main`, using `.nvmrc` and read-only permissions.

## Environment and backend integration

`.env.example` contains only public configuration. Local environment files,
dependencies, generated route types, build output, coverage, caches, and logs are
ignored. Never put secrets in `VITE_*` values: Vite normally embeds them at build
time, and container environment changes do not reconfigure a built browser app.

The browser API base is prepared as `VITE_API_BASE_URL=/api`. Development proxies
`/api` and `/graphql`, retaining their paths, to `DEV_GATEWAY_TARGET`, whose
default is `http://localhost:5000`. In the shared container workflow, the
frontend Nginx container proxies these paths to the Gateway.
Customer booking uses the implemented Delivery quote/confirmation POST contracts.
The normal route is closed until an IAM/session adapter is supplied. The test
entry uses a separate loopback-only Delivery harness and disposable database.

Project architecture describes YARP, application JWTs, refresh sessions and SSE.
Real Identity integration remains a separate task. Booking consumes a session
snapshot, authenticated request adapter and eligible-zone provider; it owns no
login, refresh, token storage or backend authorization. Production zone selection
requires an approved Customer-usable source; the Admin zone route is not reused.

## Customer booking development and acceptance

`app/features/customer-booking` implements labelled pickup/delivery/recipient and
parcel fields, quote preview/decline, explicit confirmation, server-returned
tracking, validation, expiry and conflict/network recovery. React Hook Form/Zod
validate usability; Query provides owner-scoped data/mutations without automatic
mutation retries. All prices and tracking results come from Delivery.

The API codec retains numeric JSON tokens before binary floating-point decoding.
Large valid totals and exact decimal weights are never rounded through Number.
Confirmation sends only quoteId/acceptTotal and one retained Idempotency-Key.
An uncertain outcome retains its original owner/body/key, even after quote expiry;
only a definite quote_expired/price_mismatch permits a fresh preview/acceptance.
Session changes clear private UI/cache state and cannot display old responses.

The application's future IAM composition can wrap the route in
`BookingEnvironmentProvider`. It supplies a current session, authenticated
request function, zone catalog and owner-scoped pending-attempt store. The
feature's default store is memory-only. The host session must clear private
attempts when the principal changes. The normal route never enables test auth
from a URL, request header or environment flag.

For interactive development before IAM is ready:

1. Start the sibling backend's isolated booking harness (see its
   [Phase 6 assessment](../swiftdrop-backend/docs/delivery-phase-6-assessment.md)).
   Its default HTTP address is `http://127.0.0.1:5088`.
2. In this repository, run `npm run dev:booking-test` and open
   `http://127.0.0.1:5174`. It is a separate Vite entry with an explicit fictional
   fixture banner, server-selected Customer and delivery areas from that same
   disposable database. `BOOKING_TEST_TARGET` may override only a loopback URL.
3. Estimate, decline or explicitly confirm. The test entry keeps only validated
   owner/quote/amount/body/key metadata in tab sessionStorage for unknown-outcome
   reload recovery; it stores no credentials, address or recipient details.

The normal build remains `build/client`; the test entry is not registered in
React Router, imported by the production root or copied into that output.
The `/__test/booking-context` fixture endpoint is used only by the test entry.
It is not a Customer production zone/auth endpoint.

Focused tests cover exact transport and input boundaries, quote/decline,
confirmation, duplicate clicks, changed input and stale responses, definite
expiry/repricing, unknown outcomes after local expiry, retained attempts and
principal changes. Run `npm run check` for formatting, zero-warning lint, strict
types, all tests and the SPA production build. Browser fixture tests against
real PostgreSQL are separate from future real-JWT acceptance.

React Router is configured with `ssr: false`. It still prerenders the root at build
time: keep module initialization and initial rendering free of browser globals.
Runtime user data should be fetched in the browser. Builds need no backend or
authenticated session.

## Build and container hosting

```sh
npm run build
npm run preview
docker build -t swiftdrop-frontend .
docker run --rm -p 8080:8080 swiftdrop-frontend
```

The frontend-only image serves `build/client` using Nginx on port 8080. Nested
application routes use the SPA fallback. Missing assets return 404; `/api` returns
JSON 502 rather than HTML. Production ingress must route `/api` and future SSE
connections to YARP and other requests to the frontend. No upstream service names
are assumed. TLS, SSE buffering/timeouts, and orchestration belong in infrastructure.

Docker build/runtime verification requires a running Docker Linux daemon. It was
unavailable during setup; the container has not been verified locally.

## References

- [Project documentation](https://github.com/SwiftDrop-Group09/swiftdrop-docs)
  and sibling `swiftdrop-docs` for current local architecture decisions.
- [React Router SPA setup](https://reactrouter.com/how-to/spa)
  and [route type generation](https://reactrouter.com/how-to/route-module-type-safety).
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).
- [CONTRIBUTING.md](CONTRIBUTING.md) for frontend development conventions.
