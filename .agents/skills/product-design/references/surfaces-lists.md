> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: lists and photo grids

## Load when

Home listing list, hub photo sections, admin photo picker, admin users list.

## Canonical owner

- Listings: [AppHome.tsx](../../../../src/components/AppHome.tsx)
- Photos: photo section UI in [ListingHub.tsx](../../../../src/components/ListingHub.tsx)
- Admin users: [AdminUsersConsole.tsx](../../../../src/components/AdminUsersConsole.tsx)

There is no table component.

## Stable rules

### rule/list-row-is-the-object

- **Scope:** Home listings
- **Rule:** Each listing is one bounded row: thumbnail (platform aspect), title, marketplace + status, dangerous action separate from the open-link hit target.
- **Rationale:** The row is the listing object, not a dashboard card grid.
- **Evidence:** `AppHome` `<ul>` of `rounded-2xl border` rows; Delete is a sibling button with `aria-label={`Delete ${label}`}`.
- **Exceptions:** None.
- **Bad:** Four feature tiles per listing, or icon buttons without names.
- **Good:** Existing home list.

### rule/empty-names-next-action

- **Scope:** Empty lists
- **Rule:** Empty copy names the exact control to use next.
- **Evidence:** “No clothing listings yet. Tap Create new listing when you are ready.”
- **Exceptions:** Photo sections use dashed Add wells instead of a paragraph when empty — the well *is* the action.
- **Bad:** “Nothing here yet.” with no pointer.
- **Good:** Home empty copy; “Needs at least one photo first.” under Write listing with AI.

### rule/status-is-secondary

- **Scope:** Listing rows and hub eyebrow
- **Rule:** Show marketplace + status as muted/eyebrow text, not colored status pills for every state. Current code uses `status.replaceAll("_", " ")`.
- **Rationale:** Status is supporting information; the title and primary action matter more.
- **Evidence:** Home subtitle; hub eyebrow.
- **Exceptions:** None yet — pill language is a coverage gap, not a standard.

## Good patterns

- Thumb `object-contain` on muted well; “No photo” placeholder in small caps.
- Photo sections group by job (listing vs private brand/care vs stocking), not by a generic gallery.

## Bad patterns

- KPI summary above the list. Admin users may use one muted count line.
- Making every photo a heavy card with icon toolbars always visible at desktop density without a reason (hub shows actions on the photo — keep them labeled).

## Coverage gaps

- Listing status has no canonical display map (raw snake_case → spaces).
- No virtualization standard; not needed at current seller volumes.
