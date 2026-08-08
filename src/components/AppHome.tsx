"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { PLATFORM_LABELS } from "@/lib/platforms";
import type { Listing, Platform } from "@/lib/types";

type AppHomeProps = {
  initialListings: Listing[];
};

export function AppHome({ initialListings }: AppHomeProps) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startListing(platform: Platform) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create listing");
      setListings((prev) => [json.listing, ...prev]);
      router.push(`/app/listings/${json.listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create listing");
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/unlock");
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
            Reseller Assistant
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            One listing at a time. Start on this screen, then use your phone for
            photos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-base font-semibold text-[var(--muted)]"
        >
          Sign out
        </button>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      {!choosing ? (
        <BigButton disabled={busy} onClick={() => setChoosing(true)}>
          Start new listing
        </BigButton>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Where will you sell it?
          </h2>
          <BigButton
            disabled={busy}
            onClick={() => void startListing("mercari")}
          >
            Mercari
          </BigButton>
          <BigButton
            disabled={busy}
            onClick={() => void startListing("poshmark")}
          >
            Poshmark
          </BigButton>
          <BigButton
            variant="ghost"
            disabled={busy}
            onClick={() => setChoosing(false)}
          >
            Cancel
          </BigButton>
        </div>
      )}

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-brand)] text-2xl">
          Your listings
        </h2>
        {listings.length === 0 ? (
          <p className="text-base text-[var(--muted)]">
            No listings yet. Tap Start new listing when you are ready.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <Link
                  href={`/app/listings/${listing.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-white px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {listing.title ||
                      `${PLATFORM_LABELS[listing.platform]} draft`}
                  </p>
                  <p className="mt-1 text-base capitalize text-[var(--muted)]">
                    {PLATFORM_LABELS[listing.platform]} ·{" "}
                    {listing.status.replaceAll("_", " ")}
                    {listing.join_code ? ` · ${listing.join_code}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
