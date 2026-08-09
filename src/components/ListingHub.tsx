"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { CameraCapture } from "@/components/CameraCapture";
import { ListingSchemaForm } from "@/components/ListingSchemaForm";
import { QrPanel } from "@/components/QrPanel";
import {
  getSeedListingSchema,
  type PlatformListingSchema,
} from "@/lib/listing-schemas";
import {
  PLATFORM_LABELS,
  PLATFORM_PHOTO_ASPECT,
  photoRoleLabel,
} from "@/lib/platforms";
import type {
  Listing,
  ListingPhotoWithUrl,
  PhotoRole,
  Platform,
  StructuredFields,
} from "@/lib/types";
import {
  emptyStructuredFields,
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

function roleCountLabel(
  photos: ListingPhotoWithUrl[],
  role: PhotoRole
): string | null {
  const count = photos.filter((p) => p.role === role).length;
  if (count === 0) {
    return role === "flaw" ? "Optional" : "Needed";
  }
  return `${count} added · add another`;
}

function applyListingToDraft(listing: Listing) {
  return {
    title: listing.title ?? "",
    description: listing.description ?? "",
    price: listing.price != null ? String(listing.price) : "",
    fields: {
      ...emptyStructuredFields(),
      ...listing.structured_fields,
    } as StructuredFields,
  };
}

export function ListingHub({ listingId }: ListingHubProps) {
  const router = useRouter();
  const [data, setData] = useState<ListingPayload | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [addTarget, setAddTarget] = useState<AddPhotoTarget | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [pickListingRole, setPickListingRole] = useState(false);
  const [promotePhotoId, setPromotePhotoId] = useState<string | null>(null);
  const [promotingPhoto, setPromotingPhoto] = useState(false);

  const [schema, setSchema] = useState<PlatformListingSchema | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [fields, setFields] = useState<StructuredFields>(emptyStructuredFields());
  const [draftDirty, setDraftDirty] = useState(false);
  const draftHydrated = useRef(false);
  const schemaLoadedFor = useRef<string | null>(null);

  const syncDraftFromListing = useCallback((listing: Listing) => {
    const draft = applyListingToDraft(listing);
    setTitle(draft.title);
    setDescription(draft.description);
    setPrice(draft.price);
    setFields(draft.fields);
    setDraftDirty(false);
    draftHydrated.current = true;
  }, []);

  const load = useCallback(
    async (opts?: { syncDraft?: boolean }) => {
      try {
        const res = await fetch(`/api/listings/${listingId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        const listing = json.listing as Listing;
        const photos = json.photos as ListingPhotoWithUrl[];
        setData({ listing, photos });
        setError(null);

        if (opts?.syncDraft || !draftHydrated.current) {
          syncDraftFromListing(listing);
        }

        const platform = listing.platform as Platform;
        if (schemaLoadedFor.current !== platform) {
          schemaLoadedFor.current = platform;
          const schemaRes = await fetch(`/api/platforms/${platform}/schema`);
          const schemaJson = await schemaRes.json();
          setSchema(
            schemaRes.ok && schemaJson.schema
              ? (schemaJson.schema as PlatformListingSchema)
              : getSeedListingSchema(platform)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load listing");
      }
    },
    [listingId, syncDraftFromListing]
  );

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
    draftHydrated.current = false;
    schemaLoadedFor.current = null;
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;

    const boot = window.setTimeout(() => {
      if (cancelled) return;
      void load({ syncDraft: true });
      void ensureJoinToken();
    }, 0);

    const timer = window.setInterval(() => {
      if (!cancelled) void load({ syncDraft: false });
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
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveDraft(e?: FormEvent) {
    e?.preventDefault();
    if (!data) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          price: price === "" ? null : Number(price),
          structured_fields: fields,
          status: "ready",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      setData((prev) =>
        prev ? { ...prev, listing: json.listing as Listing } : prev
      );
      setDraftDirty(false);
      setStatusMessage("Listing fields saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function deleteThisListing() {
    const label =
      data?.listing.title ||
      `${PLATFORM_LABELS[(data?.listing.platform as Platform) || "mercari"]} draft`;
    const confirmed = window.confirm(
      `Delete “${label}”? Photos for this listing will be removed too.`
    );
    if (!confirmed) return;

    setDeletingListing(true);
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
      router.replace("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete listing");
      setDeletingListing(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const confirmed = window.confirm("Delete this photo?");
    if (!confirmed) return;

    setDeletingPhotoId(photoId);
    setError(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photoId}`,
        { method: "DELETE" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not delete photo"
        );
      }
      if (promotePhotoId === photoId) setPromotePhotoId(null);
      setData((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.filter((photo) => photo.id !== photoId),
            }
          : prev
      );
      setStatusMessage("Photo deleted.");
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete photo");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function usePhotoInListing(photoId: string, role: PhotoRole) {
    setPromotingPhoto(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photoId}/use-in-listing`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not add photo to listing"
        );
      }
      setPromotePhotoId(null);
      setStatusMessage(
        `Also added as ${photoRoleLabel(role)} for shoppers to see.`
      );
      await load({ syncDraft: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not add photo to listing"
      );
    } finally {
      setPromotingPhoto(false);
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
      await load({ syncDraft: true });
      setStatusMessage(
        json.degraded
          ? json.draftMessage ??
              "AI filled a simple template — edit the fields below."
          : "AI filled the fields below — edit anything that looks off."
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
            ? "Brand/care tag — for AI only, not posted"
            : addTarget.purpose === "inventory"
              ? "Stocking photo — private by default"
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
            Add photos, run AI if you want, then edit the {PLATFORM_LABELS[platform]}{" "}
            fields here before posting.
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
            title="Phone photo coach"
            hint="Scan anytime with your phone to open the guided photo steps — this QR stays valid. Keep this computer on the listing hub."
            code={listing.join_code}
          />
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-6 text-[var(--muted)]">
            Preparing QR code…
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-6">
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            Finish with AI
          </h2>
          <p className="text-base text-[var(--muted)]">
            Fills the editable fields below from your photos. You can change
            anything afterward.
          </p>
          <BigButton
            disabled={processing || photos.length === 0}
            onClick={() => void runProcess()}
          >
            {processing ? "Working…" : "Finish with AI"}
          </BigButton>
          {photos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Needs at least one photo first.
            </p>
          ) : null}
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
          title="Brand & care tags"
          badge="For AI · private by default"
          description="Close-ups of brand, size, care, and style/SKU tags so the AI can read the garment. Private by default — tap Use in listing on any shot you also want shoppers to see."
          photos={identifyPhotos}
          empty="No tag photos yet — add every label you can read."
          addLabel="Add tag photo"
          onAdd={() => setAddTarget({ role: "id_tag", purpose: "identify" })}
          onDelete={(photoId) => void deletePhoto(photoId)}
          onUseInListing={(photoId) => setPromotePhotoId(photoId)}
          promotePhotoId={promotePhotoId}
          deletingPhotoId={deletingPhotoId}
          disabled={
            uploading || Boolean(deletingPhotoId) || promotingPhoto
          }
          tone="private"
        />

        <PhotoGroup
          title="Stocking photo"
          badge="Private stocking · not posted by default"
          description="Optional photo of this piece where you stock it (closet, bin, or rack) so you can find it later. Add as many as you need. Private by default — use in the listing if you want."
          photos={inventoryPhotos}
          empty="No stocking photos yet — optional if you already know where it is."
          addLabel="Add stocking photo"
          onAdd={() =>
            setAddTarget({ role: "inventory", purpose: "inventory" })
          }
          onDelete={(photoId) => void deletePhoto(photoId)}
          onUseInListing={(photoId) => setPromotePhotoId(photoId)}
          promotePhotoId={promotePhotoId}
          deletingPhotoId={deletingPhotoId}
          disabled={
            uploading || Boolean(deletingPhotoId) || promotingPhoto
          }
          tone="private"
        />

        {promotePhotoId ? (
          <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
            <p className="mb-3 text-base font-semibold text-[var(--foreground)]">
              Use this photo in the listing as…
            </p>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Keeps the original private photo and adds a copy for shoppers.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {LISTING_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={promotingPhoto}
                  onClick={() =>
                    void usePhotoInListing(promotePhotoId, role)
                  }
                  className="touch-target rounded-xl border border-[var(--border)] px-4 py-3 text-left text-base font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50"
                >
                  {photoRoleLabel(role)}
                  <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                    {roleCountLabel(photos, role)}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={promotingPhoto}
              className="mt-3 text-base font-semibold text-[var(--muted)] disabled:opacity-50"
              onClick={() => setPromotePhotoId(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <div className="space-y-3">
          <PhotoGroup
            title="Photos shoppers will see"
            badge="Listing photos · posted"
            description="Cover, front, back, details, and flaws for the marketplace listing. You can add multiple photos of each type. These are the only photos that get uploaded when you post."
            photos={listingPhotos}
            empty="No listing photos yet — start with a clean cover shot."
            addLabel={`Add ${photoRoleLabel(nextListingRole(photos)).toLowerCase()} photo`}
            onAdd={() => setPickListingRole((open) => !open)}
            onDelete={(photoId) => void deletePhoto(photoId)}
            deletingPhotoId={deletingPhotoId}
            disabled={uploading || Boolean(deletingPhotoId)}
            tone="listing"
          />
          {pickListingRole ? (
            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <p className="mb-3 text-base font-semibold text-[var(--foreground)]">
                Which listing photo?
              </p>
              <p className="mb-3 text-sm text-[var(--muted)]">
                Pick a type — you can add as many of each as you want.
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
                    <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                      {roleCountLabel(photos, role)}
                    </span>
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

        <p className="text-base text-[var(--muted)]">
          For the step-by-step photo coach, scan the phone QR above. On this
          computer, add or delete photos in the sections here.
        </p>
        <a
          href={`/api/listings/${listingId}/photos/zip`}
          className="block max-w-sm"
        >
          <BigButton variant="secondary">Download listing photos ZIP</BigButton>
        </a>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6">
        <div>
          <h2 className="font-[family-name:var(--font-brand)] text-2xl">
            {PLATFORM_LABELS[platform]} listing fields
          </h2>
          <p className="mt-2 text-base text-[var(--muted)]">
            Edit these directly — same fields you will enter on{" "}
            {PLATFORM_LABELS[platform]}.
          </p>
        </div>

        {schema ? (
          <ListingSchemaForm
            schema={schema}
            title={title}
            description={description}
            price={price}
            fields={fields}
            onTitleChange={(value) => {
              setTitle(value);
              setDraftDirty(true);
            }}
            onDescriptionChange={(value) => {
              setDescription(value);
              setDraftDirty(true);
            }}
            onPriceChange={(value) => {
              setPrice(value);
              setDraftDirty(true);
            }}
            onFieldsChange={(next) => {
              setFields(next);
              setDraftDirty(true);
            }}
            onSubmit={(e) => void saveDraft(e)}
            footer={
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <BigButton type="submit" disabled={saving || processing}>
                  {saving ? "Saving…" : draftDirty ? "Save changes" : "Saved"}
                </BigButton>
                <BigButton
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    void (async () => {
                      if (draftDirty) await saveDraft();
                      router.push(`/app/listings/${listingId}/post`);
                    })();
                  }}
                >
                  Post checklist
                </BigButton>
              </div>
            }
          />
        ) : (
          <p className="text-base text-[var(--muted)]">Loading fields…</p>
        )}
      </section>

      <div className="border-t border-[var(--border)] pt-6">
        <BigButton
          variant="danger"
          disabled={deletingListing || saving || processing}
          onClick={() => void deleteThisListing()}
        >
          {deletingListing ? "Deleting…" : "Delete this listing"}
        </BigButton>
      </div>
    </div>
  );
}

function PhotoGroup({
  title,
  badge,
  description,
  photos,
  empty,
  addLabel,
  onAdd,
  onDelete,
  onUseInListing,
  promotePhotoId,
  deletingPhotoId,
  disabled,
  tone = "listing",
}: {
  title: string;
  badge?: string;
  description?: string;
  photos: ListingPhotoWithUrl[];
  empty: string;
  addLabel: string;
  onAdd: () => void;
  onDelete: (photoId: string) => void;
  onUseInListing?: (photoId: string) => void;
  promotePhotoId?: string | null;
  deletingPhotoId?: string | null;
  disabled?: boolean;
  tone?: "private" | "listing";
}) {
  const badgeClass =
    tone === "private"
      ? "bg-amber-50 text-amber-950"
      : "bg-[var(--accent-soft)] text-[var(--accent)]";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "private"
          ? "border-amber-200/80 bg-amber-50/40"
          : "border-[var(--border)] bg-white"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h3>
          {badge ? (
            <p
              className={`inline-block rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
            >
              {badge}
            </p>
          ) : null}
          {description ? (
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          className="shrink-0 rounded-lg border border-[var(--accent)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
        >
          {addLabel}
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => {
            const deleting = deletingPhotoId === photo.id;
            const promoting = promotePhotoId === photo.id;
            return (
              <li
                key={photo.id}
                className={`relative overflow-hidden rounded-xl ring-1 ${
                  promoting
                    ? "ring-2 ring-[var(--accent)]"
                    : "ring-[var(--border)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    photo.processedSignedUrl ?? photo.signedUrl ?? undefined
                  }
                  alt={photoRoleLabel(photo.role)}
                  className="aspect-square w-full object-cover"
                />
                <div className="space-y-1 bg-white px-2 py-1.5">
                  <p className="min-w-0 truncate text-sm text-[var(--muted)]">
                    {photoRoleLabel(photo.role)}
                    {isNonPostingPhotoRole(photo.role) ? " · private" : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    {onUseInListing ? (
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onUseInListing(photo.id)}
                        className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
                      >
                        {promoting ? "Choosing…" : "Use in listing"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onDelete(photo.id)}
                      className="rounded-md px-2 py-1 text-sm font-semibold text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Delete ${photoRoleLabel(photo.role)} photo`}
                    >
                      {deleting ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
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
