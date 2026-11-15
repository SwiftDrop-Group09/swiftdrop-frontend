# Courier workspace experience

Implemented on `feat/courier-workspace-experience`, 15 November 2026.

## Pages and interaction

- `/dashboard` mounts the Courier day's-work dashboard only for a Courier.
  Real service-day totals come from `/couriers/me/summary`, with separate overdue
  work, delivered/failed outcomes and resolved-work progress. Day-card links keep
  the service date and exclude overdue work; the overdue card opens that queue.
- `/courier` uses status tabs with server counts, service date, tracking search,
  Include overdue and Overdue only controls. Filters and page persist in the URL.
  Search replaces its URL entry rather than adding one browser-history entry per
  keystroke. Filters run on the server before pagination.
- `/courier/parcels/:id` restores the originating queue on Back, with `/courier`
  as the direct-link fallback. Pickup is the next stop for Assigned work;
  subsequent work prioritizes delivery. Route, recipient telephone action,
  package facts, milestones and real status history remain available.
- One prominent next-stage action opens a short confirmation with an optional note.
  Failure is a separate dialog with canonical reason and optional internal note.
  Completion guides Recipient → Proof → Review before the existing multipart
  proof endpoint. Photo/signature previews use temporary blob URLs which are
  revoked on removal/unmount; proof is never stored in browser storage.
- `/courier/history` separates Delivered/Failed outcomes and supports service-date
  and tracking filters. Each history card opens a compact lazy-loaded dialog with route cities, package
  facts, service/assignment/pickup/completion dates, canonical failure reason and
  proof-recorded flag. Full recipient/address/proof details remain private after
  the assignment closes.

Uncertain writes retain the original immutable body/files/version/key in the
existing `CourierWorkflow`. Other actions and dialog dismissal remain paused.
An explicit original-request retry is available inside the open dialog as well
as the workspace banner. There is no automatic mutation retry or new-key replay.

All new surfaces/controls compose shared shadcn components. Layout uses Tailwind
and semantic `primary`, `muted`, `border` and `destructive` tokens. The native
signature canvas remains a functional input. No feature CSS or new color tokens
are introduced. The shared shell and other roles retain their existing layouts.

## Customer and Merchant failure visibility

Owner-authorized Customer detail/tracking displays readable canonical failure
reason and timestamp. No recipient phone/email/address becomes an ownership link.

The existing Merchant orders/dashboard patch from teammate PR #16 is integrated
on this feature branch, without merging that PR or changing `dev`. Its business
approval guards and read-only order workflow are retained. Registration is limited
to Customer applicants and Merchant owners; orders/overview/webhooks remain
Merchant-only before private queries mount.

Merchant Orders has a dedicated delivery-status filter, distinct from inbox
processing state. Failed parcel detail shows reason/time and last-refreshed time;
internal Courier notes never enter the Merchant API projection. Int64 parcel
versions are preserved before floating-point conversion. Order submission remains
the business's scoped API integration, with no invented web order-creation form.

Backend configuration, additive migrations and remaining event/webhook delivery
boundary are documented in
[Courier backend implementation](../../swiftdrop-backend/docs/courier-workspace-experience.md).
Polling supplies current order state; it cannot recover every intermediate event
or replace an operational outbox/consumer/webhook pipeline.

## Verification

`npm run check` covers formatting, lint, type checking, tests and production build.
Browser checks use isolated API fixtures at 320, 390, 768 and 1440 pixels in light
and dark themes. They exercise queue return, status dialogs, multipart proof,
failure, terminal privacy and Customer/Merchant failure displays. These checks do
not use live Google sign-in, project accounts or Neon databases.

Verified results: 705 frontend tests in 46 files; production build, lint and type
checks pass. Backend solution: 2,084 passing tests (Delivery 1,217, Merchant 383,
Identity 409, Gateway 70, Notification 5), zero build warnings/errors. The infra
runner's 21 isolated tests pass, including service-secret isolation.

## Follow-up refinements

Ordinary shadcn controls now use neutral primary (near-black in Light, near-white
in Dark). Logo/favicons, chart shades and destructive states retain their existing
red brand token. Priority dashboard queues (overdue, out for delivery, pickups)
are separated from the subdued day overview; Open queue actions use ghost buttons.
Include overdue is a prominent pressed-state button with an unfiltered workload
count. Excluding overdue work displays a clear notice and a View overdue work
action. Route separators use a Lucide arrow instead of an encoding-sensitive glyph.
