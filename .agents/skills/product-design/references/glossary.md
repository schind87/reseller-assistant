> Provenance: Local glossary extracted from this repository. Not a Vercel file.

# Glossary

Canonical user-facing terminology. Prefer these strings. Uncertain items are marked.

Do not invent a second word for a listed concept. Code identifiers may differ (e.g. `id_tag` vs “Brand/care tag”).

## Product name

| Term | Notes |
| --- | --- |
| Reseller Assistant | Product name in titles, sign-in, extension. |

## People

| Term | Notes |
| --- | --- |
| Seller | The signed-in user. Copy usually says “you”. |
| Shopper | Buyer on Mercari/Poshmark; appears in photo instructions. |
| Admin | `ADMIN_EMAILS` only. Not a seller-facing word except “Admin” on Profile. |

## Product objects

| Term | Code / notes |
| --- | --- |
| Listing | The draft the seller is building. Home: “Your clothing listings”. Untitled: “{Platform} draft” or hub “Listing Draft”. |
| Clothing listings | Home empty/section copy specifies clothing (apparel-only product). |
| Photo | A shot on a listing. Roles below. |
| Cover photo / Cover shot | Mercari “Cover photo”; Poshmark step title “Cover shot”. `photoRoleLabel`: “Cover”. |
| Front, Back, Detail, Tag, Flaw | Shopper-facing listing roles. |
| Brand/care tag | Identification photos (`brand_tag`, `care_tag`, `id_tag`). Hub section “brand & care tags”. Private by default. |
| Stocking photo | `inventory` role. Private by default; “how this piece looks where you stock it”. |
| Seller preferences / seller profile | Closet defaults. Onboarding title “Tell us about your closet”. Button “Save seller profile”. |
| PIN | 4–8 digit sign-in. “Sign in with PIN”, “Save my PIN”. |
| Email code | OTP. “Send me an email code”. |
| Join code / QR | Phone or extension pairing. QrPanel “Scan with your phone”, “Code:”. |
| Phone Companion | Guided camera on the phone (`photos?phone=1`). Not “the app” on the phone. |
| Chrome helper / Chrome extension | Optional. “Reseller Assistant side panel”. Download “Chrome extension”. |
| AI Photo Lab | Admin only. |
| Workspace | Data model (`workspace_id`); **not** currently a user-facing navigation term. Do not add “workspace switcher” copy without a product decision. |

## Stores / platforms

| Term | Use |
| --- | --- |
| Mercari, Poshmark | `PLATFORM_LABELS`. “Stores you sell on”. |
| Selling website / store | Preferences: “Where will you sell this piece?” |
| Default | Primary store chip: “Default” / “Make default” / “(your usual site)”. |

## Status names (data)

`ListingStatus`: `drafting_photos`, `processing`, `ready`, `posting`, `posted`.

**Uncertain:** UI currently displays `status.replaceAll("_", " ")` (e.g. “drafting photos”). There is no accepted pretty-name map. Do not invent badge labels like “In review” without recording a decision.

## Navigation and screen titles

| Label | Where |
| --- | --- |
| Sign in | Unlock eyebrow |
| Profile / Account | Home profile mode |
| ← All listings | Hub |
| ← Back | Profile → home |
| ← Back to listing hub | Desktop photos QR page |
| Tweak listing fields | Dialog title |
| Write listing with AI | Hub next-action + fields-section button |
| Create new listing | Home primary |
| Sign out | Profile |

## Actions (established)

Create new listing; Sign in; Sign in with PIN; Send me an email code; Save seller profile; Save my PIN; Set PIN / Change PIN; Write listing with AI; Write with AI / Rewrite; Open {Mercari\|Poshmark}; Delete; Close; Done; Copy / Copied; Retry QR join; Retry pairing; Take {role} photo; Add photos on this computer instead.

## Photo aspect (shopper-facing)

- Mercari: “1:1 square”
- Poshmark: “4×3 portrait” (code comment: 3×4 tall)

## Do not use (unless quoting a marketplace)

- Geist, dashboard, workspace switcher, team, billing, deploy
- “Items”, “SKUs”, “products” as the name of a listing
- “Mobile app” for Phone Companion
