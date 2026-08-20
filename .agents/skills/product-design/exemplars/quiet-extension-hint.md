# Exemplar: quiet Chrome helper

- **Surface:** Optional tool disclosure
- **User problem:** Posting is easier with the extension, but most visits are about creating listings and photos. A missing extension must not look like a failed install or a paywall.
- **Decision:** Render nothing while checking or installed. If missing, a dashed, transparent, collapsed line: “Optional: install the Chrome helper” with Show/Hide. Expanded copy states the helper fills fields and attaches photos; the seller still publishes.
- **Why it worked:** Primary CTA remains Create new listing. Local vs production install steps stay inside the disclosure.
- **Evidence:** [src/components/ExtensionInstallCard.tsx](../../../../src/components/ExtensionInstallCard.tsx)
- **Reusable principle:** Optional infrastructure stays visually quieter than the seller’s job.
- **Do not copy:** Dashed optional chrome for **required** steps (photos, sign-in).
