# Chrome Web Store listing

## Publish from CI

Release path: push helper changes to `main` (bump `manifest.json` `version` first) → GitHub Actions packs `dist/reseller-assistant-chrome.zip` → a GitHub Release (`chrome-helper-v*`) gets that zip for Load unpacked while review is pending → if secrets are set, the same zip is uploaded and submitted for review.

| Automatic | Still you / Google |
| --- | --- |
| Pack the production zip (no localhost hosts) | Create the listing **once** in the [developer console](https://chrome.google.com/webstore/devconsole) (this copy, screenshots, privacy practices) |
| GitHub Release of that zip for local Load unpacked | Unzip the release and Load unpacked while review is pending; turn off the store install so you are not running two helpers |
| Upload a new version and submit it for review | Google review and approval before sellers see the update |
| Attach the zip as a GitHub Actions artifact | 2-step verification on the publisher Google account |
| Skip the CWS upload (do not fail the job) until secrets exist | Paste the secrets below into GitHub once |

App deploy stays on Vercel. Store credentials stay in GitHub Actions secrets — never the repo. Do not put them on Vercel unless you want `/whats-new` to call `fetchStatus` live (same names as below). Otherwise that page reads `src/content/chrome-store-status.json`, which GitHub Action **Chrome helper Store status** refreshes from `fetchStatus`.

### GitHub Actions secrets (add once)

Repo **Settings → Secrets and variables → Actions**:

| Secret | What it is |
| --- | --- |
| `CHROME_WEB_STORE_CLIENT_ID` | OAuth client ID from Google Cloud |
| `CHROME_WEB_STORE_CLIENT_SECRET` | OAuth client secret |
| `CHROME_WEB_STORE_REFRESH_TOKEN` | Offline refresh token for the publisher account |
| `CHROME_WEB_STORE_EXTENSION_ID` | Store item id (also set `NEXT_PUBLIC_CHROME_WEB_STORE_ID` on Vercel so Profile can link **Add from the Chrome Web Store**) |
| `CHROME_WEB_STORE_PUBLISHER_ID` | Publisher id from Developer Dashboard → Publisher → Settings |

Local publish reads the same names from the environment (`npm run extension:publish`). Use `--no-publish` to upload a draft only, `--require` to fail if a secret is missing.

### One-time OAuth (publisher Google account)

1. [Chrome Web Store API](https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com) — enable it on a Google Cloud project.
2. OAuth consent screen: External, add the publisher Gmail as a test user.
3. Credentials → OAuth client ID → **Web application**. Authorized redirect URI: `https://developers.google.com/oauthplayground`.
4. [OAuth Playground](https://developers.google.com/oauthplayground) → gear → **Use your own OAuth credentials** → scope `https://www.googleapis.com/auth/chromewebstore` → authorize as the CWS publisher → **Exchange authorization code for tokens**. Copy the refresh token into `CHROME_WEB_STORE_REFRESH_TOKEN`.
5. After the first listing exists in the console, copy the item id and publisher id into the secrets above.

Until those five secrets are set, CI still packs the zip; download it from the workflow artifact and upload it in the console if you need a release today.

### What’s new Store status

`/whats-new` shows a small chip next to Chrome helper notes from Chrome Web Store `fetchStatus` (`GET …/v2/publishers/{publisherId}/items/{extensionId}:fetchStatus`). It never guesses a version or review state.

1. If `CHROME_WEB_STORE_*` is set on the Next.js process, the page fetches live (cached ~5 minutes).
2. Else it uses `src/content/chrome-store-status.json` when that file has a real `fetchedAt` from CI.
3. If neither is available, the chip is omitted.

Refresh the snapshot: `npm run chrome-store:status` (skips when secrets are missing). GitHub Action **Chrome helper Store status** runs that script on a schedule, after helper store jobs, and when the script/workflow changes.

## Listing copy (console)

Paste these into https://chrome.google.com/webstore/devconsole after the first zip
upload (later versions are uploaded by CI).

Privacy policy URL (must be live before review):
https://reseller.mvfeed.us/privacy

What’s new (website + helper):
https://reseller.mvfeed.us/whats-new

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
