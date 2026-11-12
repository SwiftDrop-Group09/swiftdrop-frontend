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
