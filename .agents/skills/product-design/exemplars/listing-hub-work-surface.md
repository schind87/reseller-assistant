# Exemplar: listing hub as work surface

- **Surface:** Listing hub (`/app/listings/[id]`)
- **User problem:** One piece: get photos in, optionally run AI, edit Mercari/Poshmark fields, open the sell page. Laptop and phone share the listing.
- **Decision:** Wide operational layout: photos (sectioned by job), Write listing with AI, inline listing fields, sticky QR rail for Phone Companion. Header is typography (platform · status, title, job sentence). `← All listings` lives in that sticky rail above the QR; a cover photo, once uploaded, pins a small copy under the QR card. AI is a section with a disabled state when there are no photos. Private tag shots sit in `<details>`.
- **Why it worked:** Information architecture follows the job, not a generic admin template. QR is an entry point, not a nav sidebar. Density is high enough to work; type stays large.
- **Evidence:** [src/components/ListingHub.tsx](../../../../src/components/ListingHub.tsx)
- **Reusable principle:** For a work surface, sequence the real steps on one page; hide optional/private complexity; keep the phone path visible on desktop.
- **Do not copy:** File length or one-off photo DnD as a requirement for smaller screens. Admin model picker dashed well is admin-only. Status string formatting is a coverage gap. Do not turn the QR rail into app-wide chrome.
