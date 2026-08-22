# Exemplar: device-aware sign-in

- **Surface:** Sign-in (`/unlock`)
- **User problem:** Sellers need the method that can succeed on this device, without two equal authentication paths.
- **Decision:** Email code is the default primary. PIN appears only when this browser remembers that the email has a PIN. Recovery is `Email me a code instead` (`BigButton` `ghost`). Remember-email is a checkbox, not a session.
- **Why it worked:** One primary action. PIN is hidden until it can be the fast path. OTP extra fields appear only after a code is sent. Busy labels keep meaning (`Checking…`, `Sending…`).
- **Evidence:** [src/app/unlock/unlock-form.tsx](../../../../src/app/unlock/unlock-form.tsx), [src/lib/remembered-identity.ts](../../../../src/lib/remembered-identity.ts)
- **Reusable principle:** Two methods can share email without becoming a settings page. Hide the second method’s extra fields until needed. Local `hasPin` is a UI hint, never authentication.
- **Do not copy:** Two primary `BigButton`s plus “— or —”. Centered marketing-hero spacing as a template for the listing hub. Native browser validation plus custom banners together can double up — don’t add a third error channel.
