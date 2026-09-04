import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Reseller Assistant",
  description:
    "How Reseller Assistant and the Chrome helper use listing and closet data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Reseller Assistant
        </p>
        <h1 className="font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          Privacy
        </h1>
        <p className="text-base text-[var(--muted)]">Updated September 4, 2026</p>
      </header>

      <p className="text-base text-[var(--foreground)]">
        This page covers the website at reseller.mvfeed.us and the Chrome helper
        named Reseller Assistant. The helper only runs when you install it and
        use it with this product.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          What the Chrome helper does
        </h2>
        <p className="text-base text-[var(--foreground)]">
          It fills Mercari and Poshmark sell forms from a listing you already
          created in Reseller Assistant. You still press List or Publish on the
          store. On Profile, Find my closet and Check listings read the closet
          page you are signed into in Chrome so we can show those live listings
          in Reseller Assistant.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Data the helper uses
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-base text-[var(--foreground)]">
          <li>
            A short-lived listing join token, the listing id, and a cache of
            title, description, fields, and photo ids — stored in{" "}
            <code className="text-sm">chrome.storage.local</code> on this
            computer so the helper can fill the form.
          </li>
          <li>
            Public closet cards (title, price, thumbnail, listing URL, and
            store listing id) when you tap Find my closet or Check listings.
            Those rows are saved on your Reseller Assistant account.
          </li>
          <li>
            Listing photos, fetched from Reseller Assistant over HTTPS when you
            add photos to a sell form. The helper does not receive Mercari or
            Poshmark file-storage links.
          </li>
        </ul>
        <p className="text-base text-[var(--foreground)]">
          The helper does not read your Mercari or Poshmark password, payment
          details, Chrome history, or other websites. It does not sell data or
          use it for advertising.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Account data on the website
        </h2>
        <p className="text-base text-[var(--foreground)]">
          When you sign in we store your email, optional PIN hash, seller
          preferences, listings, photos, and linked closet usernames. Sign-in
          codes go to your email. Photos are stored privately (Cloudflare R2 or
          Supabase Storage) and loaded with signed links in the app.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Where data is sent
        </h2>
        <p className="text-base text-[var(--foreground)]">
          Helper traffic stays on HTTPS to reseller.mvfeed.us (or
          reseller-assistant.vercel.app). Mercari and Poshmark pages stay in
          your browser; the helper only writes into the sell form you asked it
          to fill, or reads closet cards after you ask it to.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          How long we keep it
        </h2>
        <p className="text-base text-[var(--foreground)]">
          Listing and closet data stay until you delete the listing, unlink the
          closet, or delete your account. The helper cache clears when you
          disconnect the listing or remove the helper from Chrome.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Your choices
        </h2>
        <p className="text-base text-[var(--foreground)]">
          Uninstall the helper in chrome://extensions. Sign out or delete
          listings in Reseller Assistant. To delete an account, email{" "}
          <a
            className="font-semibold text-[var(--accent)] hover:underline"
            href="mailto:schind87@gmail.com"
          >
            schind87@gmail.com
          </a>
          .
        </p>
      </section>

      <p className="text-base text-[var(--muted)]">
        <Link href="/unlock" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
