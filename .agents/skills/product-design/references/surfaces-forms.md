> Provenance: Surface-file shape follows Vercel’s published template
> (Load when / Canonical owner / rules / examples / gaps). Content is from
> this repository. Not an official unpublished Vercel file.

# Surface: forms

## Load when

Sign-in, PIN setup, seller preferences, listing schema fields, or any new `<form>` / labeled control cluster.

## Canonical owner

- Unlock: [src/app/unlock/unlock-form.tsx](../../../../src/app/unlock/unlock-form.tsx)
- Schema fields: [src/components/ListingSchemaForm.tsx](../../../../src/components/ListingSchemaForm.tsx)
- PIN: [src/components/PinSetupCard.tsx](../../../../src/components/PinSetupCard.tsx)
- Preferences: [src/components/SellerOnboarding.tsx](../../../../src/components/SellerOnboarding.tsx)

## Stable rules

### rule/form-label-visible

- **Scope:** All seller-facing inputs
- **Rule:** Every input has a visible text label (`<label>` or `FieldLabel`). Placeholder is not a label.
- **Rationale:** Phone users in a closet need durable labels; placeholders disappear.
- **Evidence:** Unlock email/PIN labels; `ListingSchemaForm` `Field` + optional hint tooltip.
- **Exceptions:** Native file input is visually hidden and triggered by an explicit “Add” control.
- **Bad:** `<input placeholder="Email">` with no label.
- **Good:** `<span className="text-base font-semibold">Email</span>` above the field.

### rule/form-control-class

- **Scope:** Text inputs in seller UI
- **Rule:** Prefer the shared look: `touch-target` or `min-h-10`, `rounded-xl`/`rounded-lg`, `border-[var(--border)]`, `bg-white`, `px-3`/`px-4`, `text-base` or larger.
- **Rationale:** One control language across unlock, prefs, and schema.
- **Evidence:** `controlClass` in `ListingSchemaForm`; unlock inputs.
- **Exceptions:** PIN/OTP use oversized centered tracking for digits.
- **Bad:** Tiny 12px gray inputs on a work screen.
- **Good:** `ListingSchemaForm` `controlClass`.

### rule/few-static-options-visible

- **Scope:** 2–5 static choices (smoke-free, pets, audience)
- **Rule:** Show choices as visible buttons/toggles, not a `<select>` that hides them.
- **Rationale:** Sellers compare options at a glance; this matches Vercel’s public radio-vs-select heuristic and local `CompactChoice`.
- **Evidence:** `SellerOnboarding` `CompactChoice` / `CompactToggle`.
- **Exceptions:** Long marketplace category lists in `ListingSchemaForm` may use selects/options from schema.
- **Bad:** `<select>` with Yes/No.
- **Good:** Yes / Outdoor only / No chips.

### rule/busy-label-stable

- **Scope:** Submit and primary form actions
- **Rule:** Busy text is the same action in progressive aspect (`Saving…`, `Checking…`), not a new metaphor.
- **Evidence:** Unlock, onboarding, tweak dialog, PIN.
- **Exceptions:** None known.
- **Bad:** Button flips from “Sign in with PIN” to “Please wait”.
- **Good:** “Sign in with PIN” → “Checking…”.

## Good patterns

- Disable submit until the form can succeed (email contains `@`, PIN ≥ 4).
- Put errors in a red banner adjacent to the form, not only `alert()`.
- Character counts on title/description (`length/max`).
- Optional schema fields labeled `(optional)`.

## Bad patterns

- Autocomplete off on email/PIN without a reason.
- Mixing `BigButton` primary with a second equally-weighted primary on the same step. Unlock shows one primary (`Send me an email code` or `Sign in with PIN`); email-code recovery uses `BigButton` `ghost`.

## Coverage gaps

- No shared `<Input>` / `<Field>` primitive; `ListingSchemaForm` `Field` is not exported for unlock.
- Focus-visible treatment is inconsistent (schema help uses `focus-visible:ring-1`; many inputs rely on native focus).
