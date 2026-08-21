> Provenance: Surface-file shape follows Vercel’s published template.
> Content is from this repository. Not an official unpublished Vercel file.

# Surface: onboarding and guided capture

## Load when

First-run seller preferences, Phone Companion steps, or any “coach” sequence.

## Canonical owner

- Closet profile: [SellerOnboarding.tsx](../../../../src/components/SellerOnboarding.tsx)
- Photo coach: [PhotoCoach.tsx](../../../../src/components/PhotoCoach.tsx), steps in [src/lib/platforms.ts](../../../../src/lib/platforms.ts)
- Optional extension hint: [ExtensionInstallCard.tsx](../../../../src/components/ExtensionInstallCard.tsx)

## Stable rules

### rule/onboarding-blocks-home-once

- **Scope:** New accounts
- **Rule:** Until seller preferences are saved, home is the onboarding form — not a dashboard with a dismissible banner. Editing later is compact on Profile.
- **Evidence:** `AppHome` `editingPrefs || !prefsDone` returns `SellerOnboarding`.
- **Exceptions:** Cancel only when already completed (`onCancel` when `prefsDone`).
- **Bad:** Skip-first-run that leaves marketplace and smoke/pet notes empty without a reason.
- **Good:** “Before your first listing” / “Tell us about your closet”.

### rule/optional-tools-stay-quiet

- **Scope:** Chrome extension
- **Rule:** If the helper is missing, show a collapsed dashed hint, not a hero install card. Hide entirely when installed or still checking.
- **Evidence:** `ExtensionInstallCard`.
- **Exceptions:** Local-dev install steps inside the expanded panel.
- **Bad:** Full-width “Install our browser extension” marketing card on every visit.
- **Good:** “Optional: install the Chrome helper” with Show/Hide.

### rule/photo-steps-are-jobs

- **Scope:** Phone Companion
- **Rule:** Each step is a photo job with title + instruction from `PHOTO_STEPS`, not a generic “upload files” screen. Optional steps are skippable. Identification/stocking shots are private by default. Listing Brand/ID tags (`tag`) are a shopper-facing step before private identification (`id_tag`).
- **Evidence:** `platforms.ts` copy; PhotoCoach actions “Take {role} photo” / “Add another…”.
- **Exceptions:** Desktop hub allows unstructured add/drag onto sections. Identification photos can be dragged into listing photos, which recategorizes them as Brand/Tag.

## Good patterns

- Large camera preview, short instruction, one primary shutter action.
- QR page on desktop explains the phone job and offers “Add photos on this computer instead”.

## Bad patterns

- Multi-page wizard chrome with stepper for preferences (preferences are one form).
- Requiring brand-tag photos before the seller can list (they are optional).

## Coverage gaps

- `StepProgress` exists but is not the Phone Companion’s primary chrome — do not assume a stepper is required on every guided flow.
