# Layout

Verified page shells. Do not invent a marketing max-width.

| Context | Container | Evidence |
| --- | --- | --- |
| Sign-in, join | `max-w-md`, centered column, `px-4 py-12`/`py-16` | `UnlockForm`, `JoinTokenClient` |
| Desktop photos QR | `max-w-lg` | `photos/page.tsx` |
| Home, onboarding, profile | `max-w-2xl`, `flex flex-col gap-8 px-4 py-10` | `AppHome`, `SellerOnboarding` |
| Listing hub | `max-w-6xl`, `px-4 py-8`, `lg:grid-cols-[minmax(0,1fr)_13.5rem]` | `ListingHub` |
| Admin users | `max-w-4xl`, `px-4 py-10` | `AdminUsersConsole` |
| Loading fallback | Same width family, muted `text-lg` | listing page Suspense |

Root: [src/app/layout.tsx](../../../../src/app/layout.tsx) — `min-h-full flex flex-col font-sans` on body, `h-full antialiased` on html. Admins get a sticky `AdminBar`; sellers have no shared navbar.

Links are globally `color: inherit; text-decoration: none` in `globals.css`. Accent links set `text-[var(--accent)]` (and sometimes `hover:underline`) locally.
