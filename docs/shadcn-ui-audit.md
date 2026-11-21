# Application UI audit

The UI audit on 12 November 2026 replaced the remaining native merchant scope
and webhook subscription checkboxes with shared shadcn Checkbox and Label
components. Account role controls, booking and courier action groups use shadcn
FieldSet and FieldLegend while retaining disabled-state behavior.

Custom bordered panels in account connections, administrator confirmations,
merchant configuration, tracking progress and empty states now compose shadcn
Card. Receipt summaries and webhook secret panels use Card, and profile initials
use shadcn Avatar. Tracking links retain full-card keyboard and pointer access. Controls,
dialogs, tables, badges, alerts and sidebar navigation use shared shadcn
components. Domain-specific feature components compose those primitives.

Google Identity Services still renders its own sign-in control, as required by
the authentication integration. Its legacy host stylesheet is removed; Tailwind
utilities provide layout, focus indication and disabled appearance. The signature
canvas remains native so drawing and proof capture keep working. Images,
semantic content, layout containers and the requested text wordmark also remain
ordinary markup; they do not introduce competing application controls.

No feature stylesheets or inline feature styles remain. The global stylesheet
contains the Tailwind/shadcn theme and base setup. This work retains the existing
sidebar account menu and wordmark changes on `feat/sidebar-account-menu`.
