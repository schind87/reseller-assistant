"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { PhotoCoach } from "@/components/PhotoCoach";
import { QrPanel } from "@/components/QrPanel";
import type { Listing, ListingPhotoWithUrl } from "@/lib/types";

function PhotosPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const phoneQuery = searchParams.get("phone") === "1";
  const [listing, setListing] = useState<Listing | null>(null);
  const [photos, setPhotos] = useState<ListingPhotoWithUrl[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [joinOnly, setJoinOnly] = useState(false);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/status")
      .then((res) => res.json())
      .then((json: { joinOnly?: boolean }) => {
        if (!cancelled) {
          setJoinOnly(Boolean(json.joinOnly));
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/listings/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        setListing(json.listing);
        setPhotos(json.photos ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      }
    }
    if (params.id) void load();
  }, [params.id]);

  useEffect(() => {
    if (!params.id || phoneQuery || joinOnly) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/listings/${params.id}/join-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "phone" }),
        });
        const json = await res.json();
        if (!cancelled && res.ok) setJoinUrl(json.url);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id, phoneQuery, joinOnly]);

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-lg text-red-800">
        {error}
      </main>
    );
  }

  if (!listing || !authChecked) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-lg text-[var(--muted)]">
        Loading…
      </main>
    );
  }

  const usePhoneCoach = phoneQuery || joinOnly;

  if (!usePhoneCoach) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-10">
        <Link
          href={`/app/listings/${listing.id}`}
          className="text-base font-semibold text-[var(--accent)]"
        >
          ← Back to listing hub
        </Link>
        <h1 className="font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]">
          Take photos on your phone
        </h1>
        <p className="text-lg text-[var(--muted)]">
          The guided photo coach is built for your phone camera. Scan the QR
          code, or add photos from the listing hub on this computer.
        </p>
        {joinUrl ? (
          <QrPanel
            value={joinUrl}
            title="Phone photo coach"
            hint="Scan anytime with your phone — this QR stays valid. Opens the step-by-step clothing photo guide."
            code={listing.join_code}
          />
        ) : (
          <p className="text-base text-[var(--muted)]">Preparing QR code…</p>
        )}
        <Link href={`/app/listings/${listing.id}`} className="block">
          <BigButton variant="secondary">
            Add photos on this computer instead
          </BigButton>
        </Link>
      </main>
    );
  }

  return <PhotoCoach listing={listing} initialPhotos={photos} />;
}

export default function PhotosPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-4 py-10 text-lg text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <PhotosPageInner />
    </Suspense>
  );
}
