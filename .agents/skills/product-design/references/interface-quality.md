> Provenance: Quality bar and anti-slop guidance follow Vercel’s published
> product-design architecture and public Web Interface Guidelines. Visual
> language is taken from this repository (`src/app/globals.css` and shipped
> screens). This is not an official unpublished Vercel file.

# Interface quality

Govern visual and structural quality. Load for Implement, Harden, visual Review, and any material layout change.

Route accessibility mechanics, focus rings, semantic HTML, keyboard, touch, motion, images, and URL state to [web-design-guidelines](../../web-design-guidelines/SKILL.md). Route tokens and component APIs to [project-design-system](../../project-design-system/SKILL.md).

## This product's visual language

Verified in `src/app/globals.css` and mature screens (`AppHome`, `UnlockForm`, `ListingHub`, `ListingTweakDialog`):

- **Paper and ink:** `--background: #f7f4ef`, `--foreground: #2a2a28`, `--muted: #5c5a55`.
- **Forest accent:** `--accent: #1f5c4a` for primary actions, eyebrows, and text links. Not purple, not sky-blue SaaS.
- **Surfaces:** white `--surface` on paper; `--surface-muted: #efeae2` for wells and hover.
- **Typography:** Source Serif 4 (`--font-brand`) on `h1`–`h3`; DM Sans (`--font-body`) everywhere else. Headings use slight negative tracking. Do not add a third font to make one screen distinctive.
- **Radius:** `rounded-xl` on controls; `rounded-2xl` on bounded objects (listing rows, PIN card, QR panel, dialogs). Not pill-shaped everything.
- **Density:** operational. Home and onboarding are `max-w-2xl` with `gap-8`. Listing hub is `max-w-6xl` with a sticky QR column. Auth/join/phone are `max-w-md` / `max-w-lg`. Do not apply marketing-page whitespace to the hub.
- **Type scale:** page titles ~`text-4xl` serif; section titles `text-2xl` serif; body `text-base` / `text-lg`; eyebrows `text-sm font-semibold uppercase tracking-wide` in accent.
- **Touch:** `.touch-target` is 3.25rem minimum. Primary actions use `BigButton` (large, full-width by default).
- **Motion:** almost none. `ra-focus-pop` exists for the photo-role picker. Do not add gratuitous animation. Honor reduced motion via the web-design skill.
- **Shadows:** rare. Dialogs may use `shadow-2xl`; QR compact variant uses `shadow-sm`. Default chrome is border + paper, not elevation theater.

The Chrome extension (`extension/sidepanel.css`) shares the forest-on-paper palette with slightly different token names (`--bg`, `--ink`, `--radius: 12px`) and system fonts. Do not restyle the extension as a second brand.

## Hierarchy before decoration

The seller should identify without ornament:

1. Primary task (what this screen is for)
2. Primary action (the next step)
3. Important state (error, busy, missing photos, draft dirty)
4. Secondary controls
5. Supporting information

Eyebrow + serif title + muted subtitle is the established page header. Do not wrap that header in a card.

## Avoid "card soup"

Do not automatically put every concept in a rounded rectangle, bordered panel, elevated card, or tinted container.

Use first: typography, spacing, alignment, grouping, dividers, layout, background hierarchy.

Use a container when it represents a **bounded object or interaction**: a listing row, a PIN setup block, a QR panel, a marketplace fieldset, a dialog, a photo well. Home's page title is not a card. Listing hub's header is not a card.

## Avoid artificial dashboard structure

Do not generate four KPI cards, giant welcome headings, feature-card grids, unnecessary sidebars, or generic admin-dashboard layouts.

This product's information architecture is: sign in → (onboarding once) → listing list → listing hub (photos + AI + fields) → marketplace. The AI Photo Lab is an admin tool, not a template for seller screens.

A sticky QR column on the hub is justified: it is the phone-capture entry, not a navigation sidebar.

## Avoid decorative icon proliferation

Icons communicate meaning or affordance. `AiGlyph` marks AI actions. Photo wells are the content. Do not place icons beside every heading, metric, menu item, button, or informational sentence. This app has no icon library; do not invent lucide-everywhere chrome.

## Avoid generic AI decoration

Not defaults here:

- Gradient headline text
- Purple/blue SaaS gradients
- Glassmorphism
- Oversized border radius / pill-shaped everything
- Excessive shadows
- Gratuitous animations
- Giant whitespace meant to look “premium”

These are allowed only when justified by this product's forest-on-paper, large-type, clothing-reseller direction.

## Components

Search `src/components/` before creating a primitive. Use `BigButton` for page-level actions. Use `ListingSchemaForm` for marketplace fields. Use CSS variables, not one-off hex, for brand color. Do not override the local visual system because custom styling is easy.

## Application density

Phone Companion and listing hub are work surfaces. Prefer readable large type (this audience is often on a phone in a closet) without turning the hub into a landing page. Compact variants exist (`QrPanel compact`, `SellerOnboarding compact`, `ExtensionInstallCard compact`) — use them in constrained regions, not as an excuse to shrink the primary path.
