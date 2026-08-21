> Provenance: Copy principles follow Vercel’s public product-design guidance
> (actionable labels, Verb + Noun, accessible names as copy). Vocabulary is
> taken from this application, not Vercel’s product. Not an official
> unpublished Vercel file.

# Product copy

Load for Copy mode, accessible names, errors, empty states, and any new user-facing string.

Canonical terms live in [glossary.md](glossary.md). Do not invent synonyms for those terms.

## Copy existence test

Before writing or adding user-facing copy, first determine whether the copy should exist.

Use this order:

1. **Remove**
   Can the interface communicate this through its label, state, hierarchy,
   placement, or interaction without explanatory text?
   If yes, do not add copy.

2. **Collapse**
   Is the information useful only occasionally?
   Prefer progressive disclosure, contextual help, or an optional detail
   rather than permanently visible explanation.

3. **Combine**
   Does nearby text already communicate the same instruction, state,
   consequence, or reassurance?
   Keep one canonical explanation.

4. **Rewrite**
   Only after Remove, Collapse, and Combine fail should copy be rewritten
   for clarity or concision.

Every persistent explanatory string must have a specific user job.

It should do at least one of these:

- identify something the interface cannot make obvious
- communicate current state
- tell the seller what action is needed
- explain a material consequence
- prevent a likely error
- explain how to recover
- provide necessary product-specific context

If removing the text does not materially reduce comprehension, safety,
task completion, or recovery, remove it.

Do not use explanatory copy to compensate for unclear interface structure.
Fix hierarchy, labels, state presentation, or interaction first.

## Principles

1. **Action labels describe the action.** “Create new listing”, “Sign in with PIN”, “Finish with AI”, “Open Poshmark”, “Save my PIN”, “Retry QR join”.
2. **Prefer a specific label over a vague CTA.** Avoid Get started, Continue, Submit, Confirm, OK when a precise verb exists.
3. **Destructive actions name what will happen.** See [surfaces-destructive.md](surfaces-destructive.md).
4. **Errors help the seller recover.** “Could not create listing” is a fallback; prefer the API’s specific `error` string. Join explains scanning the current QR, then Retry.
5. **Stay consistent.** Mercari and Poshmark, not “the marketplace” on first mention. Listing, not “item” or “product” for the draft object. Phone Companion, not “mobile app”.
6. **Do not invent synonyms** for canonical concepts (Finish with AI vs “Generate listing” vs “Run magic”).
7. **Accessible names are product copy.** Icon-only or truncated controls still need `aria-label` that names the object (`Delete ${label}`, `Crop ${role} photo`).
8. **Busy labels keep the meaning.** `Saving…` / `Starting…` / `Working…` / `Checking…` / `Sending…` — not “Hang tight”.
9. **Structure beats explanatory prose.** If the layout already shows the next step, do not add a tutorial paragraph. Extension install stays collapsed. Hub photo instructions may use brief explanatory copy when multiple input methods are not apparent from the controls themselves. Re-evaluate the need for that copy when the interaction changes.
10. **Write for a person photographing clothes**, often on a phone, not for a designer. Plain sentences. No “leverage”, “seamless”, “delight”, “pipeline”.
11. **One message, one home.** Do not repeat the same reassurance, instruction, or explanation within one workflow unless the user needs it again at the moment of consequence.
12. **State should usually be a label, not a sentence.** Prefer “Needs photos”, “Ready to post”, or “Posted” over prose explaining the listing's current stage.
13. **Do not narrate obvious UI.** Avoid copy such as “Click the button below to continue”, “Use this form to…”, or “Here you can…”.
14. **Headings do not need supporting copy by default.** A title followed immediately by the relevant controls is often enough. Add body copy only when the user needs information not evident from the controls themselves.
15. **Do not add reassurance reflexively.** Statements such as “Don’t worry”, “You can always change this later”, “Your information is safe”, or repeated “This will not be posted” text require a concrete reason to exist.
16. **Prefer progressive disclosure for secondary explanation.** Advanced, uncommon, administrative, or educational information should not compete with the primary task.
17. **Copy density is part of interface quality.** When reviewing a surface, look for paragraphs, subtitles, helper text, banners, tooltips, and repeated instructions that can be removed before rewriting them.

## Established voice

- Direct, second person when instructing (“Scan with your phone”).
- Serif titles can be warm (“Tell us about your closet”) without becoming a lifestyle brand.
- Marketplace names from `PLATFORM_LABELS`.
- Photo roles from `photoRoleLabel()`.
- Optional things say optional.

## Loading and empty

Use loading copy only when naming what is loading improves orientation. Do not narrate routine latency. Prefer preserving layout or showing the pending state of the affected control where practical.

| Situation | Prefer |
| --- | --- |
| Page or region pending | Named copy only when it orients (“Loading listing…”). Do not default to a page-level “Loading…”. |
| Opening old post URL | “Opening listing…” when that names a distinct transition |
| Empty listings | Name “Create new listing” |
| Empty AI | “Needs at least one photo first.” |
| QR not ready | “Preparing QR code…” when the QR region would otherwise be unexplained empty space |

## Errors

Reuse the red banner pattern. Do not toast. Do not blame the user. If pop-ups blocked, say to allow pop-ups.

## What not to copy from Vercel

Do not import Vercel, Geist, deployment, billing, or “team” vocabulary. This product’s people are sellers; its objects are listings and photos.
