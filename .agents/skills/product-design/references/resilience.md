> Provenance: Reachable-state discipline follows Vercel’s published
> product-design architecture. States listed here are ones this application
> can actually enter. This is not an official unpublished Vercel file.

# Resilience

Design states the product can actually enter. Do not invent fictional states to satisfy a checklist. Localization/RTL is not a current product requirement.

## When to load

Implement, Harden, Review, or any change that affects loading, empty, error, permission, busy, or responsive behavior.

## Reachable states in this product

| State | Where it shows up | Verified treatment |
| --- | --- | --- |
| Initial loading | Listing hub, photos page, unlock Suspense, join | Muted “Loading…” / “Loading listing…” text, same max-width as the page. No skeleton theater required unless a layout shift is severe. |
| Incremental / busy | Buttons, photo upload, Finish with AI, sign-in | Disable the control; keep the label’s meaning (`Starting…`, `Saving…`, `Working…`, `Checking…`). Use the component’s busy affordance, not a different verb. |
| Empty | Home listing list; photo sections; Finish with AI with zero photos | Plain muted sentence that names the next action. Example: “No clothing listings yet. Tap Create new listing when you are ready.” |
| Sparse | One listing; few photos | Same list/grid; do not switch to a marketing empty-hero. |
| Populated | Listing list; hub photos; schema form | Rows and wells as bounded objects. |
| Large datasets | Admin photo picker (48+); many listing photos | Hub uses sections + details for private tags. Admin lab paginates/filters. Seller home is not expected to be thousands of rows; if it grows, do not pretend a table primitive exists. |
| Long labels / UGC | Listing titles, descriptions, style tags | `min-w-0`, `break-words`, `truncate` only with a real need. Description fields show `length/max`. |
| Validation | PIN length, email `@`, schema required fields, style-tag max | Disable primary action until ready (unlock PIN) or inline constraints (tags `3/3`). Preserve input on failure. |
| Recoverable errors | API failures on create/save/join/upload | `rounded-xl bg-red-50 … text-red-800` banner near the action. Message should say what failed and what to try. Join offers Retry. |
| Success / status | Hub status line; PIN saved; extension hint | `accent-soft` banner, not a toast system (none exists). |
| Fatal / missing listing | Hub with no data | Error text + “Back to home”. |
| Permissions | Unauthenticated → `/unlock`; join-only phone session; non-admin → redirect from AI Photo Lab | Do not expose admin chrome to sellers. Phone join must not look like full account home. |
| Disabled | Buttons without photos, busy, invalid email | `disabled:opacity-50` / `60`; still explain why nearby when it is not obvious (“Needs at least one photo first.”). |
| Optimistic / stale | Hub photo polling merges stable signed URLs so images do not flash | Do not refetch in a way that blanks photos. Draft dirty vs Saved on listing fields. |
| Destructive | Delete listing; delete photo | Currently `window.confirm` with object named. No undo after delete. |
| Network latency | Join pairing waits ~2s for extension ack; upload progress on photo sections | Show progress or connecting copy; allow retry. |
| Partial failure | AI background results; some models fail | Show per-result errors inside the picker; do not fail the whole listing. |
| Narrow screens | Phone Companion; unlock; join | Single column, large type, full-width primary buttons. |
| Wide screens | Listing hub `lg:grid-cols-[minmax(0,1fr)_13.5rem]` | Sticky QR; do not hide primary fields in the rail. |
| Pop-up blocked | Open marketplace | Explicit error: allow pop-ups, then retry. |

## Rules of thumb

- Cover the states this change can actually enter. A copy tweak on a static heading does not need an empty-state design.
- Never clear a form because save failed.
- Busy labels must not change the action (“Save changes” → “Saving…”, not “Please wait”).
- Empty states point to the real next control, using that control’s exact name.
- Phone and laptop are first-class. Verify both if the flow spans them (QR join, Photo Companion, hub).
