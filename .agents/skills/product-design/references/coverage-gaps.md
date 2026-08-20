> Provenance: Coverage-gap list is part of Vercel’s published product-design
> architecture. Entries are Reseller Assistant–specific. Not an official
> unpublished Vercel file.

# Coverage gaps

Questions without a reliable standard. Use this list instead of inventing
fake rules. When a gap is closed, move the decision into a surface file,
exemplar, or `frontend-invariants.mdc` with evidence.

## Interaction and chrome

- **No shared dialog primitive.** Sizes, focus trap, dirty-close, and backdrop click differ across tweak, crop, AI picker, role picker, and admin lab.
- **Native `window.confirm` vs in-app dialog** for destructive actions is mixed. Photo confirm copy is weaker than listing confirm.
- **No drawer/sheet pattern** — do not assume one.
- **Profile is not a route.** Refresh while viewing Profile returns to the listing list. Unsettled whether `/app/profile` should exist.
- **Focus-visible** is not a systematic token (some `focus-visible:ring-1`, most native).
- **No skip-link / landmark standard** beyond default document flow.

## Visual language

- **Error color:** banners use Tailwind `red-50` / `red-800` while actions use `--danger`. Unsettled whether errors should use `--danger`.
- **Listing status labels:** raw `replaceAll("_", " ")`, no badge system. Do not invent status chips.
- **Extension vs web tokens** are parallel (`--bg`/`--ink` vs `--background`/`--foreground`) and extension uses system fonts. Unsettled how strictly they must match.
- **Shadow scale:** dialogs `shadow-2xl` vs mostly flat seller UI. No documented elevation system.
- **Dark mode** is not a product. Do not add a theme switch.

## Components

- **No exported Input/Field/Dialog/Banner.** `ListingSchemaForm` internals are not a public DS.
- **Many one-off buttons** beside `BigButton`. Unsettled which secondary actions must use `variant="secondary"` vs compact bordered buttons vs accent text.
- **Icon system:** only `AiGlyph` (and a thumbs SVG in the AI picker). Do not import an icon pack without a decision.
- **`StepProgress` is unused on the primary Phone Companion path** — unclear when a stepper is appropriate.

## Data and density

- **Autosave vs explicit save** for listing fields is mixed (hub dirty flag vs tweak Save).
- **Large listing lists** have no pagination/virtualization standard (not yet a problem).
- **Admin AI Photo Lab** is a dense lab UI. It is not a template for seller screens; few of its controls are documented as product standards.

## Responsive / device

- **Phone Companion vs hub** layouts are different by design; there is no shared “responsive table” because there are no tables.
- **Safe-area / notch** behavior for the in-app camera is not documented as a standard.
- **i18n / RTL** is not in scope; do not add localization UI.

## Copy

- Inconsistent loading strings: “Loading…”, “Loading listing…”, “Opening listing…”, “Joining listing…”.
- “Cover photo” vs Poshmark “Cover shot” vs label “Cover”.
- Marketplace field labels come from schemas and may diverge from hub instructional copy.

When working in a gap: make the smallest coherent choice, mark it as an assumption, and do not promote it to a global rule in the same change.
