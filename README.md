# SwiftDrop frontend setup

SwiftDrop's shared React application on `dev` includes Customer/Admin Identity
screens, Customer booking and the Courier manifest, details, delivery actions,
proof and history. See [Identity integration](docs/identity-integration.md) and
[Courier integration](docs/courier-integration.md) for contracts, recovery behavior
and external verification limits. [PR review](docs/pr-integration-review.md)
records the combined integration checks.

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
development server (normally `http://localhost:5173`). Account API calls require
the configured Identity backend and browser origin/proxy setup in the handoff.

## Included dependencies

The UI uses shadcn/ui's Radix **new-york** components, Tailwind CSS v4 and a
single neutral token theme in `app/styles/app.css`. The login, registration,
dashboard, profile and Admin screens use the same shared primitives. Legacy
Identity CSS overrides and the separate theme file have been removed. Session,
API, validation and Query code remain the existing application foundations.

Components are source files owned by this repository, rather than a standalone
runtime UI framework. Keep Radix, Tailwind, CVA, clsx, tailwind-merge and Lucide:
they support the shadcn components. Login and registration adapt the official
`login-02` and `signup-02` split layouts. Their stock photographs are served
locally; see [photo credits and licenses](public/images/auth/CREDITS.md).

Successful local or Google sign-in opens `/dashboard`. Registration confirms the
password locally, creates the account, then signs in through the existing API.
If that sign-in fails after account creation, the page offers a sign-in link
without repeating registration. The dashboard adapts `dashboard-01` with only
its responsive sidebar, header and empty main workspace. Profile and authorized
Admin pages share that shell; demonstration charts and data are omitted.
Role menus follow the SRS and authorization rules for Customer, Courier, Merchant,
Dispatcher and Admin. See [workspace navigation](docs/workspace-navigation.md)
for the requirement mapping and current destinations. Screens not yet implemented
appear as disabled items marked Soon.

Opening `/` waits for session restoration, then redirects to `/dashboard` for an
authenticated session or `/login` for a signed-out visitor. Create account opens
`/register`; `/signup` is also supported as an alias. Authenticated visitors to
login or signup return to the dashboard. The former account landing card has
been removed.

The profile page has role-aware account information, editable personal contact
details with save/reset, and a server-backed sign-in methods card. Password
accounts can connect Google; Google-only accounts can add a password after Google
confirmation. Both methods retain the same account and assigned roles. Rebuild
Identity with the [connection endpoints](../swiftdrop-backend/docs/account-connections.md)
alongside this frontend; no new secret or database migration is needed.

Google's official sign-in control renders directly in the auth form. Supported
SDK options set its outline theme, rectangular shape and responsive width; scoped
CSS in `google-button.css` aligns its host and focus ring with the shared theme.
The Google iframe retains its own branding. The ID-token and server nonce flow
is unchanged, and there is no application dialog before provider consent.

Add another component from this directory using the existing `components.json`:

```powershell
npx shadcn@latest add separator
```

Review generated changes and run `npm run check`. Import from
`~/shared/components/ui/...`, compose feature layouts with utilities, and change
theme colors in `app/styles/app.css`. See the official
[React Router setup](https://ui.shadcn.com/docs/installation/react-router).

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
  routes.ts                 Account routes and technical unknown-route fallback
  providers.tsx             TanStack Query provider with an isolated cache
  env.d.ts                  Types for public frontend environment variables
  portals/
    public/index.tsx        Session-aware login/dashboard redirect
    public/not-found.tsx    Minimal client-side 404 handling
    auth/                   Login and Customer registration routes
    customer/dashboard.tsx  Authenticated landing shell
    customer/profile.tsx    Shared self-profile route
    admin/users.tsx         Admin users and audit route
    courier/, merchant/, dispatcher/
                            Reserved for independently owned product routes
  features/identity/        Shared session, API, validation, screens and tests
  shared/                   shadcn UI, hooks, transport, and utilities
  styles/app.css            Tailwind, shadcn theme tokens and base styles
  test/                     DOM test setup and provider cache-isolation test
.github/                    CI and pull-request template
scripts/preview.mjs         Static preview of build/client
public/favicon.ico          Neutral transparent browser favicon
public/images/auth/         Local stock photos and license credits
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
instances; Identity tests cover API, session and screen behavior. GitHub Actions
runs `npm ci` and `npm run check` on pull requests and pushes to the repository's
default branch, `dev`, using `.nvmrc` and read-only permissions.

## Environment and backend integration

`.env.example` contains only public configuration. Local environment files,
dependencies, generated route types, build output, coverage, caches, and logs are
ignored. Never put secrets in `VITE_*` values: Vite normally embeds them at build
time, and container environment changes do not reconfigure a built browser app.

The browser API base is prepared as `VITE_API_BASE_URL=/api`. Development proxies
`/api` and `/graphql`, retaining their paths, to `DEV_GATEWAY_TARGET`, whose
default is `http://localhost:5000`. In the shared container workflow, the
frontend Nginx container proxies these paths to the Gateway.
The Identity feature uses the actual versioned backend contract and same-origin
cookie/CSRF transport. Configure the public Google Web client ID when enabling
Google sign-in. Follow the [integration handoff](docs/identity-integration.md)
before claiming deployed TLS/cookie or real Google sign-in verification. Other
features must reuse the authenticated request seam and server-side authorization.

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
connections to YARP and other requests to the frontend. The container proxies API requests to the Gateway service. TLS, SSE buffering/timeouts, and orchestration belong in infrastructure.

Docker build and SPA deep-link/missing-asset checks passed against a local Linux daemon during the PR integration review.

## References

- [Project documentation](https://github.com/SwiftDrop-Group09/swiftdrop-docs)
  and sibling `swiftdrop-docs` for current local architecture decisions.
- [React Router SPA setup](https://reactrouter.com/how-to/spa)
  and [route type generation](https://reactrouter.com/how-to/route-module-type-safety).
- [Tailwind Vite integration](https://tailwindcss.com/docs/installation/using-vite).
- [CONTRIBUTING.md](CONTRIBUTING.md) for frontend development conventions.

## Customer booking

`/customer/book` uses the shared Identity session and dashboard shell. Customers load
active area IDs and names through `GET /api/v1/quotes/zones`, then request a quote
and explicitly confirm it. Price tokens retain exact decimal text; an uncertain
confirmation retains its original body and idempotency key while navigating in
the current session. Logout, account changes and role changes clear that state.
The feature uses shared shadcn controls and does not expose administrative zone
configuration. Empty/unavailable area catalogs block quoting with an explanation.

The isolated `npm run dev:booking-test` fixture is separate from production routing;
it does not provide application authentication.

## Courier workspace

Courier-only `/courier` lists current assignments with service-date and overdue
filters. `/courier/history` shows terminal summaries; assigned parcel details
provide private notes, status/failure actions, proof photo and signature capture.
Forms, filters, alerts, cards and actions compose shared shadcn components; the
feature stylesheet and duplicate navigation were removed. The signature canvas
retains its drawing behavior and uses shadcn actions. Requests retain the
existing concurrency, retry/idempotency and session-isolation guards.
Real JWT integration and private bucket acceptance remain backend prerequisites.
