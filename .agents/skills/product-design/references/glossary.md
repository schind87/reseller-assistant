> Provenance: Local glossary extracted from this repository. Not a Vercel file.

# Glossary

Canonical user-facing terminology. Prefer these strings. Uncertain items are marked.

Do not invent a second word for a listed concept. Code identifiers may differ (e.g. `id_tag` vs “Identification tag”).

## Product name

| Term | Notes |
| --- | --- |
| Reseller Assistant | Product name in titles, sign-in, extension. |

## People

| Term | Notes |
| --- | --- |
| Seller | The signed-in user. Copy usually says “you”. |
| Shopper | Buyer on Mercari/Poshmark; appears in photo instructions. |
| Admin | `ADMIN_EMAILS` only. Not a seller-facing word except the admin bar and Users page. |

## Product objects

| Term | Code / notes |
| --- | --- |
| Listing | The draft the seller is building. Home: “Your clothing listings”. Untitled: “{Platform} draft” or hub “Listing Draft”. |
| Clothing listings | Home empty/section copy specifies clothing (apparel-only product). |
| Photo | A shot on a listing. Roles below. |
| Cover photo / Cover shot | Mercari “Cover photo”; Poshmark step title “Cover shot”. `photoRoleLabel`: “Cover”. |
| Front, Back, Detail, Brand/Tag, Flaw | Shopper-facing listing roles. `photoRoleLabel` for `tag` is “Brand/Tag”. |
| Brand/care tag | Identification photos (`brand_tag`, `care_tag`, `id_tag`). Hub section “brand & care tags”. `photoRoleLabel`: “Identification tag”. Private by default; can be moved into listing photos as Brand/Tag. |
| Stocking photo | `inventory` role. Private by default; “how this piece looks where you stock it”. |
| Seller preferences / seller profile | Closet defaults. Onboarding title “Tell us about your closet”. Button “Save seller profile”. |
| PIN | 4–8 digit sign-in. “Sign in with PIN”, “Save my PIN”. |
| Email code | OTP. “Send me an email code”. |
| Join code / QR | Phone or extension pairing. QrPanel “Scan with your phone”, “Code:”. |
| Phone Companion | Guided camera on the phone (`photos?phone=1`). Not “the app” on the phone. |
| Closet | Public Mercari/Poshmark shop. Profile: “Linked closets”. |
| Chrome helper / Chrome extension | Optional. “Reseller Assistant side panel”. Install from the Chrome Web Store when listed; zip remains for Load unpacked. Check listings uses it to read the seller’s closet. |
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

Seller-facing job states (not raw status slugs): Needs photos, Review draft, Ready to post, Post not confirmed (`posting`), Posted. **Mark as posted** is the action for `Post not confirmed`, not a state label.

Untitled home rows use `{Platform} draft` as the title and the job state alone as the subtitle so the marketplace is not repeated.

## Navigation and screen titles

| Label | Where |
| --- | --- |
| Sign in | Unlock eyebrow |
| Profile / Account | Home profile mode |
| Linked closets | Profile section |
| ← All listings | Hub |
| ← Back | Profile → home |
| ← Back to listing hub | Desktop photos QR page |
| Users | Admin users page |
| AI Photo Lab | Admin lab title and admin-bar link |
| Tweak listing fields | Dialog title |
| Fill listing fields with AI | Hub fields-section button |
| Write description with AI / Rewrite description with AI | Hub description control |
| Create new listing | Home primary |
| Sign out | Profile |

## Actions (established)

Create new listing; Sign in; Sign in with PIN; Send me an email code; Email me a code instead; Send again; Save seller profile; Save my PIN; Set PIN / Change PIN; Fill listing fields with AI; Write description with AI / Rewrite description with AI; Open {Mercari\|Poshmark}; Open closet; Find my {Mercari\|Poshmark} closet; Link {Mercari\|Poshmark} closet; Check listings; Unlink; Mark as posted; Clean background; Delete; Close; Done; Copy / Copied; Retry QR join; Retry pairing; Take {role} photo; Add photos on this computer instead.

## Photo aspect (shopper-facing)

- Mercari: “1:1 square”
- Poshmark: “4×3 portrait” (code comment: 3×4 tall)

## Do not use (unless quoting a marketplace)

- Geist, dashboard, workspace switcher, team, billing, deploy
- “Items”, “SKUs”, “products” as the name of a listing
- “Mobile app” for Phone Companion
