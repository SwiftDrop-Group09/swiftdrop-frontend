# Frontend agent instructions

These instructions apply to the entire frontend repository. Read
`CONTRIBUTING.md`, `components.json` and the relevant feature documentation before
making changes. The default integration branch is `dev`.

## UI components

- Use **shadcn/ui only** for application controls and surfaces: buttons, inputs,
  forms, selects, dialogs, cards, tables, alerts and navigation.
- Import shared components from `~/shared/components/ui`. Reuse existing
  components first; add missing shadcn components using the repository's
  `components.json` configuration and aliases.
- Do not create competing custom UI primitives, hand-style native controls, or
  introduce another UI component library. Feature components should compose
  shadcn components while preserving application behavior.
- Use Tailwind utility classes for layout, spacing and responsive composition.
  Use semantic shadcn tokens such as `bg-background`, `text-foreground`,
  `text-muted-foreground` and `border-input` instead of hardcoded colors.

## No custom CSS

- Do not add or extend feature/component stylesheets, CSS modules, custom CSS
  selectors, CSS-in-JS, styled components or inline styles for feature styling.
- Keep `app/styles/app.css` limited to the Tailwind/shadcn imports, theme tokens
  and standard base setup. Do not hide custom component rules in that file.
- Existing legacy CSS is not permission to add more. When changing a component
  that uses it, replace its custom rules with shadcn components and equivalent
  Tailwind utilities while retaining behavior, focus and responsive support.
- Keep Google's own inline sign-in control. Use supported SDK options for its
  appearance and Tailwind utilities for its host layout; do not add custom CSS
  exceptions, imitate the provider button or introduce another sign-in dialog.
- Preserve functional native surfaces such as the signature canvas; compose
  their surrounding UI and actions with shadcn components.

## Workspace design system

- Compose authenticated page layouts with `WorkspacePage` from
  `~/shared/components/workspace-page`. Use one page heading (`text-xl sm:text-2xl`) and its responsive actions slot. Do not render a subtitle
  or description directly below workspace page titles. Keep operational guidance
  in the relevant content card. Keep domain-specific actions and validation in
  the owning feature. Do not add role-name badges above page headings.
- Fill the available width beside the sidebar: `w-full min-w-0`, without a fixed
  page-width cap. Readable text, dialogs, provider controls and printable documents
  may have appropriate width limits. Stack headings/actions on small screens.
- Use the shared shell breadcrumbs and footer account dropdown. Do not add
  competing role navigation bars, duplicate profile links or feature logout buttons.
- Use consistent spacing: page/content gaps of 6, card padding `p-4 sm:p-6`, form
  gaps of 4 or 5, action gaps of 2. Use responsive form/card grids; tables scroll
  inside their cards instead of expanding the page. Align table actions with their
  heading and keep focus indicators visible.
- Use the shared `ReportPeriod` popover for report/dashboard date filters in the
  header actions. Keep period-based KPI values distinct from current operational
  snapshots; label their time scope and never infer comparisons from missing data.
- Compose charts with the shared shadcn Chart primitives. Use the shared
  `--chart-*` tokens for SwiftDrop's red palette in both themes; retain legends,
  tooltips and numeric context so values are not communicated by colour alone.
- Keep cards, buttons, fields and badges flat. Use borders and semantic theme
  tokens for hierarchy; reserve elevation for floating dialogs, sheets and menus.
- Support Light, Dark and Device appearance through the shared profile-menu theme
  controls. Use semantic theme tokens, preserve the saved browser preference and
  respond to device appearance changes when Device is selected.
- Reuse `WorkspaceLoading` and `WorkspaceNotice` for data loading, empty, error
  and safe read-retry states. Never display invented data or successful zero totals
  when a request failed. Never replay a mutation as a generic retry.
- Enforce route roles before mounting private query components. Include the
  authenticated user in private query keys. Customer data must not be requested
  for Courier, Merchant, Dispatcher or Admin-only dashboards. Each user has exactly one enum role; never union permissions or navigation
  across role assignments. Keep the v1 `roles` array restricted to one value; API ownership checks remain
  authoritative. Business registration navigation is Customer-only; the merchant portal
  allows Customer applicants and Merchant owners, and blocks other roles before queries mount; merchant tools additionally require approved ownership.
- Enable navigation only for implemented routes backed by real contracts. Record
  missing backend APIs in integration documentation; do not fabricate endpoint
  paths, statistics, assignments or merchant orders to complete a visual layout.

## Behavior and verification

- Preserve authentication, authorization, validation, accessibility, loading and
  error states, session isolation and idempotent retry behavior.
- Keep domain logic in features and backend contracts authoritative. Shared UI
  must not depend on feature modules. Keep the application SPA-safe.
- Use the Node/npm versions declared by `.nvmrc` and `package.json`. For code
  changes, run `npm run check` and relevant browser checks for changed layouts
  or interactions. For documentation-only changes, check formatting and the diff.
- Never commit secrets, local environment files, dependencies or generated output.
  Preserve unrelated work and commit or push only when requested.
