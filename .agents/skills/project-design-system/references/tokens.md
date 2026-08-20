# Tokens

Verified from [src/app/globals.css](../../../../src/app/globals.css) and [src/app/layout.tsx](../../../../src/app/layout.tsx).

Do not add a new font or a parallel color palette for one screen.

## CSS variables (`:root`)

| Token | Value | Role |
| --- | --- | --- |
| `--background` | `#f7f4ef` | Page paper |
| `--foreground` | `#2a2a28` | Ink |
| `--muted` | `#5c5a55` | Supporting text |
| `--accent` | `#1f5c4a` | Primary actions, eyebrows, links |
| `--accent-hover` | `#174636` | Primary hover |
| `--accent-soft` | `#e4efe9` | Success/hint wells, selected chips |
| `--surface` | `#ffffff` | Cards, dialogs, inputs |
| `--surface-muted` | `#efeae2` | Hover wells, dashed admin |
| `--border` | `#ddd6cb` | Default borders |
| `--danger` | `#9b3b2f` | Destructive actions |
| `--font-brand` | Source Serif 4 | `h1`–`h3` |
| `--font-body` | DM Sans | Body / UI |

Tailwind 4 maps some of these via `@theme inline` (`--color-background`, `--color-foreground`, `--color-muted`, `--color-accent`, `--color-border`, `--font-sans`, `--font-serif`). Prefer `text-[var(--foreground)]` / `bg-[var(--accent)]` as the rest of the app does.

## Typography

- Body: `font-family: var(--font-body), system-ui, sans-serif` on `body`; `className="font-sans"` on `<body>`.
- Headings: global `h1,h2,h3` use brand serif. React titles that are not real heading tags still set `font-[family-name:var(--font-brand)]`.
- Common sizes: page `text-4xl`, section `text-2xl`, body `text-base`/`text-lg`, eyebrow `text-sm font-semibold uppercase tracking-wide text-[var(--accent)]`.

## Radius

- Controls: `rounded-xl` (buttons, inputs, banners).
- Objects/dialogs: `rounded-2xl`.
- Compact chips: `rounded-lg`.
- Progress track: `rounded-full` (`StepProgress` only).

## Spacing / touch

- Page padding: `px-4` with `py-8` / `py-10` / `py-12`.
- Section stacks: `gap-8` on home/onboarding; hub `gap-6`/`gap-8`.
- `.touch-target`: `min-height` and `min-width` `3.25rem`.

## Motion

- `.ra-focus-pop` / `ra-focus-pop` 160ms ease-out — used by the photo-role picker. Not a general entrance standard.

## Error banners (de facto, not a CSS variable)

`rounded-xl bg-red-50 px-4 py-3 text-base text-red-800`

See product-design coverage-gaps: this does not use `--danger`.

## Extension tokens

[extension/sidepanel.css](../../../../extension/sidepanel.css): `--bg`, `--surface`, `--ink`, `--muted`, `--border`, `--accent`, `--accent-hover`, `--accent-soft`, `--danger`, `--radius: 12px`, plus warning colors. System font stack. Keep extension changes on those variables; do not import Next fonts into the side panel.
