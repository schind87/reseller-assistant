"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BigButton } from "@/components/BigButton";
import { CameraCapture } from "@/components/CameraCapture";
import { QrPanel } from "@/components/QrPanel";
import {
  PLATFORM_LABELS,
  PLATFORM_PHOTO_ASPECT,
  photoRoleLabel,
} from "@/lib/platforms";
import type {
  IdentifiedAttrs,
  Listing,
  ListingPhotoWithUrl,
  PhotoRole,
  Platform,
} from "@/lib/types";
import {
  isIdentifyPhotoRole,
  isNonPostingPhotoRole,
  isPostingPhotoRole,
} from "@/lib/types";

type ListingHubProps = {
  listingId: string;
};

type ListingPayload = {
  listing: Listing;
  photos: ListingPhotoWithUrl[];
};

type AddPhotoTarget = {
  role: PhotoRole;
  purpose: "identify" | "inventory" | "listing";
};

const LISTING_ROLES: PhotoRole[] = [
  "cover",
  "front",
  "back",
  "detail",
  "flaw",
];

function nextListingRole(photos: ListingPhotoWithUrl[]): PhotoRole {
  for (const role of LISTING_ROLES) {
    if (role === "flaw") continue;
    if (!photos.some((p) => p.role === role)) return role;
  }
  return "detail";
}

export function ListingHub({ listingId }: ListingHubProps) {
  const [data, setData] = useState<ListingPayload | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<AddPhotoTarget | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickListingRole, setPickListingRole] = useState(false);

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

  async function uploadPhoto(blob: Blob, role: PhotoRole) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append(
        "photo",
        new File([blob], `${role}.jpg`, { type: blob.type || "image/jpeg" })
      );
      body.append("role", role);

      const res = await fetch(`/api/listings/${listingId}/photos`, {
        method: "POST",
        body,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Upload failed"
        );
      }
      setAddTarget(null);
      setPickListingRole(false);
      setStatusMessage(`Added ${photoRoleLabel(role)} photo.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function runProcess() {
    if (!data?.photos.length) {
      setError("Add at least one photo before running AI.");
      return;
    }

    setProcessing(true);
    setError(null);
    setStatusMessage("Running AI on your photos — this can take up to a minute…");
    try {
      const res = await fetch(`/api/listings/${listingId}/process`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Processing failed"
        );
      }
      await load();
      setStatusMessage(
        json.degraded
          ? json.draftMessage ??
              "AI finished with a simple template — review and edit the draft."
          : "AI draft ready — open Review draft to edit."
      );
    } catch (err) {
      setStatusMessage(null);
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
  const aspect = PLATFORM_PHOTO_ASPECT[platform];
  const identifyPhotos = photos.filter((p) => isIdentifyPhotoRole(p.role));
  const inventoryPhotos = photos.filter((p) => p.role === "inventory");
  const listingPhotos = photos.filter((p) => isPostingPhotoRole(p.role));

  if (addTarget) {
    return (
      <CameraCapture
        aspect={aspect}
        showAspectGuide={addTarget.purpose === "listing"}
        guideNote={
          addTarget.purpose === "identify"
            ? "Identification tag — will not be posted"
            : addTarget.purpose === "inventory"
              ? "Inventory only — will not be posted"
              : `Listing · ${photoRoleLabel(addTarget.role)}`
        }
        onCancel={() => {
          if (!uploading) setAddTarget(null);
        }}
        onCapture={(blob) => void uploadPhoto(blob, addTarget.role)}
        onFallbackFile={(file) => void uploadPhoto(file, addTarget.role)}
      />
    );
  }

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
            Pair your phone with the QR code, add photos here or on the phone,
            then finish the clothing draft.
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

      {statusMessage ? (
        <p className="rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-base text-[var(--accent)]">
          {statusMessage}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {joinUrl ? (
          <QrPanel
            value={joinUrl}
            title="Phone camera"
            hint="Scan to open the clothing photo coach on your phone for this piece."
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
              <Attr label="Garment type" value={attrs.category} />
              <Attr label="Fabric" value={attrs.material} />
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
              Add identification tag photos below to start identifying this
              garment.
            </p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className="font-[family-name:var(--font-brand)] text-2xl">
          Photos ({photos.length})
        </h2>
        <p className="text-base text-[var(--muted)]">
          Add photos in each section on this computer, or use the QR code for
          your phone.
        </p>

        <PhotoGroup
          title="Identification (not posted)"
          photos={identifyPhotos}
          empty="No tag photos yet."
          addLabel="Add identification photo"
          onAdd={() =>
            setAddTarget({ role: "id_tag", purpose: "identify" })
          }
          disabled={uploading}
        />

        <PhotoGroup
          title="Inventory (not posted)"
          photos={inventoryPhotos}
          empty="No inventory photo yet."
          addLabel="Add inventory photo"
          onAdd={() =>
            setAddTarget({ role: "inventory", purpose: "inventory" })
          }
          disabled={uploading}
        />

        <div className="space-y-3">
          <PhotoGroup
            title="Listing photos"
            photos={listingPhotos}
            empty="No listing photos yet."
            addLabel={`Add ${photoRoleLabel(nextListingRole(photos)).toLowerCase()} photo`}
            onAdd={() => setPickListingRole((open) => !open)}
            disabled={uploading}
          />
          {pickListingRole ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <p className="mb-3 text-base font-semibold text-[var(--foreground)]">
                Which listing photo?
              </p>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {LISTING_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={uploading}
                    onClick={() => {
                      setPickListingRole(false);
                      setAddTarget({ role, purpose: "listing" });
                    }}
                    className="touch-target rounded-xl border border-[var(--border)] px-4 py-3 text-left text-base font-semibold hover:bg-[var(--surface-muted)]"
                  >
                    {photoRoleLabel(role)}
                    {!photos.some((p) => p.role === role) && role !== "flaw" ? (
                      <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                        Needed
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 text-base font-semibold text-[var(--muted)]"
                onClick={() => setPickListingRole(false)}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/app/listings/${listingId}/photos`}
          className="block"
        >
          <BigButton>Guided photo coach</BigButton>
        </Link>
        <div className="flex flex-col gap-2">
          <BigButton
            variant="secondary"
            disabled={processing}
            onClick={() => void runProcess()}
          >
            {processing ? "Working…" : "Finish with AI"}
          </BigButton>
          {photos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Needs at least one photo first.
            </p>
          ) : null}
        </div>
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

function PhotoGroup({
  title,
  photos,
  empty,
  addLabel,
  onAdd,
  disabled,
}: {
  title: string;
  photos: ListingPhotoWithUrl[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="rounded-lg border border-[var(--accent)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {addLabel}
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
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
                alt={photoRoleLabel(photo.role)}
                className="aspect-square w-full object-cover"
              />
              <p className="bg-white px-2 py-1 text-center text-sm text-[var(--muted)]">
                {photoRoleLabel(photo.role)}
                {isNonPostingPhotoRole(photo.role) ? " · private" : ""}
              </p>
            </li>
          ))}
          <li>
            <button
              type="button"
              disabled={disabled}
              onClick={onAdd}
              className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] text-base font-semibold text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
            >
              + Add
            </button>
          </li>
        </ul>
      )}
      {photos.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="mt-3 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-white text-base font-semibold text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          + {addLabel}
        </button>
      ) : null}
    </div>
  );
}
