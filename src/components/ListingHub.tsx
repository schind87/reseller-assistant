"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BigButton } from "@/components/BigButton";
import { ListingSchemaForm } from "@/components/ListingSchemaForm";
import { ListingTweakDialog } from "@/components/ListingTweakDialog";
import { QrPanel } from "@/components/QrPanel";
import {
  getSeedListingSchema,
  type PlatformListingSchema,
} from "@/lib/listing-schemas";
import {
  PLATFORM_LABELS,
  SELL_PAGE_URLS,
  photoRoleLabel,
} from "@/lib/platforms";
import {
  requestExtensionPair,
  waitForExtensionPairAck,
} from "@/lib/extension-bridge";
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
  isPostingPhotoRole,
} from "@/lib/types";

type ListingHubProps = {
  listingId: string;
};

type ListingPayload = {
  listing: Listing;
  photos: ListingPhotoWithUrl[];
};

type PhotoSection = "identify" | "inventory" | "listing";

const PHOTO_DND_TYPE = "application/x-ra-photo-id";
const LONG_PRESS_MS = 450;

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

function roleForSection(
  section: PhotoSection,
  photos: ListingPhotoWithUrl[],
  currentRole?: PhotoRole
): PhotoRole {
  switch (section) {
    case "identify":
      return "id_tag";
    case "inventory":
      return "inventory";
    case "listing":
      if (currentRole && isPostingPhotoRole(currentRole)) return currentRole;
      return nextListingRole(photos);
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
}

function sectionForRole(role: PhotoRole): PhotoSection {
  if (isIdentifyPhotoRole(role)) return "identify";
  if (role === "inventory") return "inventory";
  return "listing";
}

function sectionLabel(section: PhotoSection): string {
  switch (section) {
    case "identify":
      return "brand & care tags";
    case "inventory":
      return "stocking photos";
    case "listing":
      return "listing photos";
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
  }
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

function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files).filter((file) =>
    file.type.startsWith("image/")
  );
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
  const searchParams = useSearchParams();
  const tweakOpen = searchParams.get("tweak") === "1";
  const [data, setData] = useState<ListingPayload | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rewritingDescription, setRewritingDescription] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [openingSell, setOpeningSell] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [pickListingRole, setPickListingRole] = useState(false);
  const [promotePhotoId, setPromotePhotoId] = useState<string | null>(null);
  const [promotingPhoto, setPromotingPhoto] = useState(false);
  const [movingPhotoId, setMovingPhotoId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<PhotoSection | null>(
    null
  );
  const [movingPhoto, setMovingPhoto] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<ListingPhotoWithUrl | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRoleRef = useRef<PhotoRole | null>(null);

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

  const closeTweak = useCallback(() => {
    if (searchParams.get("tweak") === "1") {
      const popup = searchParams.get("popup") === "1" ? "?popup=1" : "";
      router.replace(`/app/listings/${listingId}${popup}`, { scroll: false });
    }
  }, [listingId, router, searchParams]);

  const openTweak = useCallback(() => {
    const popup = searchParams.get("popup") === "1" ? "&popup=1" : "";
    router.replace(`/app/listings/${listingId}?tweak=1${popup}`, {
      scroll: false,
    });
  }, [listingId, router, searchParams]);

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

  function pickFilesForRole(role: PhotoRole) {
    pendingUploadRoleRef.current = role;
    setPickListingRole(false);
    fileInputRef.current?.click();
  }

  async function onDesktopFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );
    event.target.value = "";
    const role = pendingUploadRoleRef.current;
    pendingUploadRoleRef.current = null;
    if (!role || files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const body = new FormData();
        body.append("photo", file);
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
      }
      setStatusMessage(
        files.length === 1
          ? `Added ${photoRoleLabel(role)} photo.`
          : `Added ${files.length} ${photoRoleLabel(role).toLowerCase()} photos.`
      );
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadFilesToSection(files: File[], section: PhotoSection) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Drop image files (JPEG, PNG, WebP, etc.).");
      return;
    }

    setUploading(true);
    setError(null);
    setMovingPhotoId(null);
    try {
      let working = data?.photos ?? [];
      for (const file of images) {
        const role = roleForSection(section, working);
        const body = new FormData();
        body.append("photo", file);
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
        if (json.photo) {
          working = [...working, json.photo as ListingPhotoWithUrl];
        }
      }
      setStatusMessage(
        images.length === 1
          ? `Added photo to ${sectionLabel(section)}.`
          : `Added ${images.length} photos to ${sectionLabel(section)}.`
      );
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function movePhotoToSection(photoId: string, section: PhotoSection) {
    const photo = data?.photos.find((p) => p.id === photoId);
    if (!photo) return;

    if (sectionForRole(photo.role) === section) {
      setMovingPhotoId(null);
      setStatusMessage("Photo is already in that section.");
      return;
    }

    const targetRole = roleForSection(section, data?.photos ?? [], photo.role);
    setMovingPhoto(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photoId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: targetRole }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" ? json.error : "Could not move photo"
        );
      }
      setMovingPhotoId(null);
      setStatusMessage(
        `Moved to ${sectionLabel(section)} as ${photoRoleLabel(targetRole)}.`
      );
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move photo");
    } finally {
      setMovingPhoto(false);
    }
  }

  async function saveDraft(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    if (!data) return false;
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      return false;
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

  async function addPhotoToListing(photoId: string, role: PhotoRole) {
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

  async function rewriteDescription() {
    setRewritingDescription(true);
    setError(null);
    setStatusMessage("Rewriting description from your current fields…");
    try {
      const priceNum = price.trim() === "" ? null : Number(price);
      const res = await fetch(
        `/api/listings/${listingId}/rewrite-description`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            price: Number.isFinite(priceNum) ? priceNum : null,
            description,
            structured_fields: fields,
            save: false,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not rewrite description"
        );
      }
      if (typeof json.description !== "string") {
        throw new Error("Could not rewrite description");
      }
      setDescription(json.description);
      setDraftDirty(true);
      setStatusMessage(
        json.degraded
          ? json.message ??
              "Filled a simple description from your fields — edit as needed."
          : "Description rewritten from your fields — review and save."
      );
    } catch (err) {
      setStatusMessage(null);
      setError(
        err instanceof Error ? err.message : "Could not rewrite description"
      );
    } finally {
      setRewritingDescription(false);
    }
  }

  async function openMarketplaceSell() {
    if (!data) return;
    setOpeningSell(true);
    setError(null);
    try {
      if (draftDirty) {
        const saved = await saveDraft();
        if (!saved) return;
      }

      try {
        const tokenRes = await fetch(`/api/listings/${listingId}/join-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "extension" }),
        });
        const tokenJson = await tokenRes.json().catch(() => ({}));
        if (tokenRes.ok && tokenJson.token) {
          requestExtensionPair({
            token: String(tokenJson.token),
            listingId,
            joinCode: data.listing.join_code,
            openSidePanel: true,
          });
          void waitForExtensionPairAck(2000);
        }
      } catch {
        // Extension pairing is best-effort; still open the sell page.
      }

      const sellUrl =
        schema?.sellPageUrl ||
        SELL_PAGE_URLS[data.listing.platform as Platform];
      const opened = window.open(sellUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        throw new Error(
          "Could not open a new tab — allow pop-ups for this site, then try again."
        );
      }

      setStatusMessage(
        `Opened ${PLATFORM_LABELS[data.listing.platform as Platform]} in a new tab. Keep this listing open — use the green helper on the sell page.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open the sell page"
      );
    } finally {
      setOpeningSell(false);
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
  const identifyPhotos = photos.filter((p) => isIdentifyPhotoRole(p.role));
  const listingPhotos = photos.filter((p) => isPostingPhotoRole(p.role));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onDesktopFilesSelected(e)}
      />
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
            fields here before opening {PLATFORM_LABELS[platform]} to post.
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
          Drop image files onto a section to upload, or use Add to choose from
          this computer. Long-press a photo, then drop or tap another section to
          move it. Use the QR code for guided shooting on your phone.
        </p>

        {movingPhotoId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
            <p className="text-base font-semibold text-[var(--accent)]">
              Moving photo — drop or tap a section below
            </p>
            <button
              type="button"
              className="text-base font-semibold text-[var(--accent)] underline"
              onClick={() => setMovingPhotoId(null)}
            >
              Cancel
            </button>
          </div>
        ) : null}

        <PhotoGroup
          title="Brand & care tags"
          badge="For Product Identification, not shown in listing."
          description="Close-ups of brand, size, care, and style/SKU tags. Private by default — tap Use in listing on any shot you also want shoppers to see."
          photos={identifyPhotos}
          empty="No tag photos yet — drop images here or add every label you can read."
          section="identify"
          onAdd={() => pickFilesForRole("id_tag")}
          onDelete={(photoId) => void deletePhoto(photoId)}
          onUseInListing={(photoId) => setPromotePhotoId(photoId)}
          onPreview={setPreviewPhoto}
          onDropFiles={(files) => void uploadFilesToSection(files, "identify")}
          onDropPhoto={(photoId) => void movePhotoToSection(photoId, "identify")}
          onBeginMove={(photoId) => setMovingPhotoId(photoId)}
          movingPhotoId={movingPhotoId}
          promotePhotoId={promotePhotoId}
          dragOver={dragOverSection === "identify"}
          onDragOverChange={(over) =>
            setDragOverSection(over ? "identify" : null)
          }
          deletingPhotoId={deletingPhotoId}
          disabled={
            uploading ||
            Boolean(deletingPhotoId) ||
            promotingPhoto ||
            movingPhoto
          }
          tone="private"
        />

        {promotePhotoId ? (
          <PhotoRolePickerDialog
            title="Use this photo in the listing as…"
            description="Keeps the original private photo and adds a copy for shoppers. Pick a type below."
            roles={LISTING_ROLES}
            roleHint={(role) => roleCountLabel(photos, role)}
            disabled={promotingPhoto}
            onPick={(role) => void addPhotoToListing(promotePhotoId, role)}
            onClose={() => setPromotePhotoId(null)}
          />
        ) : null}

        <div className="space-y-3">
          <PhotoGroup
            title="Photos shoppers will see"
            badge="Listing photos · posted"
            description="Cover, front, back, details, and flaws for the marketplace listing. You can add multiple photos of each type. These are the only photos that get uploaded when you post."
            photos={listingPhotos}
            empty="No listing photos yet — drop images here or start with a clean cover shot."
            section="listing"
            onAdd={() => setPickListingRole(true)}
            onDelete={(photoId) => void deletePhoto(photoId)}
            onPreview={setPreviewPhoto}
            onDropFiles={(files) => void uploadFilesToSection(files, "listing")}
            onDropPhoto={(photoId) =>
              void movePhotoToSection(photoId, "listing")
            }
            onBeginMove={(photoId) => setMovingPhotoId(photoId)}
            movingPhotoId={movingPhotoId}
            dragOver={dragOverSection === "listing"}
            onDragOverChange={(over) =>
              setDragOverSection(over ? "listing" : null)
            }
            deletingPhotoId={deletingPhotoId}
            disabled={
              uploading || Boolean(deletingPhotoId) || movingPhoto
            }
            tone="listing"
          />
        </div>

        {pickListingRole ? (
          <PhotoRolePickerDialog
            title="Which listing photo?"
            description="Pick a type for the photo you’re adding — you can add as many of each as you want."
            roles={LISTING_ROLES}
            roleHint={(role) => roleCountLabel(photos, role)}
            disabled={uploading}
            onPick={(role) => pickFilesForRole(role)}
            onClose={() => setPickListingRole(false)}
          />
        ) : null}

        <p className="text-base text-[var(--muted)]">
          For the step-by-step photo coach, scan the phone QR above. On this
          computer, drop files onto sections, choose files with Add, or
          long-press to move photos — the camera stays on your phone.
        </p>
        <a
          href={`/api/listings/${listingId}/photos/zip`}
          className="block max-w-sm"
        >
          <BigButton variant="secondary">Download listing photos ZIP</BigButton>
        </a>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-brand)] text-2xl">
              {PLATFORM_LABELS[platform]} listing fields
            </h2>
            <p className="mt-2 text-base text-[var(--muted)]">
              Edit these directly — same fields you will enter on{" "}
              {PLATFORM_LABELS[platform]}.
            </p>
          </div>
          <button
            type="button"
            onClick={openTweak}
            className="touch-target shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 text-base font-semibold text-[var(--foreground)]"
          >
            Open large editor
          </button>
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
            onRewriteDescription={() => void rewriteDescription()}
            rewritingDescription={rewritingDescription}
            onSubmit={(e) => void saveDraft(e)}
            footer={
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <BigButton
                  type="submit"
                  disabled={saving || processing || rewritingDescription}
                >
                  {saving ? "Saving…" : draftDirty ? "Save changes" : "Saved"}
                </BigButton>
                <BigButton
                  type="button"
                  variant="secondary"
                  disabled={saving || rewritingDescription || openingSell}
                  onClick={() => void openMarketplaceSell()}
                >
                  {openingSell
                    ? "Opening…"
                    : `Open ${PLATFORM_LABELS[platform]}`}
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

      {previewPhoto ? (
        <PhotoLightbox
          photo={previewPhoto}
          onClose={() => setPreviewPhoto(null)}
        />
      ) : null}

      {tweakOpen && schema ? (
        <ListingTweakDialog
          platform={platform}
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
          onRewriteDescription={() => void rewriteDescription()}
          rewritingDescription={rewritingDescription}
          saving={saving}
          draftDirty={draftDirty}
          onSubmit={(e) => void saveDraft(e)}
          onClose={closeTweak}
          footerExtra={
            searchParams.get("popup") === "1" ? (
              <p className="text-sm text-[var(--muted)]">
                Save your changes, then close this window and tap{" "}
                <strong>Refresh listing</strong> in the Chrome extension.
              </p>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                After saving, tap <strong>Refresh listing</strong> in the Chrome
                extension so fills use your updates.
              </p>
            )
          }
        />
      ) : null}
    </div>
  );
}

function PhotoGroup({
  title,
  badge,
  description,
  photos,
  empty,
  section,
  onAdd,
  onDelete,
  onUseInListing,
  onPreview,
  onDropFiles,
  onDropPhoto,
  onBeginMove,
  movingPhotoId,
  promotePhotoId,
  dragOver,
  onDragOverChange,
  deletingPhotoId,
  disabled,
  tone = "listing",
}: {
  title: string;
  badge?: string;
  description?: string;
  photos: ListingPhotoWithUrl[];
  empty: string;
  section: PhotoSection;
  onAdd: () => void;
  onDelete: (photoId: string) => void;
  onUseInListing?: (photoId: string) => void;
  onPreview: (photo: ListingPhotoWithUrl) => void;
  onDropFiles: (files: File[]) => void;
  onDropPhoto: (photoId: string) => void;
  onBeginMove: (photoId: string) => void;
  movingPhotoId?: string | null;
  promotePhotoId?: string | null;
  dragOver?: boolean;
  onDragOverChange: (over: boolean) => void;
  deletingPhotoId?: string | null;
  disabled?: boolean;
  tone?: "private" | "listing";
}) {
  const badgeClass =
    tone === "private"
      ? "bg-amber-50 text-amber-950"
      : "bg-[var(--accent-soft)] text-[var(--accent)]";
  const moveArmed = Boolean(movingPhotoId);
  const isDropTarget = dragOver || (moveArmed && !disabled);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    const hasFiles = Array.from(e.dataTransfer.types).includes("Files");
    const hasPhoto = Array.from(e.dataTransfer.types).includes(PHOTO_DND_TYPE);
    if (!hasFiles && !hasPhoto && !moveArmed) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = hasFiles ? "copy" : "move";
    onDragOverChange(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    onDragOverChange(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onDragOverChange(false);
    if (disabled) return;

    const photoId =
      e.dataTransfer.getData(PHOTO_DND_TYPE) || movingPhotoId || "";
    const files = imageFilesFromDataTransfer(e.dataTransfer);

    if (photoId) {
      onDropPhoto(photoId);
      return;
    }
    if (files.length > 0) {
      onDropFiles(files);
    }
  }

  function handleSectionActivate() {
    if (disabled || !movingPhotoId) return;
    onDropPhoto(movingPhotoId);
  }

  return (
    <div
      role="region"
      aria-label={title}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={moveArmed ? handleSectionActivate : undefined}
      className={`rounded-2xl border p-4 transition ${
        isDropTarget
          ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]"
          : tone === "private"
            ? "border-amber-200/80 bg-amber-50/40"
            : "border-[var(--border)] bg-white"
      } ${moveArmed ? "cursor-pointer" : ""}`}
    >
      <div className="mb-2 space-y-1">
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
        <p className="text-xs text-[var(--muted)]">
          {moveArmed
            ? "Tap or drop here to move the photo"
            : "Drop images here to upload · tap a photo to enlarge"}
        </p>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              deleting={deletingPhotoId === photo.id}
              promoting={promotePhotoId === photo.id}
              moving={movingPhotoId === photo.id}
              moveArmed={moveArmed}
              disabled={disabled}
              onPreview={() => onPreview(photo)}
              onUseInListing={
                onUseInListing
                  ? () => onUseInListing(photo.id)
                  : undefined
              }
              onDelete={() => onDelete(photo.id)}
              onBeginMove={() => onBeginMove(photo.id)}
            />
          ))}
          <li onClick={(e) => e.stopPropagation()}>
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
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className="mt-3 flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border)] bg-white text-base font-semibold text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          + Add
        </button>
      ) : null}
      {/* section id kept for debugging / a11y context */}
      <span className="sr-only">{section}</span>
    </div>
  );
}

function PhotoTile({
  photo,
  deleting,
  promoting,
  moving,
  moveArmed,
  disabled,
  onPreview,
  onUseInListing,
  onDelete,
  onBeginMove,
}: {
  photo: ListingPhotoWithUrl;
  deleting: boolean;
  promoting: boolean;
  moving: boolean;
  moveArmed: boolean;
  disabled?: boolean;
  onPreview: () => void;
  onUseInListing?: () => void;
  onDelete: () => void;
  onBeginMove: () => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const [draggable, setDraggable] = useState(false);

  function clearLongPress() {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLLIElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTriggered.current = true;
      setDraggable(true);
      onBeginMove();
      try {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate(12);
        }
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    clearLongPress();
  }

  function handlePointerCancel() {
    clearLongPress();
  }

  function handleDragStart(e: DragEvent<HTMLLIElement>) {
    if (!draggable && !moving) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(PHOTO_DND_TYPE, photo.id);
    e.dataTransfer.effectAllowed = "move";
    onBeginMove();
  }

  function handleDragEnd() {
    setDraggable(false);
  }

  return (
    <li
      draggable={draggable || moving}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        if (moving) {
          e.stopPropagation();
          if (longPressTriggered.current) {
            longPressTriggered.current = false;
          }
          return;
        }
        if (longPressTriggered.current) {
          e.stopPropagation();
          longPressTriggered.current = false;
          return;
        }
        // While another photo is being moved, let the click hit the section drop target.
        if (moveArmed) {
          return;
        }
        e.stopPropagation();
        onPreview();
      }}
      className={`relative overflow-hidden rounded-xl ring-1 select-none ${
        moving || promoting
          ? "ring-2 ring-[var(--accent)]"
          : "ring-[var(--border)]"
      } ${moving ? "opacity-80" : ""} ${disabled ? "opacity-60" : "cursor-pointer"}`}
      style={{ touchAction: "manipulation" }}
      title="Tap to enlarge · long-press to move"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.processedSignedUrl ?? photo.signedUrl ?? undefined}
        alt={photoRoleLabel(photo.role)}
        className="pointer-events-none aspect-square w-full object-cover"
        draggable={false}
      />
      <div
        className="space-y-1 bg-white px-2 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 truncate text-sm text-[var(--muted)]">
          {photoRoleLabel(photo.role)}
          {moving ? " · moving" : ""}
        </p>
        <div className="flex items-center gap-2">
          {onUseInListing ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onUseInListing();
              }}
              aria-pressed={promoting}
              className={`rounded-md border px-2 py-1 text-sm font-semibold transition disabled:opacity-50 ${
                promoting
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--accent)] bg-transparent text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {promoting ? "Choosing…" : "Use in listing"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--danger)] hover:bg-red-50 disabled:opacity-50"
            aria-label={`Delete ${photoRoleLabel(photo.role)} photo`}
            title="Delete photo"
          >
            {deleting ? (
              <span className="text-sm font-semibold">…</span>
            ) : (
              <TrashIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </li>
  );
}

function PhotoRolePickerDialog({
  title,
  description,
  roles,
  roleHint,
  disabled,
  onPick,
  onClose,
}: {
  title: string;
  description: string;
  roles: PhotoRole[];
  roleHint: (role: PhotoRole) => string | null;
  disabled?: boolean;
  onPick: (role: PhotoRole) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !disabled) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [disabled, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-role-picker-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!disabled) onClose();
      }}
    >
      <div
        className="ra-focus-pop w-full max-w-lg rounded-2xl border-2 border-[var(--accent)] bg-[var(--surface)] p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
          Choose photo type
        </p>
        <h2
          id="photo-role-picker-title"
          className="mt-1 font-[family-name:var(--font-brand)] text-3xl text-[var(--foreground)]"
        >
          {title}
        </h2>
        <p className="mt-2 text-base text-[var(--muted)]">{description}</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {roles.map((role) => {
            const hint = roleHint(role);
            return (
              <button
                key={role}
                type="button"
                disabled={disabled}
                onClick={() => onPick(role)}
                className="touch-target rounded-xl border-2 border-[var(--border)] bg-white px-4 py-3 text-left text-base font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-50"
              >
                {photoRoleLabel(role)}
                {hint ? (
                  <span className="mt-1 block text-sm font-normal text-[var(--muted)]">
                    {hint}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={disabled}
          className="mt-5 touch-target w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base font-semibold text-[var(--muted)] disabled:opacity-50"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function PhotoLightbox({
  photo,
  onClose,
}: {
  photo: ListingPhotoWithUrl;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const src = photo.processedSignedUrl ?? photo.signedUrl ?? undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${photoRoleLabel(photo.role)} photo preview`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 touch-target rounded-xl bg-white/95 px-4 text-base font-semibold text-[var(--foreground)]"
      >
        Close
      </button>
      <div
        className="flex max-h-full max-w-full flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={photoRoleLabel(photo.role)}
          className="max-h-[min(85vh,900px)] max-w-[min(96vw,900px)] rounded-lg object-contain shadow-2xl"
        />
        <p className="rounded-lg bg-black/50 px-3 py-1 text-sm font-medium text-white">
          {photoRoleLabel(photo.role)}
        </p>
      </div>
    </div>
  );
}
