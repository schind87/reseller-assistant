> Provenance: Surface routing follows Vercel’s published product-design
> architecture. Surfaces listed here were inventoried from this repository.
> This is not an official unpublished Vercel file.

# Surfaces

Routing index for product surfaces that materially exist in Reseller Assistant.

Load this file whenever UI work has a target screen, overlay, or flow. Then load only the matching `surfaces-*.md` files.

## Application map

| Surface | Canonical code | Reference |
| --- | --- | --- |
| Sign-in | [src/app/unlock/unlock-form.tsx](../../../../src/app/unlock/unlock-form.tsx) | [surfaces-forms.md](surfaces-forms.md) |
| Seller onboarding | [src/components/SellerOnboarding.tsx](../../../../src/components/SellerOnboarding.tsx) | [surfaces-onboarding.md](surfaces-onboarding.md) |
| Home / listing list | [src/components/AppHome.tsx](../../../../src/components/AppHome.tsx) | [surfaces-lists.md](surfaces-lists.md), [surfaces-navigation.md](surfaces-navigation.md) |
| Profile / account | `AppHome` profile mode + [PinSetupCard](../../../../src/components/PinSetupCard.tsx) | [surfaces-settings.md](surfaces-settings.md) |
| Listing hub | [src/components/ListingHub.tsx](../../../../src/components/ListingHub.tsx) | [surfaces-editors.md](surfaces-editors.md), [surfaces-lists.md](surfaces-lists.md) |
| Phone Companion | [src/components/PhotoCoach.tsx](../../../../src/components/PhotoCoach.tsx), [photos/page.tsx](../../../../src/app/app/listings/[id]/photos/page.tsx) | [surfaces-onboarding.md](surfaces-onboarding.md) (guided steps) |
| QR join / extension pair | [join-token-client.tsx](../../../../src/app/join/[token]/join-token-client.tsx), [QrPanel](../../../../src/components/QrPanel.tsx) | [surfaces-navigation.md](surfaces-navigation.md) |
| Marketplace field forms | [ListingSchemaForm](../../../../src/components/ListingSchemaForm.tsx) | [surfaces-forms.md](surfaces-forms.md), [surfaces-editors.md](surfaces-editors.md) |
| Dialogs | [ListingTweakDialog](../../../../src/components/ListingTweakDialog.tsx), crop, AI picker, role picker | [surfaces-dialogs.md](surfaces-dialogs.md) |
| Destructive flows | Delete listing / photo in `AppHome` and `ListingHub` | [surfaces-destructive.md](surfaces-destructive.md) |
| Chrome extension | [extension/](../../../../extension/) | Follow extension CSS tokens; do not invent a second web app |
| Admin AI Photo Lab | [AiBgDebugConsole](../../../../src/components/AiBgDebugConsole.tsx) | Admin-only; do not copy its density onto seller screens |

## Not present as product surfaces

Do not load or invent references for:

- **Drawers / sheets** — not used. Hub uses a sticky QR column, not a drawer.
- **Data tables** — seller UI is lists and photo grids, not tables.
- **Marketing landing / dashboard KPIs** — `/` redirects to `/app` or `/unlock`.
- **Global app chrome / sidebar nav** — screens are self-contained with a back link.

Search/filter exists only inside AI Photo Lab. Treat it as admin, not a seller pattern.

## How to add a surface file

When a new surface becomes material, add `surfaces-{name}.md` using the template in [rules.md](rules.md) and link it here. Until then, record the gap in [coverage-gaps.md](coverage-gaps.md).
