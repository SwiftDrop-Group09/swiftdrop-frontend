# Contributing

This repository includes the Identity screens and shared shadcn/ui components.
Preserve existing authentication, validation and API behavior when changing UI.

Use Node from `.nvmrc`, npm, and the single root lockfile. Install with `npm ci`.
See [README.md](README.md) for commands, configuration, and source boundaries.

- Add route modules under the appropriate `app/portals/` directory and register
  them in `app/routes.ts`. Replace `.gitkeep` files when directories gain content.
- Put domain logic, endpoint functions, validation, and Query hooks in features.
  Put general components, native-fetch transport, and utilities in shared code.
  Portals must not import other portals; shared code must not depend on portals.
- Use shadcn/ui from `app/shared/components/ui` for application controls and
  surfaces. Use Tailwind utilities for layout and semantic theme tokens from
  `app/styles/app.css`; avoid hardcoded colors or a second global CSS component
  layer. Google Identity Services renders its sign-in control directly. The only
  component CSS exception is `google-button.css` for the provider host layout and
  focus ring. Use SDK options for its appearance; preserve the ID-token/nonce flow.
- Keep one application build. Use `~/` for source imports. Retain strict types,
  type-aware linting, framework route splitting, and SPA-safe initial rendering.
- Obtain DTOs, permissions, authentication, and state transitions from the owning
  backend contract. Keep backend business rules authoritative.
- Use TanStack Query for server data and mutations, with scoped query keys and
  invalidation. Clear private cached data when implementing session changes.
- Add focused behavior tests for changed interactions, including keyboard use,
  confirmation and controlled form state. jsdom's ResizeObserver stub supports
  Radix measurement; browser checks still establish real layout behavior.
- Never commit secrets, local environment files, dependencies, or generated
  output. Commit the lockfile when dependencies change.

Run `npm run check` before requesting review. As screens are added, verify their
keyboard access, labels, focus, errors, and responsive layouts. Hosting changes
should preserve nested-route fallback, missing-asset 404s, and API isolation.
Report verification limits in the pull request template.

Project-wide decisions belong in the
[documentation repository](https://github.com/SwiftDrop-Group09/swiftdrop-docs).
Keep notes here specific to frontend setup and implementation.
