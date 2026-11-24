# SwiftDrop Web Frontend

The SwiftDrop web app supports public parcel tracking and authenticated workspaces for customers, merchants, couriers, dispatchers, and administrators. It is a React and TypeScript single-page application built with React Router, Vite, Tailwind CSS, shadcn/ui, and TanStack Query.

## Workspaces

| Workspace     | Main workflows                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Public        | Sign in, register, and track by public tracking number.                                                   |
| Customer      | Get a quote, confirm a booking, track parcels, view history and receipts, and use the delivery assistant. |
| Courier       | Review assignments, update delivery status, submit proof, report failures, and view completed work.       |
| Dispatcher    | Review parcels and workload, assign couriers, and view zone summaries.                                    |
| Merchant      | Apply for access and, once approved, manage orders and webhooks.                                          |
| Administrator | Manage users and merchant approvals, configure zones and pricing, and view reports and audit activity.    |

## Run locally

Use the Node.js version in [.nvmrc](.nvmrc) and the npm version in [package.json](package.json). From this repository, run:

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. Start the gateway and backing services through the [shared development environment](https://github.com/SwiftDrop-Group09/swiftdrop-infra/blob/dev/README.md) to use live workflows. The shared Docker stack also runs the web app and exposes it at the same address.

Use [.env.example](.env.example) as the template for a local override.

| Variable                    | Purpose                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`         | Browser API base path. The default is `/api`.                                                      |
| `DEV_GATEWAY_TARGET`        | Vite proxy target for `/api` and `/graphql`. The default is `http://localhost:5000`.               |
| `VITE_GOOGLE_WEB_CLIENT_ID` | Optional public OAuth client ID. Configure the browser origin with Google before enabling sign-in. |

Vite exposes `VITE_*` values to the browser. Identity uses same-origin cookies and CSRF protection. Follow the [Identity integration guide](docs/identity-integration.md) when configuring the proxy and public origin.

## Project layout

| Path                               | Contents                                                    |
| ---------------------------------- | ----------------------------------------------------------- |
| `app/routes.ts` and `app/portals/` | Route registration and page modules by workspace.           |
| `app/features/`                    | Feature components, API calls, validation, and query hooks. |
| `app/shared/`                      | Shared UI, request transport, and utilities.                |
| `app/styles/app.css`               | Tailwind base styles and semantic theme tokens.             |

## Build and verify

```sh
npm run check
```

`npm run check` runs formatting, linting, type checking, tests, and a production build. Run `npm run build` followed by `npm run preview` to inspect the compiled SPA locally. The [Dockerfile](Dockerfile) packages `build/client` with Nginx for the shared container workflow.

See [Contributing](CONTRIBUTING.md) for development conventions and the [workspace navigation guide](docs/workspace-navigation.md) for role-specific routes. Feature handoffs cover the [customer delivery experience](docs/customer-delivery-experience.md), [courier workspace](docs/courier-workspace-experience.md), [dispatcher integration](docs/dispatcher-integration.md), and [admin delivery integration](docs/admin-delivery-integration.md).

## SwiftDrop repositories

| Repository                                                                   | Responsibility                                                          |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [Backend](https://github.com/SwiftDrop-Group09/swiftdrop-backend)            | Gateway, APIs, background workers, and integration contracts            |
| [Web frontend](https://github.com/SwiftDrop-Group09/swiftdrop-frontend)      | React web application and role-based workspaces                         |
| [Mobile app](https://github.com/SwiftDrop-Group09/swiftdrop-mobile)          | Flutter application for customers and couriers                          |
| [Infrastructure](https://github.com/SwiftDrop-Group09/swiftdrop-infra)       | Local development, Docker Compose, and Kubernetes deployment            |
| [Project documentation](https://github.com/SwiftDrop-Group09/swiftdrop-docs) | Requirements, architecture, integration design, and assessment evidence |
