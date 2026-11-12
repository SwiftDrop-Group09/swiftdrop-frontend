# Admin workspace shell

Branch: `feat/admin-workspace-shell`.

Users, merchant approvals, delivery zones, pricing tiers and delivery reports
share the same page composition. `WorkspacePage` provides a reusable title,
description, responsive action area, separator and content region. Admin pages
use `AdminWorkspace` to compose it. These components arrange shared shadcn
controls; they do not create a competing UI primitive system.

The workspace fills the available width beside the sidebar, without a page-width
cap. Content and tables can use the full desktop workspace. Descriptions retain
a readable line length. Actions stack on small screens, tables scroll inside
their cards and the existing mobile sidebar/account menu remains available.

The sticky shell header uses shadcn Breadcrumb with the current admin screen.
There is no Administration badge above page titles. Existing page actions,
authorization, role navigation, forms, report export and request contracts are
preserved. No example metrics or additional API dependencies were introduced.

Cards and buttons use flat surfaces without decorative shadows. Floating dialogs
and menus retain their elevation so their interaction layer remains clear.

Page headings and actions align centrally on desktop and stack on mobile.
Cards use consistent responsive padding; user forms split into two columns when
space allows, password actions wrap with explicit gaps and table actions align
to their column heading. Merchant summary cards use two columns on mobile and
four on wide desktop layouts.

`WorkspaceLoading` and `WorkspaceNotice` compose Skeleton, Alert and Button for
consistent loading, empty and retry states. Zone/pricing read failures display
an explicit retry action instead of appearing as an empty table. A retry only
refetches data; it does not replay configuration mutations.

No custom CSS or inline feature styling is added. This change is frontend-only
and remains uncommitted until requested.
