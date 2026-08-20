> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: settings / profile

## Load when

Account, PIN, seller preferences after first run, or new account-level options.

## Canonical owner

Profile mode in [AppHome.tsx](../../../../src/components/AppHome.tsx): eyebrow “Account”, title “Profile”, compact `SellerOnboarding`, `PinSetupCard`, optional admin dashed well, Sign out.

## Stable rules

### rule/settings-are-account-not-product-config

- **Scope:** `/app` profile
- **Rule:** Profile holds identity (email), closet defaults that flow into listings, PIN, and sign out. Do not put listing-photo tools or marketplace field editors here.
- **Rationale:** Listing work lives on the hub. Profile is closet + account.
- **Evidence:** AppHome profile sections.
- **Exceptions:** Admin link to AI Photo Lab (dashed, secondary).
- **Bad:** A settings page of feature flags and theme pickers.
- **Good:** “Seller preferences” + “Your PIN” + “Sign out”.

### rule/admin-is-opt-in-chrome

- **Scope:** `isAdmin`
- **Rule:** Admin entry is a dashed muted well, not the visual focus of Profile.
- **Evidence:** “Open AI Photo Lab →”.
- **Exceptions:** None.
- **Bad:** Admin nav item for every user.

## Good patterns

- Sign out is `BigButton variant="ghost"` at the bottom — available, not tempting.
- PIN setup is collapsed until Set/Change PIN.

## Bad patterns

- Dark-mode toggle (product is paper-themed; no theme switcher exists).
- Notification preference grids.

## Coverage gaps

- Profile is not a URL; refresh loses profile mode. Unsettled whether that should change.
