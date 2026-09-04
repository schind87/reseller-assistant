# Chrome Web Store listing

Paste these into https://chrome.google.com/webstore/devconsole after uploading
`dist/reseller-assistant-chrome.zip`.

Privacy policy URL (must be live before review):
https://reseller.mvfeed.us/privacy

Support / homepage:
https://reseller.mvfeed.us

Category: Shopping (or Productivity)

## Short description (≤132 characters)

Fill Mercari and Poshmark sell forms from Reseller Assistant. You still press Publish.

## Detailed description

Reseller Assistant helps clothing sellers list one piece at a time on Mercari and Poshmark.

This Chrome helper:

• Fills the sell form from a listing you already wrote in Reseller Assistant (photos, title, description, and other details).
• You still review the form and press List or Publish yourself.
• On Profile, Find my closet and Check listings read the closet you are signed into so those live listings show up in Reseller Assistant.

It does not log in to Mercari or Poshmark for you. It does not read your store password. It only runs on Reseller Assistant, Mercari, and Poshmark.

Install, sign in at reseller.mvfeed.us, open a listing, then tap Open Mercari or Open Poshmark.

## Single purpose

Help a Reseller Assistant seller post and check clothing listings on Mercari and Poshmark.

## Permission justifications

storage — Save the current listing pairing on this computer.
sidePanel — Show the listing helper beside the sell form.
scripting — Inject the helper on Mercari and Poshmark sell and closet pages if the page loaded before the content script.

Host permissions:
• reseller.mvfeed.us and reseller-assistant.vercel.app — Pair the helper and load listing photos from the app.
• mercari.com and poshmark.com — Fill the sell form you asked it to fill, and read closet cards after Find my closet or Check listings.

## Privacy practices (dashboard)

- Collects personally identifiable information: Yes (email on the website; closet username you link)
- Collects user activity: No (not browsing history)
- Collects website content: Yes — sell-form fields we write, and closet listing cards when you ask
- Collects web history: No
- Remote code: No
- Sold to third parties: No
- Used for credit-worthiness: No
- Transfer certification: Limited Use

Data types: Personal communications (email sign-in); User activity is only the listings you save in the app; Website content from Mercari/Poshmark only after an explicit action.

## Images (upload these in the dashboard)

Regenerate with `npm run extension:store-images`. Files live in [`extension/store-assets/`](store-assets/) and are **not** inside the zip.

| Dashboard field | File | Size |
| --- | --- | --- |
| Store icon (also shipped in the zip as `icons/icon-128.png`) | `store-icon-128.png` | 128×128 PNG, 16px transparent padding |
| Screenshots (at least one) | `screenshot-1280x800.png` | 1280×800, square corners, no padding |
| Small promotional tile (required) | `promo-440x280.png` | 440×280 |

Do not upload `screenshot.html`. That file is only the capture source.
