# Exemplar: tweak listing fields dialog

- **Surface:** Dialog + marketplace editor
- **User problem:** While posting in the extension, the seller needs a larger editor without a second source of truth.
- **Decision:** True dialog (role, label, Escape, scroll lock). Header with platform eyebrow, title “Tweak listing fields”, Close. Scrollable `ListingSchemaForm`. Sticky footer Save changes / Saved / Done. Same fields as the hub.
- **Why it worked:** Persistence matches the moment (focus while posting). Consequences are clear (save, then extension can refresh). Long forms remain reachable on a laptop.
- **Evidence:** [src/components/ListingTweakDialog.tsx](../../../../src/components/ListingTweakDialog.tsx)
- **Reusable principle:** Overlay for focus; reuse the canonical form; sticky actions; Close is a word, not an icon.
- **Do not copy:** `shadow-2xl` as a default for non-modal cards. No focus trap library — don’t nest this dialog. Backdrop click closes even when dirty (known flaw; don’t spread that without a decision).
