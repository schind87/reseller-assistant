import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { getProfileById } from "@/lib/auth/otp";
import { CANONICAL_PRODUCTION_ORIGIN } from "@/lib/canonical-host";
import { bakeExifOrientation } from "@/lib/image-orient";
import { composeSmokePetNotes } from "@/lib/seller-preferences";
import {
  getSignedPhotoUrl,
  getSignedPhotoUrls,
  LISTING_GRID_THUMB,
  removePhotoObjects,
  uploadPhotoObject,
} from "@/lib/photo-storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlatformListingSchema } from "@/lib/listing-schemas";
import {
  emptyIdentifiedAttrs,
  emptyStructuredFields,
  type IdentifiedAttrs,
  type JoinTokenPurpose,
  type Listing,
  type ListingJoinToken,
  type ListingPhoto,
  type ListingPhotoWithUrl,
  type ListingStatus,
  type PhotoRole,
  type Platform,
  type StructuredFields,
  type Workspace,
  isPostingPhotoRole,
} from "@/lib/types";

export type ListingWithThumb = Listing & {
  thumbUrl: string | null;
  hasListingPhoto: boolean;
};

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += JOIN_CODE_CHARS[bytes[i]! % JOIN_CODE_CHARS.length];
  }
  return code;
}

function generateJoinToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function getWorkspace(): Promise<Workspace> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("workspace")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getWorkspace: ${error.message}`);

  if (data) return data as Workspace;

  const { data: created, error: createError } = await supabase
    .from("workspace")
    .insert({
      name: "Household",
      default_smoke_pet_notes: "From a smoke-free, pet-friendly home.",
    })
    .select("*")
    .single();

  if (createError) throw new Error(`getWorkspace create: ${createError.message}`);
  return created as Workspace;
}

export async function listListings(userId: string): Promise<ListingWithThumb[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listListings: ${error.message}`);
  const listings = (data ?? []) as Listing[];
  if (listings.length === 0) return [];

  const listingIds = listings.map((l) => l.id);
  const { data: photos, error: photosError } = await supabase
    .from("listing_photos")
    .select(
      "id, listing_id, role, storage_path, processed_path, replace_background, sort_order, created_at"
    )
    .in("listing_id", listingIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (photosError) throw new Error(`listListings photos: ${photosError.message}`);

  const photosByListing = new Map<string, ListingPhoto[]>();
  for (const raw of photos ?? []) {
    const photo = raw as ListingPhoto;
    const list = photosByListing.get(photo.listing_id) ?? [];
    list.push(photo);
    photosByListing.set(photo.listing_id, list);
  }

  const pathByListing = new Map<string, string | null>();
  const pathsToSign: string[] = [];
  for (const listing of listings) {
    const path = pickListingThumbPath(
      listing,
      photosByListing.get(listing.id) ?? []
    );
    pathByListing.set(listing.id, path);
    if (path) pathsToSign.push(path);
  }

  const signed = await getSignedPhotoUrls(pathsToSign, 3600, {
    width: 640,
    height: 640,
    // Contain keeps the full cover; the list frames by marketplace aspect.
    resize: "contain",
    quality: 72,
  });
  const missingThumbs = pathsToSign.filter((path) => !signed.get(path));
  if (missingThumbs.length > 0) {
    const fallback = await getSignedPhotoUrls(missingThumbs, 3600);
    for (const path of missingThumbs) {
      signed.set(path, fallback.get(path) ?? null);
    }
  }
  return listings.map((listing) => {
    const path = pathByListing.get(listing.id) ?? null;
    const listingPhotos = photosByListing.get(listing.id) ?? [];
    return {
      ...listing,
      thumbUrl: path ? (signed.get(path) ?? null) : null,
      hasListingPhoto: listingPhotos.some((photo) =>
        isPostingPhotoRole(photo.role)
      ),
    };
  });
}

/** Cover first, else first listing photo by page order, else any photo. */
function pickListingThumbPath(
  listing: Listing,
  photos: ListingPhoto[]
): string | null {
  const ordered = [...photos].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
  const listingPhotos = ordered.filter((p) => isPostingPhotoRole(p.role));
  const cover =
    listingPhotos.find((p) => p.role === "cover") ??
    ordered.find((p) => p.role === "cover");
  const pick = cover ?? listingPhotos[0] ?? ordered[0] ?? null;
  if (!pick) return null;

  if (
    pick.role === "cover" &&
    listing.cover_processed_path
  ) {
    return listing.cover_processed_path;
  }
  if (pick.replace_background && pick.processed_path) {
    return pick.processed_path;
  }
  return pick.storage_path;
}

export async function getListing(id: string): Promise<Listing | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getListing: ${error.message}`);
  return (data as Listing | null) ?? null;
}

export async function getListingWithPhotos(id: string): Promise<{
  listing: Listing;
  photos: ListingPhoto[];
} | null> {
  const listing = await getListing(id);
  if (!listing) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .eq("listing_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getListingWithPhotos: ${error.message}`);

  return {
    listing,
    photos: (data ?? []) as ListingPhoto[],
  };
}

export async function createListing(
  platform: Platform,
  userId: string
): Promise<Listing> {
  const workspace = await getWorkspace();
  const supabase = createAdminClient();
  const profile = await getProfileById(userId).catch(() => null);
  const structured_fields = emptyStructuredFields();
  if (profile?.listing_prefs_completed_at) {
    structured_fields.smokePetNotes = composeSmokePetNotes(
      profile.listing_preferences
    );
  } else if (workspace.default_smoke_pet_notes) {
    structured_fields.smokePetNotes = workspace.default_smoke_pet_notes;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const join_code = generateJoinCode(6);
    const { data, error } = await supabase
      .from("listings")
      .insert({
        workspace_id: workspace.id,
        user_id: userId,
        platform,
        status: "drafting_photos",
        join_code,
        photo_step: 0,
        title: null,
        description: null,
        price: null,
        structured_fields,
        identified_attrs: emptyIdentifiedAttrs("Not identified yet."),
        cover_processed_path: null,
      })
      .select("*")
      .single();

    if (!error && data) return data as Listing;
    lastError = new Error(error?.message ?? "createListing failed");
    if (error?.code !== "23505") break;
  }

  throw lastError ?? new Error("createListing failed");
}

export async function createJoinToken(
  listingId: string,
  purpose: JoinTokenPurpose,
  ttlMinutes = 60 * 24 * 7
): Promise<ListingJoinToken> {
  const supabase = createAdminClient();
  const token = generateJoinToken();
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("listing_join_tokens")
    .insert({
      listing_id: listingId,
      token,
      purpose,
      expires_at: expires,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createJoinToken: ${error.message}`);
  return data as ListingJoinToken;
}

/** Reuse an unexpired QR/join link so the same code keeps working across scans. */
export async function getOrCreateJoinToken(
  listingId: string,
  purpose: JoinTokenPurpose,
  ttlMinutes = 60 * 24 * 7
): Promise<ListingJoinToken> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error } = await supabase
    .from("listing_join_tokens")
    .select("*")
    .eq("listing_id", listingId)
    .eq("purpose", purpose)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getOrCreateJoinToken: ${error.message}`);
  if (existing) return existing as ListingJoinToken;

  return createJoinToken(listingId, purpose, ttlMinutes);
}

/** Validate a join token without burning it — QR links are reusable until they expire. */
export async function redeemJoinToken(
  token: string
): Promise<{ listingId: string; purpose: JoinTokenPurpose } | null> {
  const row = await findValidJoinToken(token);
  if (!row) return null;
  return { listingId: row.listing_id, purpose: row.purpose };
}

export async function consumeJoinToken(
  token: string
): Promise<{ listingId: string; purpose: JoinTokenPurpose } | null> {
  return redeemJoinToken(token);
}

export async function findValidJoinToken(
  token: string
): Promise<ListingJoinToken | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_join_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`findValidJoinToken: ${error.message}`);
  if (!data) return null;

  const row = data as ListingJoinToken;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return row;
}

export async function findListingByJoinCode(
  joinCode: string
): Promise<Listing | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("join_code", joinCode.toUpperCase())
    .maybeSingle();

  if (error) throw new Error(`findListingByJoinCode: ${error.message}`);
  return (data as Listing | null) ?? null;
}

export type ListingUpdate = Partial<{
  status: ListingStatus;
  photo_step: number;
  title: string | null;
  description: string | null;
  price: number | null;
  structured_fields: StructuredFields;
  identified_attrs: IdentifiedAttrs | null;
  cover_processed_path: string | null;
  posted_at: string | null;
}>;

export async function updateListing(
  id: string,
  patch: ListingUpdate
): Promise<Listing> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`updateListing: ${error.message}`);
  return data as Listing;
}

export async function deleteListing(id: string): Promise<void> {
  const result = await getListingWithPhotos(id);
  if (!result) {
    throw new Error("Listing not found");
  }

  const supabase = createAdminClient();
  const storagePaths = result.photos
    .flatMap((photo) => [photo.storage_path, photo.processed_path])
    .filter((path): path is string => Boolean(path));

  if (result.listing.cover_processed_path) {
    storagePaths.push(result.listing.cover_processed_path);
  }

  const uniquePaths = [...new Set(storagePaths)];
  if (uniquePaths.length > 0) {
    await removePhotoObjects(uniquePaths);
  }

  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw new Error(`deleteListing: ${error.message}`);
}

const ROLE_SORT: Record<PhotoRole, number> = {
  brand_tag: 0,
  care_tag: 1,
  id_tag: 2,
  inventory: 3,
  cover: 4,
  front: 5,
  back: 6,
  detail: 7,
  tag: 8,
  flaw: 9,
};

export async function addPhoto(params: {
  listingId: string;
  role: PhotoRole;
  storagePath: string;
  processedPath?: string | null;
}): Promise<ListingPhoto> {
  const supabase = createAdminClient();
  const { count, error: countError } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", params.listingId)
    .eq("role", params.role);

  if (countError) throw new Error(`addPhoto count: ${countError.message}`);

  const base = (ROLE_SORT[params.role] ?? 99) * 1000;
  const sortOrder = base + (count ?? 0);

  const { data, error } = await supabase
    .from("listing_photos")
    .insert({
      listing_id: params.listingId,
      role: params.role,
      storage_path: params.storagePath,
      processed_path: params.processedPath ?? null,
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(`addPhoto: ${error.message}`);
  return data as ListingPhoto;
}

export async function updatePhoto(
  photoId: string,
  patch: Partial<
    Pick<
      ListingPhoto,
      | "processed_path"
      | "storage_path"
      | "role"
      | "sort_order"
      | "replace_background"
    >
  >
): Promise<ListingPhoto> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .update(patch)
    .eq("id", photoId)
    .select("*")
    .single();

  if (error) throw new Error(`updatePhoto: ${error.message}`);
  return data as ListingPhoto;
}

export async function moveListingPhoto(
  listingId: string,
  photoId: string,
  role: PhotoRole
): Promise<ListingPhoto> {
  const photo = await getListingPhoto(listingId, photoId);
  if (!photo) {
    throw new Error("Photo not found");
  }
  if (photo.role === role) {
    return photo;
  }

  const supabase = createAdminClient();
  const { count, error: countError } = await supabase
    .from("listing_photos")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .eq("role", role);

  if (countError) throw new Error(`moveListingPhoto count: ${countError.message}`);

  const base = (ROLE_SORT[role] ?? 99) * 1000;
  const updated = await updatePhoto(photoId, {
    role,
    sort_order: base + (count ?? 0),
  });

  const listing = await getListing(listingId);
  if (
    listing?.cover_processed_path &&
    photo.role === "cover" &&
    role !== "cover" &&
    listing.cover_processed_path === photo.processed_path
  ) {
    await updateListing(listingId, { cover_processed_path: null });
  }

  return updated;
}

/** Reassign sort_order within a set of photos (same listing). */
export async function reorderListingPhotos(
  listingId: string,
  orderedIds: string[]
): Promise<ListingPhoto[]> {
  if (orderedIds.length < 2) {
    throw new Error("Need at least two photos to reorder");
  }

  const uniqueIds = [...new Set(orderedIds)];
  if (uniqueIds.length !== orderedIds.length) {
    throw new Error("Duplicate photo ids in reorder list");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .eq("listing_id", listingId)
    .in("id", orderedIds);

  if (error) throw new Error(`reorderListingPhotos: ${error.message}`);
  const photos = (data ?? []) as ListingPhoto[];
  if (photos.length !== orderedIds.length) {
    throw new Error("One or more photos were not found on this listing");
  }

  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const orderBase = Math.min(...photos.map((photo) => photo.sort_order));

  const updated: ListingPhoto[] = [];
  for (let i = 0; i < orderedIds.length; i += 1) {
    const id = orderedIds[i];
    const current = byId.get(id);
    if (!current) throw new Error("Photo not found");
    const nextOrder = orderBase + i;
    if (current.sort_order === nextOrder) {
      updated.push(current);
      continue;
    }
    updated.push(await updatePhoto(id, { sort_order: nextOrder }));
  }

  return updated.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getListingPhoto(
  listingId: string,
  photoId: string
): Promise<ListingPhoto | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .select("*")
    .eq("id", photoId)
    .eq("listing_id", listingId)
    .maybeSingle();

  if (error) throw new Error(`getListingPhoto: ${error.message}`);
  return (data as ListingPhoto | null) ?? null;
}

/** Keep the original private photo and add a listing-role copy that shoppers can see. */
export async function duplicatePhotoAsListingRole(
  listingId: string,
  photoId: string,
  role: PhotoRole
): Promise<ListingPhoto> {
  if (!isPostingPhotoRole(role)) {
    throw new Error(
      "Choose a listing photo type (cover, front, back, detail, brand/tag, or flaw)."
    );
  }

  const photo = await getListingPhoto(listingId, photoId);
  if (!photo) {
    throw new Error("Photo not found");
  }

  return addPhoto({
    listingId,
    role,
    storagePath: photo.storage_path,
    processedPath: photo.processed_path,
  });
}

export async function deleteListingPhoto(
  listingId: string,
  photoId: string
): Promise<ListingPhoto> {
  const photo = await getListingPhoto(listingId, photoId);
  if (!photo) {
    throw new Error("Photo not found");
  }

  const supabase = createAdminClient();
  const paths = [photo.storage_path, photo.processed_path].filter(
    (path): path is string => Boolean(path)
  );

  const { error } = await supabase
    .from("listing_photos")
    .delete()
    .eq("id", photoId)
    .eq("listing_id", listingId);

  if (error) throw new Error(`deleteListingPhoto: ${error.message}`);

  const { data: remaining, error: remainingError } = await supabase
    .from("listing_photos")
    .select("storage_path, processed_path")
    .eq("listing_id", listingId);

  if (remainingError) {
    console.error("deleteListingPhoto remaining:", remainingError.message);
  } else {
    const orphans = paths.filter(
      (path) =>
        !(remaining ?? []).some(
          (row) => row.storage_path === path || row.processed_path === path
        )
    );
    if (orphans.length > 0) {
      await removePhotoObjects(orphans);
    }
  }

  const listing = await getListing(listingId);
  if (
    listing?.cover_processed_path &&
    (photo.role === "cover" ||
      listing.cover_processed_path === photo.processed_path)
  ) {
    await updateListing(listingId, { cover_processed_path: null });
  }

  return photo;
}

export { getSignedPhotoUrl, getSignedPhotoUrls };
export type { PhotoSignTransform } from "@/lib/photo-storage";

/** Attach signed original + processed URLs (full + grid thumbs) in parallel. */
export async function withSignedPhotoUrls(
  photos: ListingPhoto[],
  expiresIn = 3600
): Promise<ListingPhotoWithUrl[]> {
  const paths = photos.flatMap((photo) =>
    [photo.storage_path, photo.processed_path].filter(
      (p): p is string => Boolean(p)
    )
  );
  const [signed, thumbs] = await Promise.all([
    getSignedPhotoUrls(paths, expiresIn),
    getSignedPhotoUrls(paths, expiresIn, LISTING_GRID_THUMB),
  ]);
  return photos.map((photo) => ({
    ...photo,
    signedUrl: signed.get(photo.storage_path) ?? null,
    processedSignedUrl: photo.processed_path
      ? (signed.get(photo.processed_path) ?? null)
      : null,
    signedThumbUrl: thumbs.get(photo.storage_path) ?? null,
    processedSignedThumbUrl: photo.processed_path
      ? (thumbs.get(photo.processed_path) ?? null)
      : null,
  }));
}

export async function uploadListingPhoto(
  listingId: string,
  role: PhotoRole,
  bytes: ArrayBuffer | Buffer,
  contentType = "image/jpeg"
): Promise<{ storagePath: string; photo: ListingPhoto }> {
  const storagePath = `${listingId}/${role}-${uuidv4()}.jpg`;
  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  // Bake EXIF Orientation so storage pixels match how browsers display the photo.
  const oriented = await bakeExifOrientation(input);
  void contentType;

  try {
    await uploadPhotoObject({
      path: storagePath,
      bytes: oriented.buffer,
      contentType: oriented.contentType,
      upsert: false,
    });
  } catch (err) {
    throw new Error(
      `uploadListingPhoto: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const photo = await addPhoto({
    listingId,
    role,
    storagePath,
  });

  return { storagePath, photo };
}

/**
 * Upload an EXIF-baked JPEG for fal inference and return a short-lived signed URL.
 * Callers should delete `storagePath` when finished.
 */
export async function uploadOrientedFalSource(
  bytes: Buffer
): Promise<{
  url: string;
  storagePath: string;
  width: number;
  height: number;
  buffer: Buffer;
}> {
  const oriented = await bakeExifOrientation(bytes);
  const storagePath = `fal-orient/${uuidv4()}.jpg`;
  try {
    await uploadPhotoObject({
      path: storagePath,
      bytes: oriented.buffer,
      contentType: oriented.contentType,
      upsert: false,
    });
  } catch (err) {
    throw new Error(
      `uploadOrientedFalSource: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  const url = await getSignedPhotoUrl(storagePath, 3600);
  if (!url) {
    throw new Error("uploadOrientedFalSource: could not sign temp image");
  }
  return {
    url,
    storagePath,
    width: oriented.width,
    height: oriented.height,
    buffer: oriented.buffer,
  };
}

export async function removeStoragePaths(paths: string[]): Promise<void> {
  await removePhotoObjects(paths);
}

/**
 * Overwrite a listing photo's original file (e.g. after aspect crop).
 * Clears any cleaned version so Clean bg must be re-run from the new original.
 */
export async function replaceListingPhotoOriginal(
  listingId: string,
  photoId: string,
  bytes: ArrayBuffer | Buffer,
  contentType = "image/jpeg"
): Promise<ListingPhoto> {
  const photo = await getListingPhoto(listingId, photoId);
  if (!photo) {
    throw new Error("Photo not found");
  }

  const input = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const oriented = await bakeExifOrientation(input);
  void contentType;
  const storagePath = `${listingId}/${photo.role}-${uuidv4()}.jpg`;

  try {
    await uploadPhotoObject({
      path: storagePath,
      bytes: oriented.buffer,
      contentType: oriented.contentType,
      upsert: false,
    });
  } catch (err) {
    throw new Error(
      `replaceListingPhotoOriginal: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const oldPaths = [photo.storage_path, photo.processed_path].filter(
    (path): path is string => Boolean(path)
  );

  const updated = await updatePhoto(photoId, {
    storage_path: storagePath,
    processed_path: null,
    replace_background: false,
  });

  const listing = await getListing(listingId);
  if (
    listing?.cover_processed_path &&
    (photo.role === "cover" ||
      listing.cover_processed_path === photo.processed_path)
  ) {
    await updateListing(listingId, { cover_processed_path: null });
  }

  if (oldPaths.length > 0) {
    await removePhotoObjects(oldPaths);
  }

  return updated;
}

export async function markPosted(id: string): Promise<Listing> {
  return updateListing(id, {
    status: "posted",
    posted_at: new Date().toISOString(),
  });
}

export function appUrl(path = "", origin?: string | null): string {
  const fallback =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? CANONICAL_PRODUCTION_ORIGIN
      : "http://localhost:3000");
  const base = (origin || fallback).replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Prefer the request host so preview/deployment URLs keep working. Production aliases redirect to reseller.mvfeed.us first. */
export function requestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return null;
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function getStoredListingSchema(
  platform: Platform
): Promise<PlatformListingSchema | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_listing_schemas")
    .select("*")
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw new Error(`getStoredListingSchema: ${error.message}`);
  if (!data) return null;
  return {
    platform: data.platform as Platform,
    version: data.version as number,
    sellPageUrl: data.sell_page_url as string,
    source: data.source as "seed" | "extension",
    syncedAt: (data.synced_at as string | null) ?? null,
    fields: data.fields as PlatformListingSchema["fields"],
  };
}

export async function upsertListingSchema(
  schema: PlatformListingSchema
): Promise<PlatformListingSchema> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("platform_listing_schemas")
    .upsert(
      {
        platform: schema.platform,
        version: schema.version,
        sell_page_url: schema.sellPageUrl,
        source: schema.source,
        fields: schema.fields,
        synced_at: schema.syncedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" }
    )
    .select("*")
    .single();
  if (error) throw new Error(`upsertListingSchema: ${error.message}`);
  return {
    platform: data.platform as Platform,
    version: data.version as number,
    sellPageUrl: data.sell_page_url as string,
    source: data.source as "seed" | "extension",
    syncedAt: (data.synced_at as string | null) ?? null,
    fields: data.fields as PlatformListingSchema["fields"],
  };
}
