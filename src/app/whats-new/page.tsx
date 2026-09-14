import type { Metadata } from "next";
import Link from "next/link";
import { WhatsNewView } from "@/components/WhatsNewView";
import { WHATS_NEW } from "@/content/whats-new";
import { getSessionFromCookies, isUserSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "What’s new — Reseller Assistant",
  description:
    "Recent changes on the Reseller Assistant website and Chrome helper.",
};

export default async function WhatsNewPage() {
  let signedIn = false;
  try {
    const session = await getSessionFromCookies();
    signedIn = isUserSession(session);
  } catch {
    signedIn = false;
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Reseller Assistant
        </p>
        <h1 className="text-pretty font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
          What’s new
        </h1>
        <p className="text-lg text-[var(--muted)]">
          Website and Chrome helper, together. Newest first.
        </p>
        <p className="text-base text-[var(--muted)]">
          <span className="rounded-lg bg-[var(--accent-soft)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Chrome helper
          </span>{" "}
          marks a change in the optional Chrome add-on.
        </p>
      </header>

      {WHATS_NEW.length > 0 ? (
        <WhatsNewView items={WHATS_NEW} />
      ) : (
        <p className="text-base text-[var(--muted)]">Nothing listed yet.</p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-2 text-base text-[var(--muted)]">
        {signedIn ? (
          <Link
            href="/app"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            ← All listings
          </Link>
        ) : (
          <Link
            href="/unlock"
            className="font-semibold text-[var(--accent)] hover:underline"
          >
            Sign in
          </Link>
        )}
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
