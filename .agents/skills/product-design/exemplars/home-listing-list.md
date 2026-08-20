# Exemplar: home listing list

- **Surface:** Home / listing list
- **User problem:** See every clothing draft and start a new one without a dashboard.
- **Decision:** Page title + one-sentence job; optional extension hint; one primary `Create new listing` (or an inline store chooser if multiple stores); a simple list of bounded rows with thumb, title, marketplace · status, and a separate Delete control.
- **Why it worked:** The primary action is unmistakable. Empty state names that action. Delete cannot be triggered by opening the listing. Thumbnails respect platform aspect.
- **Evidence:** [src/components/AppHome.tsx](../../../../src/components/AppHome.tsx)
- **Reusable principle:** Operational home = title, primary job, list of objects. No KPI row.
- **Do not copy:** `window.confirm` as the long-term dialog standard (coverage gap). Store chooser is a temporary nested panel — don’t nest choosers everywhere. Profile is in-memory, not a URL.
