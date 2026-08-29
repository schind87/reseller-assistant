> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: admin chrome and users

## Load when

Admin bar, AI Photo Lab, or `/app/admin/users`.

## Canonical owner

- Sticky admin bar: [AdminBar.tsx](../../../../src/components/AdminBar.tsx) in [layout.tsx](../../../../src/app/layout.tsx)
- Users: [AdminUsersConsole.tsx](../../../../src/components/AdminUsersConsole.tsx)
- AI Photo Lab: [AiBgDebugConsole.tsx](../../../../src/components/AiBgDebugConsole.tsx)

## Stable rules

### rule/admin-bar-is-admin-only-chrome

- **Status:** accepted
- **Scope:** Signed-in `ADMIN_EMAILS`
- **Rule:** Admins get a sticky top bar on every page with **AI Photo Lab** and **Users**. Sellers never see it. It is not a global seller navbar or sidebar.
- **Rationale:** Admins asked for the lab at the top of every page; Users is the other admin destination.
- **Evidence:** `getAdminUser()` in root layout; `AdminBar` links.
- **Exceptions:** Join-only phone sessions have no email, so no bar.
- **Bad:** A persistent app shell for every seller.
- **Good:** Thin muted bar, accent text links, `aria-label="Admin"`.

### rule/admin-users-is-a-list-not-a-dashboard

- **Status:** accepted
- **Scope:** `/app/admin/users`
- **Rule:** Users is a filterable list of sellers (and unowned listings). Stats are one muted summary line. Do not add a KPI card grid or data table.
- **Rationale:** Same list-row object pattern as home listings; admin density may add filters.
- **Evidence:** `AdminUsersConsole` rows + `formatAdminUserSummary`.
- **Exceptions:** None.
- **Bad:** Four metric tiles above a spreadsheet.
- **Good:** “8 users · 21 listings (12 Mercari, 9 Poshmark) · 4 posted” then bounded rows.

## Good patterns

- Filters live in the URL (`q`, `platform`, `job`, `listings`, `pin`, `prefs`).
- Destructive commands name the user or listing and use native confirm; no fake undo.
- Opening another seller’s listing hub is allowed for admins (`authorizeListingAccess`).

## Bad patterns

- Copying AI Photo Lab’s dense controls onto seller screens.
- Impersonation / “sign in as this user”.
