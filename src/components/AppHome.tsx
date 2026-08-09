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
  type ListingPreferences,
} from "@/lib/seller-preferences";
import type { Listing, Platform } from "@/lib/types";

function preferredSellingWebsite(
  preferences: ListingPreferences | null
): Platform {
  return preferences?.sellingWebsite ?? "mercari";
}

type AppHomeProps = {
  initialListings: Listing[];
  preferencesCompleted: boolean;
  initialPreferences: ListingPreferences | null;
  userEmail?: string | null;
  isAdmin?: boolean;
};

export function AppHome({
  initialListings,
  preferencesCompleted,
  initialPreferences,
  userEmail = null,
  isAdmin = false,
}: AppHomeProps) {
  const router = useRouter();
  const [listings, setListings] = useState(initialListings);
  const [prefsDone, setPrefsDone] = useState(preferencesCompleted);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [editingPrefs, setEditingPrefs] = useState(!preferencesCompleted);
  const [showProfile, setShowProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function deleteListing(listingId: string, label: string) {
    const confirmed = window.confirm(
      `Delete “${label}”? Photos for this listing will be removed too.`
    );
    if (!confirmed) return;

    setDeletingId(listingId);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not delete listing"
        );
      }
      setListings((prev) => prev.filter((listing) => listing.id !== listingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete listing");
    } finally {
      setDeletingId(null);
    }
  }

  function enabledStores(): Platform[] {
    if (preferences?.sellingWebsites?.length) {
      return preferences.sellingWebsites;
    }
    return ["mercari", "poshmark"];
  }

  function createNewListing() {
    const stores = enabledStores();
    if (stores.length === 1) {
      void startListing(stores[0]);
      return;
    }
    setChoosing(true);
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
          setShowProfile(false);
        }}
        onCancel={
          prefsDone
            ? () => {
                setEditingPrefs(false);
                setShowProfile(true);
              }
            : undefined
        }
      />
    );
  }

  if (showProfile) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
              Account
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
              Profile
            </h1>
            {userEmail ? (
              <p className="mt-2 text-lg text-[var(--muted)]">{userEmail}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setShowProfile(false)}
            className="text-base font-semibold text-[var(--accent)]"
          >
            ← Back
          </button>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Seller preferences
          </h2>
          <p className="text-base text-[var(--muted)]">
            Choose the stores you sell on, then keep your closet details up to
            date.
          </p>
          <SellerOnboarding
            compact
            editing
            initial={preferences}
            onSaved={(prefs) => {
              setPreferences(prefs);
              setPrefsDone(true);
            }}
          />
        </section>

        <PinSetupCard />

        {isAdmin ? (
          <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Admin
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Compare fal.ai background removers on any listing photo.
            </p>
            <Link
              href="/app/admin/bg-lab"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-base font-semibold text-[var(--accent)] hover:underline"
            >
              Open background model lab →
            </Link>
          </section>
        ) : null}

        <BigButton variant="ghost" onClick={() => void logout()}>
          Sign out
        </BigButton>
      </main>
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
          onClick={() => setShowProfile(true)}
          className="shrink-0 rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-base font-semibold text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          Profile
        </button>
      </header>

      <ExtensionInstallCard />

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      {!choosing ? (
        <BigButton disabled={busy} onClick={() => createNewListing()}>
          {busy ? "Starting…" : "Create new listing"}
        </BigButton>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-5">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Where will you sell this piece?
          </h2>
          {enabledStores().map((platform) => {
            const preferred = preferredSellingWebsite(preferences) === platform;
            return (
              <BigButton
                key={platform}
                disabled={busy}
                onClick={() => void startListing(platform)}
              >
                {PLATFORM_LABELS[platform]}
                {preferred ? " (your usual site)" : ""}
              </BigButton>
            );
          })}
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
            No clothing listings yet. Tap Create new listing when you are ready.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {listings.map((listing) => {
              const label =
                listing.title ||
                `${PLATFORM_LABELS[listing.platform]} draft`;
              return (
                <li
                  key={listing.id}
                  className="flex items-stretch gap-2 rounded-2xl border border-[var(--border)] bg-white"
                >
                  <Link
                    href={`/app/listings/${listing.id}`}
                    className="min-w-0 flex-1 px-5 py-4 transition-colors hover:bg-[var(--surface-muted)]"
                  >
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {label}
                    </p>
                    <p className="mt-1 text-base capitalize text-[var(--muted)]">
                      {PLATFORM_LABELS[listing.platform]} ·{" "}
                      {listing.status.replaceAll("_", " ")}
                    </p>
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === listing.id}
                    onClick={() => void deleteListing(listing.id, label)}
                    className="shrink-0 px-4 text-base font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Delete ${label}`}
                  >
                    {deletingId === listing.id ? "…" : "Delete"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
