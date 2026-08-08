# Live unpacked extension

This folder is the Chrome **Load unpacked** target for local development.

Refresh it from `extension/` anytime:

```bash
npm run extension:live
```

`npm run dev` also runs that sync before starting Next.js.

## Chrome setup

1. `chrome://extensions` → Developer mode on
2. **Load unpacked** → select this `extension-live` folder
3. After code changes: `npm run extension:live`, then **Reload extension** at the bottom of the side panel

Source of truth remains [`extension/`](../extension/). Do not edit files here by hand — they are overwritten by the sync script.
