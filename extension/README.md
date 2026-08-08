# Reseller Assistant Chrome Extension

Manifest V3 side-panel helper that autofills **Mercari** and **Poshmark** listing pages from [reseller.mvfeed.us](https://reseller.mvfeed.us).

## Install (unpacked)

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder: `extension/` (the one that contains `manifest.json`)
5. Pin **Reseller Assistant** if you want quick access

Click the extension icon to open the side panel.

## Pair with a listing

On [https://reseller.mvfeed.us](https://reseller.mvfeed.us), open a listing and start the extension join flow (QR or 6-digit code / token).

In the side panel:

1. Confirm **App URL** (default `https://reseller.mvfeed.us`)
2. Either:
   - Enter the **6-digit join code**, or
   - **Paste the token** and the **Listing ID**
3. Click **Pair & load listing**

Pairing is saved in `chrome.storage.local` as `{ appUrl, token, listingId }` so you do not need to re-enter it every time.

### How pairing talks to the app

- Join code: `GET {appUrl}/api/extension/pair?joinCode=XXXXXX` → `{ token, listingId }`
- Listing payload: `GET {appUrl}/api/listings/{listingId}/extension` with header `Authorization: Bearer {token}`

## Using the coach

1. Open a Mercari or Poshmark **sell / create / list** page
2. Open the Reseller Assistant side panel
3. Use:
   - **Fill title**
   - **Fill description**
   - **Fill all text fields**
   - **Copy photo download links** (upload photos yourself on the marketplace)
   - **Next step** to move through the coach checklist

### Publish warning

**You press Publish yourself.** This extension never clicks Publish. Review title, description, price, and photos on the marketplace page, then publish manually.

## Supported pages

Content script matches Mercari and Poshmark URLs that look like sell/create/list flows, for example:

- `https://*.mercari.com/.../sell*`
- `https://poshmark.com/.../create*`
- similar `list` / `sell` paths on `*.poshmark.com`

If fill buttons say the content script was not found, navigate to a sell/create page and try again.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, content scripts |
| `background.js` | Opens side panel on toolbar click |
| `sidepanel.html` / `sidepanel.css` / `sidepanel.js` | Pairing UI + listing coach |
| `content.js` | Field fill / highlight on marketplace pages |
