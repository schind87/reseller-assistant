> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: dialogs / modals

## Load when

Adding or changing an overlay: tweak fields, crop, AI result picker, photo-role picker, photo lightbox, admin lab dialogs.

## Canonical owner

There is **no shared Dialog primitive**. Closest mature example: [ListingTweakDialog.tsx](../../../../src/components/ListingTweakDialog.tsx). Others: `PhotoAspectCrop`, `AiPhotoBackgroundPicker`, role picker and preview in `ListingHub`, admin dialogs in `AiBgDebugConsole`.

## Stable rules

### rule/dialog-semantics

- **Scope:** Any blocking overlay
- **Rule:** `role="dialog"`, `aria-modal="true"`, labelled by heading id or `aria-label`. Escape closes. Body scroll locked while open. Backdrop click closes when that is safe (tweak dialog yes; confirm-with-work-in-progress: be careful).
- **Rationale:** Keyboard and AT users need a real dialog, not a absolutely positioned card.
- **Evidence:** `ListingTweakDialog`.
- **Exceptions:** `window.confirm` deletes (see destructive surface).
- **Bad:** `div` overlay with no role and no Escape.
- **Good:** `ListingTweakDialog` header / scroll body / sticky footer.

### rule/dialog-structure

- **Scope:** Dialogs with forms or long content
- **Rule:** Header (title + close) sticky; body `overflow-y-auto`; footer with primary/secondary sticky. `max-h` so phone screens still reach Close.
- **Evidence:** Tweak dialog `max-h-[min(92vh,960px)]`, `max-w-3xl`.
- **Exceptions:** Simple role picker is a short list (`max-w-lg`) without a separate footer row.
- **Bad:** Unbounded dialog that pushes actions off-screen on a phone.
- **Good:** Tweak listing fields.

### rule/prefer-inline-before-modal

- **Scope:** Seller hub
- **Rule:** Prefer inline listing fields on the hub. Use a modal when the seller is mid-posting (`Tweak listing fields`) or manipulating one photo (crop, AI pick, role change).
- **Rationale:** Hub is the source of truth; modals are for focus, not for hiding the main job.
- **Evidence:** Schema form inline + tweak dialog for the extension posting moment.
- **Exceptions:** Phone Companion is its own route, not a modal.

## Good patterns

- Close control labelled “Close”, not an unlabeled ×.
- `ra-focus-pop` only on the photo-role picker — do not spread motion to every modal.

## Bad patterns

- Nested modals (focus trapping is homemade and will break).
- Copying AI Photo Lab’s large lightbox layout onto seller flows.

## Coverage gaps

- No shared dialog component, focus trap, or size scale (`max-w-lg` vs `max-w-3xl` vs `max-w-4xl` vs `95vh`).
- Backdrop click-to-close vs dirty-form protection is not standardized.
