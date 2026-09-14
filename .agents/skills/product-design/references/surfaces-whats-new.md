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
- **Rule:** One public page at `/whats-new`. Helper work uses a small **Chrome helper** label on the item. Do not add a second changelog for the extension. Do not add website/helper filter tabs.
- **Rationale:** Sellers should scan one list. The helper is optional; the mark says when a change is not only the website.
- **Evidence:** Privacy is the other public info page (`/privacy`). This page matches that shell (`max-w-2xl`, eyebrow, serif title).
- **Exceptions:** None.
- **Bad:** Separate “extension release notes”, or burying helper ships only in `STORE.md`.
- **Good:** Newest-first dated list; small **Chrome helper** mark only on helper items.

### rule/whats-new-notes-are-list-objects

- **Status:** accepted
- **Scope:** `/whats-new` list
- **Rule:** Each ship is a bounded row (`rounded-2xl border`, white surface) like a home listing. Date is a muted group label, not an accent heading. Note titles are `h2`. Exit (`← All listings` / Sign in) lives in the header.
- **Rationale:** Sellers scan titles the way they scan listings. Dates were stealing heading rank from the change itself.
- **Evidence:** Home listing rows in `AppHome`; Profile header exit; Privacy uses prose sections because it is a policy, not a list of ships.
- **Exceptions:** Empty list is a muted sentence that names the header exit control.
- **Bad:** Date `h2` + uncontained articles; chip legend that narrates the UI; nav only after the whole list.
- **Good:** Muted “September 14, 2026”, then rows whose titles are the scan target.

### rule/whats-new-screenshots-are-a-lightbox

- **Status:** accepted
- **Scope:** Screenshot controls on `/whats-new`
- **Rule:** Screenshot controls are buttons that open an in-page dialog (`role="dialog"`, `aria-modal`, labelled, Escape, backdrop click, body scroll lock, Close as a word). Do not navigate to a raw image URL.
- **Rationale:** Staying on the notes page keeps scan context. Matches listing photo preview, not AI Photo Lab.
- **Evidence:** `ScreenshotLightbox` in `WhatsNewView`; listing `PhotoLightbox` in `ListingHub`.
- **Exceptions:** None.
- **Bad:** `<a href="/whats-new/foo.png">` that leaves the page.
- **Good:** A photo well labelled “Category after” opens the overlay; Close returns to the list.

### rule/whats-new-screenshots-are-photo-wells

- **Status:** accepted
- **Scope:** Screenshot controls on `/whats-new`
- **Rule:** Screenshots render as tappable photo wells (muted well + image + label), matching home listing thumbs and hub photo tiles. They remain `button`s that open the lightbox.
- **Rationale:** Text-only “See …” links hide the evidence. Sellers already open photos from wells.
- **Evidence:** `AppHome` thumbs; `ListingHub` photo tiles + `PhotoLightbox`.
- **Exceptions:** Notes with no screenshots omit the well row.
- **Bad:** A vertical list of accent text buttons with no preview.
- **Good:** A wrap of wells; tap opens the in-page dialog.

### rule/whats-new-store-status-is-observed

- **Status:** accepted
- **Scope:** Chrome helper notes on `/whats-new`
- **Rule:** On the newest **Chrome helper** note, show observed Chrome Web Store status (`fetchStatus`) as a status well (`accent-soft` or `bg-red-50`), not a second chip. Omit it when secrets and the committed snapshot are both missing. Never invent a version or review state.
- **Rationale:** Sellers need to know whether Chrome still has an older helper while a newer zip is in review. A twin chip next to **Chrome helper** made state look like another tag.
- **Evidence:** Hub status wells; `getChromeHelperStoreChip` in `src/lib/chrome-web-store-status.ts`.
- **Exceptions:** Website-only notes have no Store well. Helper items still get the small **Chrome helper** mark.
- **Bad:** Hardcoding “0.7.0.8 in review” from the last CI log.
- **Good:** A well reading “Chrome has 0.7.0.3 · 0.7.0.8 in review” from `fetchStatus`, or no well.
