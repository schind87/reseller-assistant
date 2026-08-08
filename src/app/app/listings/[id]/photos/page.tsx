"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PhotoCoach } from "@/components/PhotoCoach";
import type { Listing, ListingPhotoWithUrl } from "@/lib/types";

function PhotosPageInner() {
  const params = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [photos, setPhotos] = useState<ListingPhotoWithUrl[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-lg text-red-800">
        {error}
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-lg text-[var(--muted)]">
        Loading photo coach…
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
          Loading photo coach…
        </main>
      }
    >
      <PhotosPageInner />
    </Suspense>
  );
}
