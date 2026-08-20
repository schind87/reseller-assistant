> Provenance: Copy principles follow Vercel’s public product-design guidance
> (actionable labels, Verb + Noun, accessible names as copy). Vocabulary is
> taken from this application, not Vercel’s product. Not an official
> unpublished Vercel file.

# Product copy

Load for Copy mode, accessible names, errors, empty states, and any new user-facing string.

Canonical terms live in [glossary.md](glossary.md). Do not invent synonyms for those terms.

## Principles

1. **Action labels describe the action.** “Create new listing”, “Sign in with PIN”, “Finish with AI”, “Open Poshmark”, “Save my PIN”, “Retry QR join”.
2. **Prefer a specific label over a vague CTA.** Avoid Get started, Continue, Submit, Confirm, OK when a precise verb exists.
3. **Destructive actions name what will happen.** See [surfaces-destructive.md](surfaces-destructive.md).
4. **Errors help the seller recover.** “Could not create listing” is a fallback; prefer the API’s specific `error` string. Join explains scanning the current QR, then Retry.
5. **Stay consistent.** Mercari and Poshmark, not “the marketplace” on first mention. Listing, not “item” or “product” for the draft object. Phone Companion, not “mobile app”.
6. **Do not invent synonyms** for canonical concepts (Finish with AI vs “Generate listing” vs “Run magic”).
7. **Accessible names are product copy.** Icon-only or truncated controls still need `aria-label` that names the object (`Delete ${label}`, `Crop ${role} photo`).
8. **Busy labels keep the meaning.** `Saving…` / `Starting…` / `Working…` / `Checking…` / `Sending…` — not “Hang tight”.
9. **Structure beats explanatory prose.** If the layout already shows the next step, do not add a tutorial paragraph. Extension install stays collapsed. Hub photo instructions are one short paragraph because drag/drop/QR is actually complex.
10. **Write for a person photographing clothes**, often on a phone, not for a designer. Plain sentences. No “leverage”, “seamless”, “delight”, “pipeline”.

## Established voice

- Direct, second person when instructing (“Scan with your phone”).
- Serif titles can be warm (“Tell us about your closet”) without becoming a lifestyle brand.
- Marketplace names from `PLATFORM_LABELS`.
- Photo roles from `photoRoleLabel()`.
- Optional things say optional.

## Loading and empty

| Situation | Prefer |
| --- | --- |
| Page load | “Loading…” / “Loading listing…” |
| Opening old post URL | “Opening listing…” |
| Empty listings | Name “Create new listing” |
| Empty AI | “Needs at least one photo first.” |
| QR not ready | “Preparing QR code…” |

## Errors

Reuse the red banner pattern. Do not toast. Do not blame the user. If pop-ups blocked, say to allow pop-ups.

## What not to copy from Vercel

Do not import Vercel, Geist, deployment, billing, or “team” vocabulary. This product’s people are sellers; its objects are listings and photos.
