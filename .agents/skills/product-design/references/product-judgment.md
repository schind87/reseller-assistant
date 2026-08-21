> Provenance: Decision-model fields follow Vercel’s published product-design
> architecture
> ([Teaching agents product design at Vercel](https://vercel.com/blog/teaching-agents-product-design-at-vercel),
> June 25, 2026). Examples and product objects are Reseller Assistant–specific.
> This is not an official unpublished Vercel file.

# Product judgment

Product design is deciding what the interface should do for a person with a job. Component selection is not product design.

## When to load

Shape, Implement, Harden, full Review, or any material change to task, default, scope, consequence, navigation, interaction surface, or reachable states.

## Compact decision model

For material UI changes, write this internally before choosing UI. Keep it short. Do not paste it into the product unless the user asked for a spec.

| Field | Prompt |
| --- | --- |
| User / persona | Who is acting? Typical: signed-in clothing reseller; phone-join session on Phone Companion; admin in AI Photo Lab. |
| Job to be done | What are they trying to finish in this moment? |
| Current behavior | What does the product do today? Cite the route or component. |
| Problem | What fails, confuses, or costs time? |
| Desired outcome | What should be true when they succeed? |
| Success signal | How will we know? (listing created, photo uploaded, fields saved, sell page opened) |
| Non-goals | What this change must not become. |
| Product object | Listing, photo, seller preferences, PIN, join token, extension pair, AI background result. |
| Scope | One listing, one photo, account-wide prefs, admin-only. |
| Primary action | The one control that advances the job. |
| Consequence | What the system will change, spend, delete, or publish. |
| Reversibility | Can they undo? Delete listing has no undo. Field edits are saveable. AI backdrop can restore original. |
| Permissions | Signed-in owner, join-only phone session, admin email. |
| Dependencies | Extension installed, photos present, AI keys, pop-ups allowed. |
| Assumptions | Mark guesses explicitly. |
| Open decisions | What still needs a human. |

## How to decide

1. **Prefer behavior and defaults over new UI.** If one store is enabled, `Create new listing` starts it; do not add a settings screen for that.
2. **Do not add UI because UI can be added.** Optional Chrome helper stays collapsed (`ExtensionInstallCard`). Admin lab stays off the default seller path.
3. **One primary action per moment.** Home: create a listing. Hub: add photos, then Write listing with AI, then open the marketplace. Sign-in: PIN or email code, not both at once as equal noise.
4. **Name the object.** Delete the listing, not “Confirm”. Open Poshmark, not “Continue”.
5. **Keep configuration rare.** Seller preferences exist because they flow into listing notes and store choice. Do not add a preference for every possible listing field.
6. **Match surface persistence to importance.** Inline listing fields on the hub; modal for “Tweak listing fields” while posting; native `confirm` is current evidence for deletes (see coverage gaps).
7. **Preserve context.** Phone Companion and listing hub are the same listing. Do not invent a separate “dashboard home” between them.

## Distinctions

| This | Is not |
| --- | --- |
| Verified product truth (status, permissions, API errors) | A visual preference |
| An accepted decision with evidence | A single nearby file to copy |
| A coverage gap | A license to invent a standard |
| Reusing `BigButton` | Designing the flow |

## Anti-patterns

- Starting from a component library and looking for a place to use it.
- Adding a sidebar, KPI row, or settings page to make the app feel “complete”.
- Treating Mercari and Poshmark as generic “integrations” instead of the stores this product is for.
- Hiding a destructive or irreversible consequence behind a vague CTA.
