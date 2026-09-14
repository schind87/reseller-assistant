# Surface: What’s new

## Load when

Editing `/whats-new`, `src/content/whats-new.ts`, or the screenshot lightbox.

## Canonical owner

[src/app/whats-new/page.tsx](../../../../src/app/whats-new/page.tsx),
[WhatsNewView](../../../../src/components/WhatsNewView.tsx),
[src/content/whats-new.ts](../../../../src/content/whats-new.ts).

How notes stay current: [.agents/skills/whats-new/SKILL.md](../../../whats-new/SKILL.md).

## Stable rules

### rule/whats-new-is-one-public-list

- **Status:** accepted
- **Scope:** Website + Chrome helper ships
- **Rule:** One public page at `/whats-new`. Helper work uses a small **Chrome helper** label on the item. Do not add a second changelog for the extension.
- **Rationale:** Sellers should scan one list. The helper is optional; the chip says when a change is not only the website.
- **Evidence:** Privacy is the other public info page (`/privacy`). This page matches that shell (`max-w-2xl`, eyebrow, serif title).
- **Exceptions:** None.
- **Bad:** Separate “extension release notes”, or burying helper ships only in `STORE.md`.
- **Good:** Newest-first dated list; chip only on helper items.

### rule/whats-new-screenshots-are-a-lightbox

- **Status:** accepted
- **Scope:** Screenshot links on `/whats-new`
- **Rule:** Screenshot controls are buttons that open an in-page dialog (`role="dialog"`, `aria-modal`, labelled, Escape, backdrop click, body scroll lock, Close as a word). Do not navigate to a raw image URL.
- **Rationale:** Staying on the notes page keeps scan context. Matches listing photo preview, not AI Photo Lab.
- **Evidence:** `ScreenshotLightbox` in `WhatsNewView`; listing `PhotoLightbox` in `ListingHub`.
- **Exceptions:** None.
- **Bad:** `<a href="/whats-new/foo.png">` that leaves the page.
- **Good:** “See category after” opens the overlay; Close returns to the list.

### rule/whats-new-store-status-is-observed

- **Status:** accepted
- **Scope:** Chrome helper notes on `/whats-new`
- **Rule:** Next to the newest **Chrome helper** note, show a small plain-language chip for the live helper’s Chrome Web Store status (`fetchStatus`). Omit the chip when secrets and the committed snapshot are both missing. Never invent a version or review state.
- **Rationale:** Sellers need to know whether Chrome still has an older helper while a newer zip is in review. Guessing that from `manifest.json` would lie.
- **Evidence:** `getChromeHelperStoreChip` in `src/lib/chrome-web-store-status.ts`; snapshot job `.github/workflows/chrome-store-status.yml`.
- **Exceptions:** Website-only notes have no Store chip.
- **Bad:** Hardcoding “0.7.0.8 in review” from the last CI log.
- **Good:** “Chrome has 0.7.0.3 · 0.7.0.8 in review” from `fetchStatus`, or no chip.
