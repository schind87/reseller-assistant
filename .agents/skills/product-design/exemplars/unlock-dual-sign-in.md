# Exemplar: dual-path sign-in

- **Surface:** Sign-in (`/unlock`)
- **User problem:** Sellers need to get into the closet workflow quickly, sometimes without mail apps handy, sometimes without a PIN yet.
- **Decision:** One email field; PIN as the fast path when they have one; email code as an explicit alternative separated by “— or —”. Remember-email is a checkbox, not a second product.
- **Why it worked:** Primary task (authenticate) is obvious. Busy labels keep meaning (`Checking…`, `Sending…`). Errors and hints use the standard banners. OTP fields appear only after a code is sent.
- **Evidence:** [src/app/unlock/unlock-form.tsx](../../../../src/app/unlock/unlock-form.tsx)
- **Reusable principle:** Two complete methods can share context (email) without becoming a settings page. Hide the second method’s extra fields until needed.
- **Do not copy:** Centered marketing-hero spacing as a template for the listing hub. Native browser validation plus custom banners together can double up — don’t add a third error channel.
