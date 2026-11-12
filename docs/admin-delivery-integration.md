# Delivery administration integration

Work branch: `fix/admin-delivery-integration`, based on `dev`.
Reviewed and incorporated `origin/feat/admin-delivery-config-reports(f)`
(`84f9278`) while preserving its source branch and existing application routes.

The Admin sidebar now links to zones, pricing and delivery reports. Route modules
delegate to feature pages. Application controls and surfaces use shared shadcn/ui
components and semantic Tailwind utilities; no custom CSS was added.

The API adapter uses the existing authenticated transport and configured API
base. Failed requests never generate successful placeholder responses, invented
catalogs or report figures. Responses are validated against their contracts;
mutation requests carry the persisted concurrency version and are not replayed.
Query keys include the signed-in user and queries wait for an authorized session.
Save errors remain visible inside the open configuration dialog.

Validation: `npm run check` passes formatting, lint, type checking, all 252 tests
and the production build. Production-browser checks render all three pages at
390px and 1280px without horizontal overflow or page errors, using isolated API
fixtures. Transport tests cover unauthorized, forbidden, conflict, unavailable,
network and malformed-response failures without fabricated success.

The corresponding backend change provides real storage, authorization, audit
records, concurrency checks and an additive migration. Existing Google sign-in,
Identity session behavior and merchant approval routes are preserved.

The integration is committed and merged into `dev`. Source and integration
branches are removed after the remote merge is verified.
