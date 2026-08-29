> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: navigation

## Load when

Moving between home, listing hub, photos, profile, join, admin, or marketplace tabs.

## Canonical owner

No seller app shell. Each seller screen owns a text back link. Admins additionally get [AdminBar](../../../../src/components/AdminBar.tsx). Routes live under `src/app/`.

## Stable rules

### rule/back-is-text-link

- **Scope:** In-app movement
- **Rule:** Back/parent navigation is an accent text link (`text-base font-semibold text-[var(--accent)]`), often with a leading `←`, not a hamburger or persistent sidebar.
- **Evidence:** `← All listings`, `← Back`, `← Back to listing hub`, Profile button on home (bordered, because it is a destination not a back link).
- **Exceptions:** Primary forward actions use `BigButton`. External marketplace uses `window.open`. Admins get a sticky top bar (`AdminBar`) that is not seller chrome.
- **Bad:** Adding a global sidebar “for navigation”.
- **Good:** Hub sticky QR rail with `← All listings` above Phone Companion; admin bar only when `getAdminUser()` is set.

### rule/url-is-the-place

- **Scope:** Deep links
- **Rule:** Listing hub is `/app/listings/[id]`. Phone Companion is `/app/listings/[id]/photos?phone=1`. Join tokens are `/join/[token]`. Old `/review` and `/post` redirect to the hub — do not revive them as separate apps.
- **Rationale:** One listing, one hub.
- **Evidence:** `review/page.tsx` and `post/page.tsx` redirects.
- **Exceptions:** Admin lab `/app/admin/bg-lab` with `listingId` / `photoId` query. Admin users `/app/admin/users` with filter query params.

### rule/marketplace-is-external

- **Scope:** Posting
- **Rule:** Opening Mercari/Poshmark is an explicit action that leaves the app. Tell the seller to keep the listing open and use the extension helper. Do not iframe the marketplace.
- **Evidence:** Hub “Open {platform}” + status message about the green helper.

## Good patterns

- Profile is a mode on home, not a nested settings IA.
- QR join is a token URL, not a login wall, for the phone camera job.

## Bad patterns

- Breadcrumb trails of more than one parent.
- Tab bars that duplicate hub sections already on the page.

## Coverage gaps

- No documented standard for whether Profile should be a route (`/app/profile`) vs in-memory mode.
- Extension side panel navigation is separate from the Next app.
