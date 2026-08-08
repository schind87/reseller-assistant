"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { ExtensionInstallCard } from "@/components/ExtensionInstallCard";
import { PinSetupCard } from "@/components/PinSetupCard";
import { SellerOnboarding } from "@/components/SellerOnboarding";
import { PLATFORM_LABELS } from "@/lib/platforms";
import {
  composeSmokePetNotes,
  type ListingPreferences,
} from "@/lib/seller-preferences";
import type { Listing, Platform } from "@/lib/types";

type AppHomeProps = {
  initialListings: Listing[];
  preferencesCompleted: boolean;
  initialPreferences: ListingPreferences | null;
};

export function AppHome({
  initialListings,
  preferencesCompleted,
  initialPreferences,
}: AppHomeProps) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [prefsDone, setPrefsDone] = useState(preferencesCompleted);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [editingPrefs, setEditingPrefs] = useState(!preferencesCompleted);
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

  if (editingPrefs || !prefsDone) {
    return (
      <SellerOnboarding
        initial={preferences}
        editing={prefsDone}
        onSaved={(prefs) => {
          setPreferences(prefs);
          setPrefsDone(true);
          setEditingPrefs(false);
        }}
        onCancel={
          prefsDone
            ? () => {
                setEditingPrefs(false);
              }
            : undefined
        }
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
            Reseller Assistant
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Clothing listings for Mercari and Poshmark — one piece at a time.
            Start here, then use your phone for garment photos.
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

      <PinSetupCard />

      <ExtensionInstallCard />

      {preferences ? (
        <section className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-[family-name:var(--font-brand)] text-2xl">
                Seller profile
              </h2>
              <p className="mt-2 text-base text-[var(--muted)]">
                {composeSmokePetNotes(preferences)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingPrefs(true)}
              className="text-base font-semibold text-[var(--accent)]"
            >
              Edit
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      {!choosing ? (
        <BigButton disabled={busy} onClick={() => setChoosing(true)}>
          List a clothing item
        </BigButton>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Where will you sell this piece?
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
          Your clothing listings
        </h2>
        {listings.length === 0 ? (
          <p className="text-base text-[var(--muted)]">
            No clothing listings yet. Tap List a clothing item when you are
            ready.
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
