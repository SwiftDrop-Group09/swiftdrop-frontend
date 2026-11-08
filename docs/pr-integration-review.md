# PR integration review - 9 November 2026

All reviewed UI and Customer booking work is integrated from dev. The Courier
workspace uses the shared shadcn sidebar, cards, alerts, badges, labels, inputs,
textarea, checkbox, native select and buttons. The feature stylesheet, old theme
and duplicate Courier navigation were removed. Existing request/validation,
proof capture, retry/idempotency and session/account isolation remain intact.
The only feature CSS is the scoped host for Google's own inline SDK control.

Customer booking and Courier manifest/history navigation link to actual routes;
unimplemented capabilities remain disabled. Customer and Courier role checks
remain separate; Admin does not inherit operational Courier actions.

Validation: npm run check passed formatting, lint, strict types, all 199 tests and
the production SPA build. Chromium at 390px and 320px passed real fixture
manifest/detail/history, proof validation/signature capture, responsive sidebar
navigation and no horizontal overflow/page errors. React plus Dart HTTP adapters
verified five parcels ending in two Delivered and three Failed, with two proofs,
27 history/outbox rows and ten replay rows; cleanup succeeded. Identity is an
explicit browser-only fixture and proof storage is private in-memory for those
checks. Live JWT/bucket/provider consent and native-device checks are not claimed.

The Linux frontend image was built and its SPA deep links/missing assets checked
during integration. Full shared-stack readiness still depends on owning-service
configuration and the separate Delivery/Merchant human-token adapters.
