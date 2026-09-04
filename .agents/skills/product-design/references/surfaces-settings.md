> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: settings / profile

## Load when

Account, PIN, seller preferences after first run, or new account-level options.

## Canonical owner

Profile mode in [AppHome.tsx](../../../../src/components/AppHome.tsx): eyebrow “Account”, title “Profile”, compact `SellerOnboarding`, [MarketplaceAccountsCard](../../../../src/components/MarketplaceAccountsCard.tsx), `PinSetupCard`, Sign out. Admin tools are in the admin bar, not Profile.

## Stable rules

### rule/settings-are-account-not-product-config

- **Scope:** `/app` profile
- **Rule:** Profile holds identity (email), closet defaults that flow into listings, linked Mercari/Poshmark closets, PIN, and sign out. Do not put listing-photo tools or marketplace field editors here.
- **Rationale:** Listing work lives on the hub. Profile is closet + account.
- **Evidence:** AppHome profile sections.
- **Exceptions:** None.
- **Bad:** A settings page of feature flags and theme pickers.
- **Good:** “Seller preferences” + “Linked closets” + “Your PIN” + “Sign out”.

### rule/admin-is-opt-in-chrome

- **Scope:** `isAdmin` / `ADMIN_EMAILS`
- **Rule:** Sellers never see admin navigation. Admins get a sticky top bar (AI Photo Lab, Users) on every page — not a seller sidebar, and not the visual focus of Profile.
- **Evidence:** `AdminBar` in root layout; Profile no longer hosts the lab well.
- **Exceptions:** Listing hub **More** may still deep-link AI Photo Lab for the current listing.
- **Bad:** Admin nav item for every user.
- **Good:** Admin-only top bar; listing-specific lab link under More.

## Good patterns

- Sign out is `BigButton variant="ghost"` at the bottom — available, not tempting.
- Linked closets sit after seller preferences: Find my closet (Chrome helper + confirm), optional paste, Check listings, Open closet. Live marketplace listings are a Profile list, not a second home dashboard.
- Chrome helper install is on Profile: Chrome Web Store when `NEXT_PUBLIC_CHROME_WEB_STORE_ID` is set, otherwise the zip + Load unpacked steps. Privacy is linked from Profile and sign-in.

## Bad patterns

- Dark-mode toggle (product is paper-themed; no theme switcher exists).
- Notification preference grids.

## Coverage gaps

- Profile is not a URL; refresh loses profile mode. Unsettled whether that should change.
