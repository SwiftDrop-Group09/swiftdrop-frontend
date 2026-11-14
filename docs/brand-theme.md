# Brand color and shadcn tokens

Change the single `:root --brand-primary` value in `app/styles/app.css` to change
SwiftDrop's brand color. It currently uses `#dc2626`. Concrete CSS hex, named,
RGB/HSL or OKLCH colors are supported.

Components use existing shadcn tokens: `text-primary`, `bg-primary` and
`border-primary` for brand decoration and the text logo; `destructive` for
failure states; `chart-1` through `chart-5` for chart series. Opacity utilities
provide subtle backgrounds and borders. Do not introduce independent red/rose
palette classes or brand-specific component tokens.

The one underlying base variable is needed to derive both light and dark primary
colors without duplicating an editable color. Light mode uses the base directly;
dark mode lightens it with `color-mix`. Primary foregrounds retain contrast in
each theme. Destructive colors and chart shades derive from the themed primary.
Changing the base therefore updates the logo, controls, accents, status/error
styles and chart palette together while retaining their semantic shadcn names.

Vite serves `/favicon.svg` from the same base during development and emits it
into the production build. A normal page refresh requests the current favicon
after editing the theme; rebuilding produces the updated production asset.
There is no separately maintained `public/favicon.svg` color. The wordmark's
neutral text remains foreground-colored in the UI and black on the favicon.

`allowImportingTsExtensions` permits the native-compatible `.ts` import used by
the Vite configuration; it does not change application output or route behavior.

Validated on 15 November 2026 with all 627 frontend tests, the production build
and browser checks in both themes. Replacing only the base with an alternate blue
updated the logo, primary controls, accents, destructive color and all five chart
shades; the neutral wordmark stayed unchanged. Primary control text contrast
exceeded 4.5:1 for both tested colors/themes. Development and production favicon
generation and responsive Customer workflows were also checked with isolated APIs.
