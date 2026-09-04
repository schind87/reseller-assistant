# Reseller Assistant Chrome Extension

Manifest V3 helper that autofills **Mercari** and **Poshmark** listing pages from Reseller Assistant, finds your closet name from **Find my closet**, and reads listings from **Check listings**.

## Install (unpacked)

### From this repo (local dev)

1. From the repo root: `npm run extension:live`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Select **`extension-live/`**

After code changes: run `npm run extension:live`, then **Reload extension** in the side panel.

### From the app download (Mac / Chrome)

1. Download the zip from the web app, then unzip it (double-click in Finder).
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Select the **`reseller-assistant-extension`** folder that contains `manifest.json` (not a parent Downloads folder).

If Chrome says it could not load `coach-shared.js` (or the manifest), the folder is incomplete — re-download and load the folder that includes every file listed under **Files** below.

## Easy posting flow

1. Open a listing in the web app and tap **Open Mercari** / **Open Poshmark** (pairs the extension and opens the sell page in a new tab).
2. Keep the listing tab open; on the **sell / create-listing** page the **Reseller Assistant** helper stays in a sidebar beside the form (it stays hidden on other Mercari/Poshmark pages):
   - **Do this for me** — photos, title, description, then other details
   - After a successful fill, it checks the page and moves to the next step
   - On Poshmark, **brand** and **style tags** show a tip in the form above those fields — type and pick from the site’s suggestions
   - **Tweak listing fields** opens a large app editor popup (save there; closing refreshes the listing)
   - Use **Back** if you need to redo a step
3. When it says to review, check the form and press **List / Publish** yourself.

The Chrome side panel mirrors the same steps if you prefer tapping there.

## Pairing

- Automatic when you open the marketplace from the listing hub
- Or paste a join link / 6-digit code in the side panel

Stored in `chrome.storage.local` as `{ appUrl, token, listingId, listingCache, stepIndex }`.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `coach-shared.js` | Shared step definitions |
| `closet-sync.js` | Reads listing cards on closet / my listings pages |
| `background.js` | Pairing, listing cache, coach actions, closet check |
| `bridge.js` | Web app → extension pairing and closet check |
| `page-coach.js` | On-page listing sidebar (shadow DOM) |
| `content.js` | Field fill + photo attach + closet extract |
| `sidepanel.*` | Pairing + mirror of coach |

Source of truth is `extension/`. Load Chrome from **`extension-live/`**.
