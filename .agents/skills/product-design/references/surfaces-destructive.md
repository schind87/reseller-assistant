> Provenance: Surface-file shape follows Vercel’s published template.
> Destructive-action naming follows Vercel’s public Verb + Noun guidance,
> applied to this product’s objects. Not an official unpublished Vercel file.

# Surface: destructive workflows

## Load when

Any delete, replace, restore, or irreversible photo/listing change.

## Canonical owner

- Delete listing: [AppHome.tsx](../../../../src/components/AppHome.tsx) `deleteListing`; admin Users page
- Delete user: [AdminUsersConsole](../../../../src/components/AdminUsersConsole.tsx)
- Delete photo: [ListingHub.tsx](../../../../src/components/ListingHub.tsx)
- Restore original photo: AI picker

## Stable rules

### rule/destructive-names-object

- **Scope:** Destructive CTAs and confirms
- **Rule:** Name the action and the object. Prefer “Delete {title}” / “Delete this photo”. Never use Confirm, OK, or a bare “Yes”.
- **Rationale:** Sellers distinguish listing vs photo vs account.
- **Evidence:** `Delete “${label}”? Photos for this listing will be removed too.`; `aria-label={`Delete ${label}`}`.
- **Exceptions:** Native `window.confirm` button chrome is OS-controlled (“OK”/“Cancel”) — the **message** must still name the object. Custom dialogs must not copy OS “OK”.
- **Bad:** Button “Confirm” deleting a listing.
- **Good:** Row action “Delete” plus confirm copy that names the listing and photo side effect.

### rule/destructive-weight

- **Scope:** Visual treatment
- **Rule:** Destructive text/actions use `--danger` or `text-[var(--danger)]`, not accent green. `BigButton variant="danger"` exists for a true primary destructive action (rare).
- **Evidence:** Home row Delete; `BigButton` danger variant.
- **Exceptions:** Restore original is not styled as delete.
- **Bad:** Green primary button that deletes.
- **Good:** Danger-colored text button on the listing row, separated from the open-link target.

### rule/no-fake-undo

- **Scope:** Deletes
- **Rule:** Do not promise Undo unless the API can restore. Listing and photo deletes currently cannot.
- **Evidence:** DELETE endpoints; UI removes the row on success.
- **Exceptions:** AI backdrop can restore the original image — that control should stay available.

## Good patterns

- Disable the delete control while `deletingId` matches; show `…` rather than a different verb.

## Bad patterns

- Accidental delete because the whole row is one button including Delete.
- Using `window.confirm` and a custom modal stacked.

## Coverage gaps

- Native confirm vs in-app dialog is mixed and unset as a standard.
- Photo confirm “Delete this photo?” is weaker than listing confirm (no title).
