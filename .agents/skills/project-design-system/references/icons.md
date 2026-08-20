# Icons

There is **no icon package** in `package.json`.

Verified glyphs:

| Name | Source | Use |
| --- | --- | --- |
| `AiGlyph` | `AiPhotoBackgroundPicker.tsx` | AI affordance on buttons |
| Thumbs up/down SVGs | `AiPhotoBackgroundPicker` / `AiBgDebugConsole` | Rating AI results |
| QR | `qrcode.react` `QRCodeSVG` | `QrPanel` only |

Do not add lucide-react / heroicons / font-awesome to match “standard SaaS”. If a new glyph is required, inline SVG with `aria-hidden` (decorative) or a text label (meaningful). Accessible name stays in copy (`aria-label`).
