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
