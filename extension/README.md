# Reseller Assistant Chrome Extension

Manifest V3 helper that autofills **Mercari** and **Poshmark** listing pages from Reseller Assistant.

## Install (unpacked)

1. From the repo root: `npm run extension:live`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Select **`extension-live/`**

After code changes: run `npm run extension:live`, then **Reload extension** in the side panel.

## Easy posting flow

1. Open a listing **Post checklist** in the web app (pairs the extension automatically).
2. Tap **Open Mercari/Poshmark sell page**.
3. On that page, use the green **Reseller Assistant** box in the corner:
   - **Do this for me** — photos, title, description, then other details
   - After a successful fill, it checks the page and moves to the next step
   - On Poshmark, **brand** and **style tags** show a green tip instead of auto-fill — type and pick from the site’s suggestions
   - **Tweak listing fields** opens a large app editor popup (save there; closing refreshes the listing)
   - Use **Back** if you need to redo a step
4. When it says to review, check the form and press **List / Publish** yourself.

The side panel mirrors the same steps if you prefer tapping there.

## Pairing

- Automatic from the Post checklist page
- Or paste a join link / 6-digit code in the side panel

Stored in `chrome.storage.local` as `{ appUrl, token, listingId, listingCache, stepIndex }`.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest |
| `coach-shared.js` | Shared step definitions |
| `background.js` | Pairing, listing cache, coach actions |
| `bridge.js` | Web app → extension pairing |
| `page-coach.js` | On-page helper UI (shadow DOM) |
| `content.js` | Field fill + photo attach |
| `sidepanel.*` | Pairing + mirror of coach |

Source of truth is `extension/`. Load Chrome from **`extension-live/`**.
