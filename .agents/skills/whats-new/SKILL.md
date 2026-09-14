# What’s new notes

Keep [src/content/whats-new.ts](../../../src/content/whats-new.ts) current when
you ship something sellers can see on the website or in the Chrome helper.

This is the process. There is no in-app agent screen.

## When to load

Any user-visible change: listing hub, home, Profile, Phone Companion, sign-in,
admin Users, Chrome helper fill/closet, or copy sellers read.

Skip: tests only, telemetry, generated `extension-live/` / `.next/`, docs that
are not the What’s new page.

## What to do in the same ship

1. Add a new item at the **top** of `WHATS_NEW` (newest first).
2. Plain language. Short title. One or two sentences. Bullets only if they
   help someone scan. No jargon (“pipeline”, “seamless”, version dumps).
3. Set `helper: true` when the Chrome helper is involved. Do not make a second
   page for the helper.
4. If a screenshot helps, copy it into `public/whats-new/` and add a
   `screenshots` entry (`src`, `alt`, `label`). The page shows photo wells
   that open an in-page lightbox. **Do not** link a raw image URL, and **do
   not** link Project `internal/` paths.
5. Reuse existing product words: listing, Chrome helper, Phone Companion,
   Linked closets, Check listings, All listings, Users.

## What the page is

- Route: `/whats-new`
- One list for website + helper
- Public, like `/privacy`
- Chrome helper notes may show a Store status well from `fetchStatus` (live
  `CHROME_WEB_STORE_*` or `src/content/chrome-store-status.json`). Do not type a
  version or “in review” by hand. Snapshot-only commits are not a notes ship.

## How notes stay updated (durable)

Three layers. Use all of them; do not invent a fake UI.

### 1. This skill (agents in Cursor)

When you ship user-visible work, you update the notes in the same commit.
`AGENTS.md` points here. `.cursor/rules/whats-new.mdc` reminds you on matching
files.

### 2. GitHub Action

[`.github/workflows/whats-new.yml`](../../../.github/workflows/whats-new.yml)
runs on push to `main` (and **What’s new notes** from the Actions tab).

- `npm run whats-new:check` looks at files in the push.
- User-facing code without a `whats-new` update → the job tries to write the
  note.
- If `CURSOR_API_KEY` is set (repo secret), it runs Cursor CLI with
  [automation-prompt.md](automation-prompt.md) and commits to `main`.
- If that secret is missing, the check **fails** with a pointer here so the
  ship is not silently undocumented.

Skip when the push only touched notes files, or did not touch seller-facing
paths.

### 3. Cursor automation (optional, same prompt)

Create once at [cursor.com/automations](https://cursor.com/automations):

- Trigger: **Push to branch** → `main` on `schind87/reseller-assistant`
- Instructions: paste [automation-prompt.md](automation-prompt.md)
- Commit and push to **`main`**. Do **not** open a pull request (this repo’s
  AGENTS.md).
- Do nothing if the push already updated `src/content/whats-new.ts` or only
  touched notes files.

The GitHub Action is the in-repo runner. The Cursor automation is the same
job when you want it on push without waiting on `CURSOR_API_KEY`.

## Local check

```bash
npm run whats-new:check
# or against a range:
node scripts/check-whats-new.mjs --base HEAD~1 --head HEAD
```
