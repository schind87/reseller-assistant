"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
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
import { isCurrentBgPipeline } from "@/lib/ai/bg-pipeline";
import {
  FAL_BG_MODELS,
  type FalBgModelId,
} from "@/lib/ai/fal-bg-models";
import {
  EMPTY_BG_MODEL_CATALOG_PREFS,
  isFalBgModelId,
  readBgModelCatalogPrefs,
  resolveDefaultListingModelId,
  scopedBgModels,
  subscribeBgModelCatalogPrefs,
  writeBgModelCatalogPrefs,
} from "@/lib/ai/bg-model-prefs";
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
  isAdmin?: boolean;
};

type ListingPayload = {
  listing: Listing;
  photos: ListingPhotoWithUrl[];
};

/** Keep prior signed URLs when storage paths are unchanged so poll refreshes don't flash images. */
function mergePhotosWithStableUrls(
  prev: ListingPhotoWithUrl[] | undefined,
  next: ListingPhotoWithUrl[]
): ListingPhotoWithUrl[] {
  if (!prev?.length) return next;
  const prevById = new Map(prev.map((photo) => [photo.id, photo]));
  return next.map((photo) => {
    const old = prevById.get(photo.id);
    if (!old) return photo;
    if (
      old.storage_path !== photo.storage_path ||
      old.processed_path !== photo.processed_path
    ) {
      return photo;
    }
    return {
      ...photo,
      signedUrl: old.signedUrl ?? photo.signedUrl,
      processedSignedUrl: old.processedSignedUrl ?? photo.processedSignedUrl,
      signedThumbUrl: old.signedThumbUrl ?? photo.signedThumbUrl,
      processedSignedThumbUrl:
        old.processedSignedThumbUrl ?? photo.processedSignedThumbUrl,
    };
  });
}

function listingSnapshot(listing: Listing): string {
  return [
    listing.id,
    listing.updated_at,
    listing.status,
    listing.photo_step,
    listing.title ?? "",
    listing.price ?? "",
    listing.cover_processed_path ?? "",
  ].join("|");
}

function photosSnapshot(photos: ListingPhotoWithUrl[]): string {
  return photos
    .map((p) =>
      [
        p.id,
        p.role,
        p.sort_order,
        p.storage_path,
        p.processed_path ?? "",
        p.replace_background ? "1" : "0",
      ].join(":")
    )
    .join(",");
}

type PhotoSection = "identify" | "inventory" | "listing";

const PHOTO_DND_TYPE = "application/x-ra-photo-id";
const LONG_PRESS_MS = 450;

/** Sync drag id — React state is too late for dragover during HTML5 DnD. */
let activePhotoDragId: string | null = null;

function readDraggedPhotoId(dataTransfer: DataTransfer): string {
  return (
    dataTransfer.getData(PHOTO_DND_TYPE) ||
    dataTransfer.getData("text/plain") ||
    activePhotoDragId ||
    ""
  );
}

function isPhotoDrag(dataTransfer: DataTransfer, moveArmed: boolean): boolean {
  if (moveArmed || activePhotoDragId) return true;
  return Array.from(dataTransfer.types).includes(PHOTO_DND_TYPE);
}

const LISTING_ROLES: PhotoRole[] = [
  "cover",
  "front",
  "back",
  "detail",
  "tag",
  "flaw",
];

function nextListingRole(photos: ListingPhotoWithUrl[]): PhotoRole {
  for (const role of LISTING_ROLES) {
    if (role === "flaw" || role === "tag") continue;
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
    return role === "flaw" || role === "tag" ? "Optional" : "Needed";
  }
  return `${count} added · add another`;
}

function photoFullUrl(photo: ListingPhotoWithUrl): string | undefined {
  if (photo.replace_background && photo.processedSignedUrl) {
    return photo.processedSignedUrl;
  }
  return photo.signedUrl ?? undefined;
}

function photoThumbUrl(photo: ListingPhotoWithUrl): string | undefined {
  if (photo.replace_background && photo.processedSignedUrl) {
    return (
      photo.processedSignedThumbUrl ??
      photo.processedSignedUrl ??
      undefined
    );
  }
  return photo.signedThumbUrl ?? photo.signedUrl ?? undefined;
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

export function ListingHub({ listingId, isAdmin = false }: ListingHubProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tweakOpen = searchParams.get("tweak") === "1";
  const [data, setData] = useState<ListingPayload | null>(null);
  const catalogPrefs = useSyncExternalStore(
    subscribeBgModelCatalogPrefs,
    readBgModelCatalogPrefs,
    () => EMPTY_BG_MODEL_CATALOG_PREFS
  );
  const cleanBgModelId = resolveDefaultListingModelId(
    catalogPrefs,
    FAL_BG_MODELS
  );
  const selectableCleanBgModels = scopedBgModels(FAL_BG_MODELS, catalogPrefs);
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
  const [bgPhotoId, setBgPhotoId] = useState<string | null>(null);
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

  function beginPhotoDrag(photoId: string, opts?: { showBanner?: boolean }) {
    activePhotoDragId = photoId;
    if (opts?.showBanner !== false) {
      setMovingPhotoId(photoId);
    }
  }

  function endPhotoDrag() {
    activePhotoDragId = null;
    setMovingPhotoId(null);
  }

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
  }, [setTitle, setDescription, setPrice, setFields, setDraftDirty]);

  const load = useCallback(
    async (opts?: { syncDraft?: boolean }) => {
      try {
        const res = await fetch(`/api/listings/${listingId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load listing");
        const listing = json.listing as Listing;
        const photos = json.photos as ListingPhotoWithUrl[];
        setData((prev) => {
          const mergedPhotos = mergePhotosWithStableUrls(prev?.photos, photos);
          if (
            prev &&
            listingSnapshot(prev.listing) === listingSnapshot(listing) &&
            photosSnapshot(prev.photos) === photosSnapshot(mergedPhotos)
          ) {
            return prev;
          }
          return { listing, photos: mergedPhotos };
        });
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

  function chooseCleanBgModel(next: FalBgModelId | "") {
    writeBgModelCatalogPrefs({ defaultListingModelId: next });
  }

  const closeTweak = useCallback(() => {
    if (searchParams.get("tweak") === "1") {
      const popup = searchParams.get("popup") === "1" ? "?popup=1" : "";
      router.replace(`/app/listings/${listingId}${popup}`, { scroll: false });
    }
  }, [listingId, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const boot = window.setTimeout(() => {
      if (cancelled) return;
      void load({ syncDraft: true });
      void ensureJoinToken();
    }, 0);

    // Poll so phone-companion uploads show up, but only when the tab is visible.
    // Signed URLs are reused when paths are unchanged so tiles don't flash.
    const timer = window.setInterval(() => {
      if (cancelled) return;
      if (document.visibilityState !== "visible") return;
      void load({ syncDraft: false });
    }, 8000);

    function onVisible() {
      if (cancelled) return;
      if (document.visibilityState === "visible") {
        void load({ syncDraft: false });
      }
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
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
    endPhotoDrag();
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
      // Same-group drops belong on a photo tile (reorder), not the section.
      endPhotoDrag();
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
      endPhotoDrag();
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

  async function reorderPhotoInSection(
    section: PhotoSection,
    draggedId: string,
    targetId: string,
    place: "before" | "after"
  ) {
    if (!data || draggedId === targetId) {
      endPhotoDrag();
      return;
    }

    const sectionPhotos = data.photos.filter(
      (photo) => sectionForRole(photo.role) === section
    );
    const dragged = data.photos.find((photo) => photo.id === draggedId);
    if (!dragged) return;

    // Dropping from another section onto a photo: move into this section first.
    if (sectionForRole(dragged.role) !== section) {
      await movePhotoToSection(draggedId, section);
      return;
    }

    const ids = sectionPhotos.map((photo) => photo.id);
    const from = ids.indexOf(draggedId);
    let to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;

    ids.splice(from, 1);
    to = ids.indexOf(targetId);
    if (to < 0) return;
    if (place === "after") to += 1;
    ids.splice(to, 0, draggedId);

    const unchanged = sectionPhotos.every((photo, index) => photo.id === ids[index]);
    if (unchanged) {
      endPhotoDrag();
      return;
    }

    const byId = new Map(sectionPhotos.map((photo) => [photo.id, photo]));
    // Dense contiguous orders so section display order is unambiguous.
    const orderBase = Math.min(
      ...sectionPhotos.map((photo) => photo.sort_order)
    );
    const reorderedSection = ids.map((id, index) => ({
      ...byId.get(id)!,
      sort_order: orderBase + index,
    }));

    setData((prev) => {
      if (!prev) return prev;
      const others = prev.photos.filter(
        (photo) => sectionForRole(photo.role) !== section
      );
      return {
        ...prev,
        photos: [...others, ...reorderedSection].sort(
          (a, b) => a.sort_order - b.sort_order
        ),
      };
    });
    endPhotoDrag();
    setMovingPhoto(true);
    setError(null);

    try {
      const res = await fetch(`/api/listings/${listingId}/photos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ids }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not reorder photos"
        );
      }
      setStatusMessage("Photo order updated.");
      await load({ syncDraft: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reorder photos");
      await load({ syncDraft: false });
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

  async function toggleCleanBackground(photo: ListingPhotoWithUrl) {
    const enable = !photo.replace_background;
    setBgPhotoId(photo.id);
    setError(null);
    setStatusMessage(
      enable
        ? isCurrentBgPipeline(photo.processed_path) && !cleanBgModelId
          ? "Restoring clean background…"
          : cleanBgModelId
            ? `Cleaning background with ${
                FAL_BG_MODELS.find((m) => m.id === cleanBgModelId)?.label ??
                "selected model"
              }…`
            : "Cleaning background (keeping hangers)…"
        : "Restoring original…"
    );
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photo.id}/replace-background`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replaceBackground: enable,
            run: enable,
            ...(isAdmin && cleanBgModelId && enable
              ? { modelId: cleanBgModelId }
              : {}),
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not update background"
        );
      }
      const nextPhoto = json.photo as ListingPhotoWithUrl;
      setData((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.map((p) =>
                p.id === nextPhoto.id ? nextPhoto : p
              ),
            }
          : prev
      );
      setStatusMessage(
        enable
          ? isCurrentBgPipeline(photo.processed_path)
            ? "Clean background restored."
            : "Clean background applied — hanger kept when detected."
          : "Original photo restored."
      );
      await load({ syncDraft: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update background"
      );
      setStatusMessage(null);
    } finally {
      setBgPhotoId(null);
    }
  }

  async function redoCleanBackground(photo: ListingPhotoWithUrl) {
    if (!photo.replace_background) return;
    setBgPhotoId(photo.id);
    setError(null);
    setStatusMessage(
      cleanBgModelId
        ? `Re-cleaning with ${
            FAL_BG_MODELS.find((m) => m.id === cleanBgModelId)?.label ??
            "selected model"
          }…`
        : "Re-cleaning background from original photo…"
    );
    try {
      const res = await fetch(
        `/api/listings/${listingId}/photos/${photo.id}/replace-background`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replaceBackground: true,
            run: true,
            force: true,
            ...(isAdmin && cleanBgModelId ? { modelId: cleanBgModelId } : {}),
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Could not re-clean background"
        );
      }
      const nextPhoto = json.photo as ListingPhotoWithUrl;
      setData((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.map((p) =>
                p.id === nextPhoto.id ? nextPhoto : p
              ),
            }
          : prev
      );
      setStatusMessage("Clean background redone from original.");
      await load({ syncDraft: false });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not re-clean background"
      );
      setStatusMessage(null);
    } finally {
      setBgPhotoId(null);
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
  const pageTitle = title.trim() || "Listing Draft";
  const identifyPhotos = photos.filter((p) => isIdentifyPhotoRole(p.role));
  const listingPhotos = photos.filter((p) => isPostingPhotoRole(p.role));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8">
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
            {pageTitle}
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-6">
            <h2 className="font-[family-name:var(--font-brand)] text-2xl">
              Photos ({photos.length})
            </h2>
            <p className="text-base text-[var(--muted)]">
              Drop image files onto a section to upload, or use Add to choose from
              this computer. Drag photos to reorder within a group, or long-press
              and drop onto another section to move. Use the QR code for guided
              shooting on your phone.
            </p>

            {movingPhotoId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3">
                <p className="text-base font-semibold text-[var(--accent)]">
                  Moving photo — drop on another photo to reorder, or onto a
                  different section to move it
                </p>
                <button
                  type="button"
                  className="text-base font-semibold text-[var(--accent)] underline"
                  onClick={() => endPhotoDrag()}
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
              onReorderPhoto={(draggedId, targetId, place) =>
                void reorderPhotoInSection("identify", draggedId, targetId, place)
              }
              onBeginMove={(photoId) => beginPhotoDrag(photoId)}
              onCancelMove={endPhotoDrag}
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
              {isAdmin ? (
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span className="font-semibold text-[var(--foreground)]">
                      Clean bg model (admin)
                    </span>
                    <select
                      value={cleanBgModelId}
                      onChange={(e) => {
                        const next = e.target.value;
                        chooseCleanBgModel(
                          next && isFalBgModelId(next) ? next : ""
                        );
                      }}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)]"
                    >
                      <option value="">Production default (hanger-safe)</option>
                      {selectableCleanBgModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.label} · {model.approxCost}
                        </option>
                      ))}
                    </select>
                  </label>
                  <a
                    href={`/app/admin/bg-lab?listingId=${encodeURIComponent(listingId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-base font-semibold text-[var(--accent)] hover:underline"
                  >
                    Open bg lab →
                  </a>
                </div>
              ) : null}
              <PhotoGroup
                title="Photos shoppers will see"
                badge="Listing photos · posted"
                description="Cover, front, back, details, and flaws for the marketplace listing. You can add multiple photos of each type. Use Clean bg on a shot to swap the backdrop for white while keeping hangers intact."
                photos={listingPhotos}
                empty="No listing photos yet — drop images here or start with a clean cover shot."
                section="listing"
                onAdd={() => setPickListingRole(true)}
                onDelete={(photoId) => void deletePhoto(photoId)}
                onToggleCleanBackground={(photo) =>
                  void toggleCleanBackground(photo)
                }
                onRedoCleanBackground={(photo) => void redoCleanBackground(photo)}
                onPreview={setPreviewPhoto}
                onDropFiles={(files) => void uploadFilesToSection(files, "listing")}
                onDropPhoto={(photoId) =>
                  void movePhotoToSection(photoId, "listing")
                }
                onReorderPhoto={(draggedId, targetId, place) =>
                  void reorderPhotoInSection("listing", draggedId, targetId, place)
                }
                onBeginMove={(photoId) => beginPhotoDrag(photoId)}
                onCancelMove={endPhotoDrag}
                movingPhotoId={movingPhotoId}
                dragOver={dragOverSection === "listing"}
                onDragOverChange={(over) =>
                  setDragOverSection(over ? "listing" : null)
                }
                deletingPhotoId={deletingPhotoId}
                bgPhotoId={bgPhotoId}
                labPhotoHref={
                  isAdmin
                    ? (photoId) =>
                        `/app/admin/bg-lab?photoId=${encodeURIComponent(photoId)}`
                    : undefined
                }
                disabled={
                  uploading ||
                  Boolean(deletingPhotoId) ||
                  movingPhoto
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
              On this computer, drop files onto sections, choose files with Add,
              or long-press to move photos — the camera stays on your phone via
              the companion QR.
            </p>
            <a
              href={`/api/listings/${listingId}/photos/zip`}
              className="block max-w-sm"
            >
              <BigButton variant="secondary">Download listing photos ZIP</BigButton>
            </a>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-6">
            <h2 className="font-[family-name:var(--font-brand)] text-2xl">
              Finish with AI
            </h2>
            <p className="text-base text-[var(--muted)]">
              Fills the editable fields below from your photos. Listing photos
              marked Clean bg also get a white studio backdrop (hangers kept).
              You can change anything afterward.
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

          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 sm:p-5">
            <div>
              <h2 className="font-[family-name:var(--font-brand)] text-xl sm:text-2xl">
                {PLATFORM_LABELS[platform]} listing fields
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Same fields you&apos;ll enter on {PLATFORM_LABELS[platform]}. Use{" "}
                <span className="font-semibold text-[var(--foreground)]">
                  Tweak listing fields
                </span>{" "}
                in the extension for a larger editor while posting.
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
                onRewriteDescription={() => void rewriteDescription()}
                rewritingDescription={rewritingDescription}
                onSubmit={(e) => void saveDraft(e)}
                footer={
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
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
        </div>

        <aside className="order-first lg:sticky lg:top-4 lg:order-none">
          {joinUrl ? (
            <QrPanel
              compact
              value={joinUrl}
              title="Phone Companion"
              hint="Scan to open the companion on your phone. This QR stays valid."
              code={listing.join_code}
            />
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white p-3 text-center text-sm text-[var(--muted)]">
              Preparing QR…
            </div>
          )}
        </aside>
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
  onToggleCleanBackground,
  onRedoCleanBackground,
  onPreview,
  onDropFiles,
  onDropPhoto,
  onReorderPhoto,
  onBeginMove,
  onCancelMove,
  movingPhotoId,
  promotePhotoId,
  dragOver,
  onDragOverChange,
  deletingPhotoId,
  bgPhotoId,
  labPhotoHref,
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
  onToggleCleanBackground?: (photo: ListingPhotoWithUrl) => void;
  onRedoCleanBackground?: (photo: ListingPhotoWithUrl) => void;
  onPreview: (photo: ListingPhotoWithUrl) => void;
  onDropFiles: (files: File[]) => void;
  onDropPhoto: (photoId: string) => void;
  onReorderPhoto: (
    draggedId: string,
    targetId: string,
    place: "before" | "after"
  ) => void;
  onBeginMove: (photoId: string) => void;
  onCancelMove: () => void;
  movingPhotoId?: string | null;
  promotePhotoId?: string | null;
  dragOver?: boolean;
  onDragOverChange: (over: boolean) => void;
  deletingPhotoId?: string | null;
  bgPhotoId?: string | null;
  labPhotoHref?: (photoId: string) => string;
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
    const hasPhoto = isPhotoDrag(e.dataTransfer, moveArmed);
    if (!hasFiles && !hasPhoto) return;
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

    // Tile drops handle reorder; don't treat them as section moves.
    const onPhotoTile = (e.target as HTMLElement | null)?.closest?.(
      "[data-photo-tile]"
    );
    if (onPhotoTile) return;

    const photoId = readDraggedPhotoId(e.dataTransfer) || movingPhotoId || "";
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
            : "Drop images here to upload · drag to reorder · tap a photo to enlarge"}
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
              cleaningBg={bgPhotoId === photo.id}
              moving={movingPhotoId === photo.id}
              movingPhotoId={movingPhotoId ?? null}
              moveArmed={moveArmed}
              disabled={disabled || bgPhotoId === photo.id}
              onPreview={() => onPreview(photo)}
              onUseInListing={
                onUseInListing
                  ? () => onUseInListing(photo.id)
                  : undefined
              }
              onToggleCleanBackground={
                onToggleCleanBackground
                  ? () => onToggleCleanBackground(photo)
                  : undefined
              }
              onRedoCleanBackground={
                onRedoCleanBackground && photo.replace_background
                  ? () => onRedoCleanBackground(photo)
                  : undefined
              }
              labHref={labPhotoHref?.(photo.id)}
              onDelete={() => onDelete(photo.id)}
              onBeginMove={() => onBeginMove(photo.id)}
              onCancelMove={onCancelMove}
              onReorder={(draggedId, place) =>
                onReorderPhoto(draggedId, photo.id, place)
              }
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
  cleaningBg,
  moving,
  movingPhotoId,
  moveArmed,
  disabled,
  onPreview,
  onUseInListing,
  onToggleCleanBackground,
  onRedoCleanBackground,
  labHref,
  onDelete,
  onBeginMove,
  onCancelMove,
  onReorder,
}: {
  photo: ListingPhotoWithUrl;
  deleting: boolean;
  promoting: boolean;
  cleaningBg?: boolean;
  moving: boolean;
  movingPhotoId: string | null;
  moveArmed: boolean;
  disabled?: boolean;
  onPreview: () => void;
  onUseInListing?: () => void;
  onToggleCleanBackground?: () => void;
  onRedoCleanBackground?: () => void;
  labHref?: string;
  onDelete: () => void;
  onBeginMove: () => void;
  onCancelMove: () => void;
  onReorder: (draggedId: string, place: "before" | "after") => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressTriggered = useRef(false);
  const [draggable, setDraggable] = useState(true);
  const [dropEdge, setDropEdge] = useState<"before" | "after" | null>(null);

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
    // Touch needs a long-press to arm move / reorder mode.
    if (e.pointerType !== "mouse") {
      setDraggable(false);
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
  }

  function handlePointerUp() {
    clearLongPress();
  }

  function handlePointerCancel() {
    clearLongPress();
  }

  function handleDragStart(e: DragEvent<HTMLLIElement>) {
    if (disabled) {
      e.preventDefault();
      return;
    }
    // Sync id first so drop targets work before React re-renders.
    activePhotoDragId = photo.id;
    e.dataTransfer.setData(PHOTO_DND_TYPE, photo.id);
    e.dataTransfer.setData("text/plain", photo.id);
    e.dataTransfer.effectAllowed = "move";
    // Don't open the move banner on desktop drag — layout shift cancels DnD.
  }

  function handleDragEnd() {
    setDropEdge(null);
    setDraggable(true);
    activePhotoDragId = null;
    onCancelMove();
  }

  function edgeFromEvent(e: { clientX: number; currentTarget: Element }) {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? "before" : "after";
  }

  function handleTileDragOver(e: DragEvent<HTMLLIElement>) {
    if (disabled || moving) return;
    if (!isPhotoDrag(e.dataTransfer, moveArmed)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropEdge(edgeFromEvent(e));
  }

  function handleTileDragLeave(e: DragEvent<HTMLLIElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDropEdge(null);
  }

  function handleTileDrop(e: DragEvent<HTMLLIElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || moving) return;
    const draggedId =
      readDraggedPhotoId(e.dataTransfer) || movingPhotoId || "";
    const place = dropEdge || edgeFromEvent(e);
    setDropEdge(null);
    if (!draggedId || draggedId === photo.id) return;
    onReorder(draggedId, place);
  }

  return (
    <li
      data-photo-tile={photo.id}
      draggable={!disabled && draggable}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleTileDragOver}
      onDragLeave={handleTileDragLeave}
      onDrop={handleTileDrop}
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
        if (moveArmed && movingPhotoId && movingPhotoId !== photo.id) {
          e.stopPropagation();
          onReorder(movingPhotoId, "before");
          return;
        }
        if (moveArmed) {
          return;
        }
        e.stopPropagation();
        onPreview();
      }}
      className={`relative overflow-hidden rounded-xl ring-1 select-none ${
        moving || promoting
          ? "ring-2 ring-[var(--accent)]"
          : dropEdge
            ? "ring-2 ring-[var(--accent)]"
            : "ring-[var(--border)]"
      } ${moving ? "opacity-80" : ""} ${disabled && !cleaningBg ? "opacity-60" : ""} ${
        cleaningBg
          ? "pointer-events-none"
          : disabled
            ? ""
            : "cursor-grab active:cursor-grabbing"
      }`}
      style={{ touchAction: "manipulation" }}
      title="Drag to reorder · long-press on phone to move · tap to enlarge"
      aria-busy={cleaningBg || undefined}
    >
      {dropEdge === "before" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-2 left-0 z-10 w-1 -translate-x-1/2 -ml-1.5 rounded-full bg-[var(--accent)]"
        />
      ) : null}
      {dropEdge === "after" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-2 right-0 z-10 w-1 translate-x-1/2 -mr-1.5 rounded-full bg-[var(--accent)]"
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoThumbUrl(photo)}
        alt={photoRoleLabel(photo.role)}
        loading="lazy"
        decoding="async"
        className="pointer-events-none aspect-square w-full object-cover"
        draggable={false}
        onError={(e) => {
          const full = photoFullUrl(photo);
          if (full && e.currentTarget.src !== full) {
            e.currentTarget.src = full;
          }
        }}
      />
      {cleaningBg ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-white/65 backdrop-blur-[1px]"
          aria-hidden
        >
          <span className="rounded-md bg-white/90 px-2 py-1 text-sm font-semibold text-[var(--foreground)] shadow-sm">
            Working…
          </span>
        </div>
      ) : null}
      <div
        className="space-y-1 bg-white px-2 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 truncate text-sm text-[var(--muted)]">
          {photoRoleLabel(photo.role)}
          {moving ? " · moving" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
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
          {onToggleCleanBackground ? (
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCleanBackground();
              }}
              aria-pressed={Boolean(photo.replace_background)}
              title={
                photo.replace_background
                  ? "Restore original background"
                  : "Replace background with white; keeps hangers"
              }
              className={`rounded-md border px-2 py-1 text-sm font-semibold transition disabled:opacity-50 ${
                photo.replace_background
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {cleaningBg
                ? "Clean bg…"
                : photo.replace_background
                  ? "Clean bg on"
                  : "Clean bg"}
            </button>
          ) : null}
          {onRedoCleanBackground ? (
            <button
              type="button"
              disabled={disabled || cleaningBg}
              onClick={(e) => {
                e.stopPropagation();
                onRedoCleanBackground();
              }}
              title="Re-run clean background from the original photo"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              Redo
            </button>
          ) : null}
          {labHref ? (
            <a
              href={labHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              title="Open this photo in the background model lab"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
            >
              Lab
            </a>
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

  const src = photoFullUrl(photo);

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
