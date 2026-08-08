"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BigButton } from "@/components/BigButton";
import { QrPanel } from "@/components/QrPanel";
import { PLATFORM_LABELS } from "@/lib/platforms";
import type {
  IdentifiedAttrs,
  Listing,
  ListingPhotoWithUrl,
  Platform,
} from "@/lib/types";

type ListingHubProps = {
  listingId: string;
};

type ListingPayload = {
  listing: Listing;
  photos: ListingPhotoWithUrl[];
};

export function ListingHub({ listingId }: ListingHubProps) {
  const [data, setData] = useState<ListingPayload | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/listings/${listingId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load listing");
      setData({ listing: json.listing, photos: json.photos });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load listing");
    }
  }, [listingId]);

  const ensureJoinToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/listings/${listingId}/join-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "phone" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not create QR link");
      setJoinUrl(json.url);
    } catch (err) {
      console.error(err);
    }
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;

    const boot = window.setTimeout(() => {
      if (cancelled) return;
      void load();
      void ensureJoinToken();
    }, 0);

    const timer = window.setInterval(() => {
      if (!cancelled) void load();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      window.clearInterval(timer);
    };
  }, [load, ensureJoinToken]);

  async function runProcess() {
    setProcessing(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}/process`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Processing failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setProcessing(false);
    }
  }

  if (!data && !error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-lg text-[var(--muted)]">
        Loading listing…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-lg text-red-800">{error}</p>
        <Link href="/app" className="mt-4 inline-block text-[var(--accent)]">
          Back to home
        </Link>
      </div>
    );
  }

  const { listing, photos } = data;
  const platform = listing.platform as Platform;
  const attrs = listing.identified_attrs as IdentifiedAttrs | null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            {PLATFORM_LABELS[platform]} · {listing.status.replaceAll("_", " ")}
          </p>
          <h1 className="font-[family-name:var(--font-brand)] text-4xl text-[var(--foreground)]">
            Listing hub
          </h1>
          <p className="mt-2 text-lg text-[var(--muted)]">
            Pair your phone with the QR code, watch photos arrive here, then
            finish the draft.
          </p>
        </div>
        <Link
          href="/app"
          className="text-base font-semibold text-[var(--accent)]"
        >
          ← All listings
        </Link>
      </header>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {joinUrl ? (
          <QrPanel
            value={joinUrl}
            title="Phone camera"
            hint="Scan to open the photo coach on your phone for this listing."
            code={listing.join_code}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-[var(--muted)]">
            Preparing QR code…
          </div>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            What we know so far
          </h2>
          {attrs ? (
            <dl className="mt-4 grid gap-3 text-base sm:grid-cols-2">
              <Attr label="Brand" value={attrs.brand} />
              <Attr label="Size" value={attrs.size} />
              <Attr label="Color" value={attrs.color} />
              <Attr label="Category" value={attrs.category} />
              <Attr label="Material" value={attrs.material} />
              <Attr label="Condition" value={attrs.condition} />
              <div className="sm:col-span-2">
                <dt className="text-sm text-[var(--muted)]">Notes</dt>
                <dd className="mt-1 text-[var(--foreground)]">
                  {attrs.notes || "—"}
                  {typeof attrs.confidence === "number" ? (
                    <span className="ml-2 text-[var(--muted)]">
                      ({Math.round(attrs.confidence * 100)}% confidence)
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-base text-[var(--muted)]">
              Add a brand or care tag photo on the phone to start identifying
              this item.
            </p>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-4 font-[family-name:var(--font-brand)] text-2xl">
          Photos ({photos.length})
        </h2>
        {photos.length === 0 ? (
          <p className="text-base text-[var(--muted)]">
            No photos yet. Scan the QR code and take the first shot on your
            phone.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl ring-1 ring-[var(--border)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    photo.processedSignedUrl ?? photo.signedUrl ?? undefined
                  }
                  alt={photo.role}
                  className="aspect-square w-full object-cover"
                />
                <p className="bg-white px-2 py-1 text-center text-sm capitalize text-[var(--muted)]">
                  {photo.role.replaceAll("_", " ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link href={`/app/listings/${listingId}/photos`} className="block">
          <BigButton>Take photos</BigButton>
        </Link>
        <BigButton
          variant="secondary"
          disabled={processing || photos.length === 0}
          onClick={() => void runProcess()}
        >
          {processing ? "Working…" : "Finish with AI"}
        </BigButton>
        <Link href={`/app/listings/${listingId}/review`} className="block">
          <BigButton variant="secondary">Review draft</BigButton>
        </Link>
        <Link href={`/app/listings/${listingId}/post`} className="block">
          <BigButton variant="secondary">Post checklist</BigButton>
        </Link>
      </div>
    </div>
  );
}

function Attr({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 font-medium text-[var(--foreground)]">
        {value || "—"}
      </dd>
    </div>
  );
}
