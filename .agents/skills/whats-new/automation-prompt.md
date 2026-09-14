Update What’s new for this ship.

Read `.agents/skills/whats-new/SKILL.md` and `src/content/whats-new.ts`.

If this push already added a matching item to `src/content/whats-new.ts`, or
the diff is only notes / docs / CI / tests, stop. Do not open a pull request.

If sellers can see a website or Chrome helper change and it is not on
`/whats-new` yet:

1. Add one item at the top of `WHATS_NEW` (newest first, `date` as YYYY-MM-DD).
2. Plain language. Short title and body. `helper: true` when the Chrome helper
   is involved.
3. Screenshots belong in `public/whats-new/` and open in the in-page lightbox
   (`label` + `alt`). Never link a raw image URL or anything under `internal/`.
4. Commit and push directly to `main`. Do not create a branch or pull request.
   Message like: `Add What’s new notes for <short change>.`

Do not restyle the page. Do not add an agent dashboard. Do not invent features
that were not in the diff.
