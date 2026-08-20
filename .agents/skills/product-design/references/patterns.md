> Provenance: Pattern log follows Vercel’s published idea of documenting
> shipped examples with useful decisions and known flaws. Patterns below
> have repeated evidence in this repo. Not an official unpublished Vercel file.

# Patterns

Existing code is evidence, not automatically a standard. Only patterns with
enough repetition (or an explicit product reason) are listed.

## Page header: eyebrow + serif title + muted subtitle

- **Where:** Unlock, onboarding, home, profile, listing hub, join.
- **Why it looks intentional:** Same hierarchy and accent eyebrow across auth and work screens.
- **Use when:** Introducing a screen’s job.
- **Do not use when:** Nested compact editors (tweak dialog already has a header; don’t duplicate the page chrome).
- **Limitations:** Title size `text-4xl` is large on phone; that is deliberate for closet use.

## Primary action: `BigButton` full width

- **Where:** Unlock, home create, onboarding save, Finish with AI, join retry.
- **Why:** Thumb-first, one obvious next step.
- **Use when:** The screen’s main commitment.
- **Do not use when:** Inline compact actions (Close, Default chip, list Delete, Show/Hide). Those are text or smaller bordered buttons.
- **Limitations:** Default `fullWidth` is true — set `fullWidth={false}` only with a reason.

## Error banner / success banner

- **Where:** Unlock, home, hub, PIN, onboarding, join.
- **Why:** Same `rounded-xl` padded paragraph; red-50 for errors, accent-soft for hints/success.
- **Use when:** Recoverable feedback tied to the current screen.
- **Do not use when:** You are tempted to add a toast library for one message.
- **Limitations:** No dual-tone semantic tokens for warning vs error besides extension CSS `--warning-*`.

## Bounded object card

- **Where:** Listing rows, PIN section, QR panel, store check rows, listing-fields section, platform chooser.
- **Why:** The card *is* the object or the task block.
- **Use when:** Grouping a real object or a single job the seller commits to.
- **Do not use when:** Wrapping titles, helper sentences, or every form field.
- **Limitations:** Easy to overuse; see interface-quality “card soup”.

## Quiet optional disclosure

- **Where:** `ExtensionInstallCard`; hub `<details>` for private tag photos.
- **Why:** Optional tools and private shots must not compete with Create listing / listing photos.
- **Use when:** Advanced or optional.
- **Do not use when:** The control is on the primary path (Finish with AI is a full section, not details).
- **Limitations:** Details/summary keyboard styling is not fully standardized.

## Dual-path with “— or —”

- **Where:** Unlock PIN vs email code.
- **Why:** Two valid sign-in jobs; PIN is preferred if they have one, code is the fallback.
- **Use when:** Two complete methods, not two settings.
- **Do not use when:** Splitting one action into fake alternatives.
- **Limitations:** Both still share the email field.

## Sticky QR rail

- **Where:** Listing hub `lg:grid-cols-[minmax(0,1fr)_13.5rem]`.
- **Why:** Phone capture is how photos get into the hub; the rail is an entry, not nav.
- **Use when:** Laptop hub while shooting on a phone.
- **Do not use when:** Building an app-wide sidebar.
- **Limitations:** Narrow screens stack; QR compact props exist for density.

## Custom dialog without a library

- **Where:** Tweak, crop, AI picker, role picker, lightboxes.
- **Why:** No Radix/shadcn in package.json.
- **Use when:** You must overlay. Copy tweak-dialog semantics.
- **Do not use when:** Inline edit on the hub suffices.
- **Limitations:** No shared focus trap; see coverage-gaps.

## Native confirm for delete

- **Where:** Listing delete; photo delete.
- **Why:** Fast, blocking, names the object in the message.
- **Use when:** Matching existing delete flows until a dialog standard exists.
- **Do not use when:** The action needs extra context the OS dialog cannot hold — then use a real dialog, not both.
- **Limitations:** OS buttons say OK/Cancel; this is a known flaw, not a copy standard.

## Poll without flicker

- **Where:** `ListingHub` `mergePhotosWithStableUrls`.
- **Why:** Signed URLs refresh; images should not flash.
- **Use when:** Polling listing/photo payloads.
- **Do not use when:** The file actually changed (`storage_path` / `processed_path`).
- **Limitations:** Pattern is hub-specific today.
