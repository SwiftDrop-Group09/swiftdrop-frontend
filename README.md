# SwiftDrop frontend setup

Development setup only. No product screens, portal layouts, business features,
authentication implementation, mock identities, or example data are included.
The index route intentionally renders a blank page so frontend development can
start from a clean base.

## Start development

Tested with **Node 24.16.0 LTS and npm 11.13.0**. Select the Node version in
`.nvmrc` using your version manager. Run these commands from this repository:

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
  routes.ts                 Blank index and technical unknown-route fallback
  providers.tsx             TanStack Query provider with an isolated cache
  env.d.ts                  Types for public frontend environment variables
  portals/
    public/index.tsx        Blank starting route
    public/not-found.tsx    Minimal client-side 404 handling
    auth/                   Reserved for authentication screens
    customer/, courier/, merchant/, dispatcher/, admin/
                            Reserved for role-specific routes and layouts
  features/                 Reserved for shared business features
  shared/                   Reserved for general UI, transport, and utilities
  styles/app.css            Tailwind import; no product styling
  test/                     DOM test setup and provider cache-isolation test
.github/                    CI and pull-request template
scripts/preview.mjs         Static preview of build/client
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
`/api`, retaining its prefix, to `DEV_GATEWAY_TARGET`. The provisional default is
`http://localhost:5000`; no actual gateway port/configuration exists in the current
backend or infrastructure checkout. There are no API calls in this starter.

Project architecture describes YARP, Google OIDC, application JWTs, refresh
sessions, and SSE. Endpoint paths, role claim mappings, browser credential storage,
refresh behavior, and SSE authentication remain unspecified. Implement these from
approved backend contracts. Do not invent authentication endpoints or duplicate
backend authorization, pricing, approval, or parcel-transition rules.

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
