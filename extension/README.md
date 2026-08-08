# Reseller Assistant Chrome Extension

Manifest V3 side-panel helper that autofills **Mercari** and **Poshmark** listing pages from Reseller Assistant.

## Install (unpacked) — recommended for development

1. From the repo root, run:

```bash
npm run extension:live
```

2. Open Chrome → `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Select **`extension-live/`** in this repo (always mirrored from `extension/`)

`npm run dev` also refreshes `extension-live` before starting Next.js.

After pulling code changes: run `npm run extension:live`, then click **Reload extension** at the bottom of the side panel.

## Pairing (automatic)

With the extension loaded:

1. Open a listing **Post checklist** in the web app — the page pushes the pairing to the extension and opens the side panel when possible.
2. Or open / scan the extension QR / join link (`?purpose=extension`).
3. Or paste a 6-digit code or join URL into the side panel (auto-pairs as you paste).

Pairing is saved in `chrome.storage.local` as `{ appUrl, token, listingId }`.

### How pairing talks to the app

- Join code: `GET {appUrl}/api/extension/pair?joinCode=XXXXXX` → `{ token, listingId }`
- Join token: `GET {appUrl}/api/extension/pair?token=...` → `{ token, listingId }`
- Listing payload: `GET {appUrl}/api/listings/{listingId}/extension` with header `Authorization: Bearer {token}`
- Web → extension bridge: `window.postMessage` handled by `bridge.js` on app origins

## Using the coach

1. Open a Mercari or Poshmark **sell / create / list** page
2. Open the Reseller Assistant side panel
3. Use:
   - **Fill title / description / all text fields**
   - **Attach photos to this page** (downloads your listing photos and drops them into the marketplace file picker)
   - **Sync form fields**
   - **Copy photo download links** (fallback)
   - **Next step** checklist

### Photo upload (recommended)

1. Pair the extension with a listing that has listing photos
2. Open the marketplace sell form’s photo step
3. Click **Attach photos to this page**

If the site only accepts one file at a time, attach what you can, then use **Download listing photos ZIP** from the web Post checklist for the rest.

### Publish warning

**You press Publish yourself.** This extension never clicks Publish.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, content scripts |
| `background.js` | Side panel, apply pairing, badge, reload |
| `bridge.js` | Receives pairing from the web app |
| `sidepanel.html` / `sidepanel.css` / `sidepanel.js` | Pairing UI + listing coach + photo attach |
| `content.js` | Field fill, photo attach, highlight on marketplace pages |

Source of truth is `extension/`. Load Chrome from **`extension-live/`**.
