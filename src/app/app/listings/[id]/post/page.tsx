"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { CopyField } from "@/components/CopyField";
import { QrPanel } from "@/components/QrPanel";
import {
  PLATFORM_LABELS,
  POSTING_CHECKLIST,
  SELL_PAGE_URLS,
} from "@/lib/platforms";
import type { Listing, Platform } from "@/lib/types";

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [extensionUrl, setExtensionUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        setListing(json.listing);

        const tokenRes = await fetch(
          `/api/listings/${params.id}/join-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ purpose: "extension" }),
          }
        );
        const tokenJson = await tokenRes.json();
        if (tokenRes.ok) {
          setExtensionUrl(tokenJson.url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      }
    }
    if (params.id) void load();
  }, [params.id]);

  async function markPosted() {
    if (!listing) return;
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "posted",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not mark posted");
      setListing(json.listing);
      setDoneMessage("Marked as posted. Nice work.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark posted");
    }
  }

  if (error && !listing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-red-800">
        {error}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-lg text-[var(--muted)]">
        Loading posting checklist…
      </main>
    );
  }

  const platform = listing.platform as Platform;
  const checklist = POSTING_CHECKLIST[platform];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">
      <header>
        <Link
          href={`/app/listings/${listing.id}`}
          className="text-base font-semibold text-[var(--accent)]"
        >
          ← Back to hub
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-brand)] text-4xl">
          Post on {PLATFORM_LABELS[platform]}
        </h1>
        <p className="mt-2 text-lg text-[var(--muted)]">
          Work through the checklist. Copy fields into the site, or pair the
          browser extension.
        </p>
      </header>

      {doneMessage ? (
        <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--accent)]">
          {doneMessage}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <a
        href={SELL_PAGE_URLS[platform]}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <BigButton>Open {PLATFORM_LABELS[platform]} sell page</BigButton>
      </a>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Checklist
        </h2>
        {checklist.map((step) => (
          <label
            key={step.id}
            className="flex cursor-pointer gap-4 rounded-2xl border border-[var(--border)] bg-white p-4"
          >
            <input
              type="checkbox"
              className="mt-1 h-6 w-6 accent-[var(--accent)]"
              checked={Boolean(checked[step.id])}
              onChange={(e) =>
                setChecked((c) => ({ ...c, [step.id]: e.target.checked }))
              }
            />
            <span>
              <span className="block text-lg font-semibold text-[var(--foreground)]">
                {step.label}
              </span>
              <span className="mt-1 block text-base text-[var(--muted)]">
                {step.hint}
              </span>
            </span>
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Copy these
        </h2>
        <CopyField label="Title" value={listing.title ?? ""} />
        <CopyField
          label="Description"
          value={listing.description ?? ""}
          multiline
        />
        <CopyField
          label="Price"
          value={listing.price != null ? String(listing.price) : ""}
        />
        <CopyField
          label="Brand"
          value={listing.structured_fields?.brand ?? ""}
        />
        <CopyField
          label="Size"
          value={listing.structured_fields?.size ?? ""}
        />
        <CopyField
          label="Color"
          value={listing.structured_fields?.color ?? ""}
        />
        <CopyField
          label="Condition"
          value={listing.structured_fields?.condition ?? ""}
        />
        <CopyField label="Pairing code" value={listing.join_code} />
      </section>

      {extensionUrl ? (
        <QrPanel
          value={extensionUrl}
          title="Pair browser extension"
          hint="Scan or paste the pairing code into the Reseller Assistant Chrome extension."
          code={listing.join_code}
        />
      ) : null}

      <div className="flex flex-col gap-3">
        <BigButton
          disabled={listing.status === "posted"}
          onClick={() => void markPosted()}
        >
          {listing.status === "posted" ? "Already posted" : "Mark as posted"}
        </BigButton>
        <Link href={`/app/listings/${listing.id}/review`} className="block">
          <BigButton variant="secondary">Edit draft</BigButton>
        </Link>
      </div>
    </main>
  );
}
