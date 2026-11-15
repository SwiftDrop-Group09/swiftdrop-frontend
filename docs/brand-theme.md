# Brand and neutral action tokens

Ordinary controls use shadcn's neutral `primary`: near-black in Light and
near-white in Dark, with contrasting `primary-foreground`. Buttons, links and
other actions use the normal component variants and semantic tokens. This
separates ordinary actions from red failure and warning states.

The single `:root --brand-primary` value in `app/styles/app.css` controls the
red logo artwork, generated favicon, destructive states and red chart shades.
These colors remain independent of the neutral primary action palette. Change
that one brand value to recolor brand artwork and its derived shades.

`BrandLogo` uses the existing brand token through Tailwind; this is a brand
artwork exception. Other feature UI uses `primary`, `destructive`, `muted`,
`border` and `chart-*` tokens. Do not introduce independent red/rose literals,
feature CSS or a second component palette. Native signature/proof surfaces retain
their necessary white background.

Vite generates `/favicon.svg` in development and production from the same brand
value using `createBrandFavicon`. Do not add a separately colored static favicon.
The neutral Drop text remains foreground-colored in the UI and black in the
favicon. Device theme follows the system through the shared switch.

Browser verification covers neutral primary controls in both themes, red brand
artwork/destructive states, generated favicon consistency, priority-card contrast
and responsive Courier flows.
