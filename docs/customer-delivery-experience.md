# Customer delivery workspace

The Customer workspace uses the existing shadcn shell and controls. The owning
Delivery API remains authoritative for access, availability, quotes and documents.

## Routes and navigation

- `/dashboard` shows all-time owner totals, up to five active deliveries first
  and up to five recent terminal deliveries. These lists are not the source of
  the aggregate totals. Dashboard read failures never become zero totals.
- `/customer/history` is the Delivery history hub. Search, all eight delivery
  statuses, inclusive local booking dates and pagination live in the URL.
  Search applies on submission; changing a filter returns to page one.
  Desktop tables become delivery cards on narrow screens.
- `/customer/parcels/:id` contains Overview, Tracking and Documents tabs. View
  details and Documents actions carry an allowlisted origin in router state.
  Back returns to the dashboard, tracking hub or filtered history; a direct link
  falls back to Delivery history. Tab changes preserve the origin.
- `/customer/tracking` resolves tracking numbers through the owner-scoped list
  and opens workspace tracking. It does not disclose another owner's delivery.
  Anonymous `/track` remains the separate privacy-limited public view.
- Legacy `/customer/receipts` redirects to delivered history, and
  `/customer/parcels/:id/receipt` opens Documents. Existing `#pod` detail links
  also open Documents. Receipts and proof remain restricted to delivered
  owner records; no before-delivery documents are fabricated.

Receipt and proof metadata/images load only when Documents is opened. Receipt
PDF and print actions remain available. A missing proof attachment and a failed
document read have explicit states and safe read retries.

## Booking

The four steps are Pickup → Delivery & recipient → Parcel → Review & price.
Continue validates the current step; Back and review edits retain values.
Profile address and recipient shortcuts require explicit clicks. The free-text
profile address fills the pickup street only; city, postal code and service area
still require confirmation. The delivery address zone selects the tariff.

Only the review step requests a quote. Confirmation accepts the exact decimal
total and uses the existing retained idempotency body/key. Editing invalidates an
unsubmitted quote; expired or price-mismatched quotes require a new review.
Ambiguous confirmation outcomes preserve their original attempt and block edits.
No generic retry creates another booking. A successful booking offers View
delivery details and invalidates the owner's history and dashboard summary.

Draft fields stay only in the user-scoped in-memory QueryClient. They survive
component remounts, but not a browser reload or a cleared session. Leaving an
unfinished form offers Keep editing, Keep draft & leave, and Discard details &
leave in a shadcn confirmation; refreshing/closing uses the
browser's native unsaved-work prompt. Explicit discard clears draft fields while
retaining an uncertain confirmation for safe recovery. Sign-out is never blocked.
Logout, account and role changes clear private caches and retained attempts.

## Tracking and freshness

Owner details use SSE first, without a parallel polling interval. Initial or
repeated snapshots of an already cached version do not trigger duplicate reads.
A changed snapshot invalidates details, owner history and the dashboard summary.
A disconnected stream uses a four-second read fallback while reconnecting;
the first successful snapshot stops that interval. Fallback reads that discover
a changed version also invalidate the owner lists. Terminal deliveries stop live
tracking. Manual Refresh is always available, with plain-language connection
status in Tracking. Cached private reads stay in memory with 30-second freshness.

## Backend dependency and verification

Deploy the companion Delivery summary endpoint before the dashboard client:
`GET /api/v1/parcels/summary`. It accepts no query parameters and is Customer-only,
deriving ownership from verified claims. See the backend summary documentation.
No IAM changes, new persistent draft/address models or database migrations are
required. Private proof reads use the same PostgreSQL storage as proof writes.

Regression coverage includes origin/filter preservation, complete status filters,
invalid date ranges, lazy documents, safe booking retries, step validation,
explicit profile shortcuts, draft isolation, leave confirmation, SSE reconnection
and failure states. Browser checks cover responsive history, details and booking.

Validation on 15 November 2026: `npm run check` passed formatting, zero-warning
lint, TypeScript, all 615 tests in 40 files and the production build. The suite
used `VITEST_MAX_WORKERS=4` to avoid local worker-saturation timeouts. Production
Chromium checks passed at 320/390/768/1440px in light/dark themes, including
origin/filter preservation, lazy document reads and PDF download, legacy receipt
links, step validation, explicit profile shortcuts, leave confirmation and a
single explicit booking confirmation. These browser checks use isolated API
fixtures; they do not claim a live Google-consent or Neon booking transaction.
