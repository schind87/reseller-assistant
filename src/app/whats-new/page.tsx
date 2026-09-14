import type { Metadata } from "next";
import Link from "next/link";
import { WhatsNewView } from "@/components/WhatsNewView";
import { WHATS_NEW } from "@/content/whats-new";
import { getChromeHelperStoreChip } from "@/lib/chrome-web-store-status";
import { getSessionFromCookies, isUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "What’s new — Reseller Assistant",
  description:
    "Recent changes on the Reseller Assistant website and Chrome helper.",
};

export const revalidate = 300;

export default async function WhatsNewPage() {
  const sessionPromise = getSessionFromCookies()
    .then((session) => isUserSession(session))
    .catch(() => false);
  const storePromise = getChromeHelperStoreChip();
  const [signedIn, storeStatus] = await Promise.all([
    sessionPromise,
    storePromise,
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            Reseller Assistant
          </p>
          <h1 className="mt-1 text-pretty font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
            What’s new
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Website and Chrome helper. Newest first.
          </p>
        </div>
        {signedIn ? (
          <Link
            href="/app"
            className="shrink-0 text-base font-semibold text-[var(--accent)] hover:underline"
          >
            ← All listings
          </Link>
        ) : (
          <Link
            href="/unlock"
            className="shrink-0 text-base font-semibold text-[var(--accent)] hover:underline"
          >
            Sign in
          </Link>
        )}
      </header>

      {WHATS_NEW.length > 0 ? (
        <WhatsNewView items={WHATS_NEW} storeStatus={storeStatus} />
      ) : (
        <p className="text-base text-[var(--muted)]">
          {signedIn
            ? "No notes yet. Use ← All listings when you are ready."
            : "No notes yet. Use Sign in when you are ready."}
        </p>
      )}

      <p className="text-base text-[var(--muted)]">
        <Link
          href="/privacy"
          className="font-semibold text-[var(--accent)] hover:underline"
        >
          Privacy
        </Link>
      </p>
    </main>
  );
}
