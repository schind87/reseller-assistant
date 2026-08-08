import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
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
  type ListingStatus,
  type PhotoRole,
  type Platform,
  type StructuredFields,
  type Workspace,
} from "@/lib/types";

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

export async function listListings(userId: string): Promise<Listing[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listListings: ${error.message}`);
  return (data ?? []) as Listing[];
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
        structured_fields: emptyStructuredFields(),
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
  ttlMinutes = 60
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

export async function consumeJoinToken(
  token: string
): Promise<{ listingId: string; purpose: JoinTokenPurpose } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_join_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`consumeJoinToken: ${error.message}`);
  if (!data) return null;

  const row = data as ListingJoinToken;
  if (row.consumed_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  const { error: updateError } = await supabase
    .from("listing_join_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("consumed_at", null);

  if (updateError) throw new Error(`consumeJoinToken update: ${updateError.message}`);

  return { listingId: row.listing_id, purpose: row.purpose };
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

const ROLE_SORT: Record<PhotoRole, number> = {
  brand_tag: 0,
  care_tag: 1,
  id_tag: 2,
  inventory: 3,
  cover: 4,
  front: 5,
  back: 6,
  detail: 7,
  flaw: 8,
};

export async function addPhoto(params: {
  listingId: string;
  role: PhotoRole;
  storagePath: string;
  processedPath?: string | null;
}): Promise<ListingPhoto> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("listing_photos")
    .insert({
      listing_id: params.listingId,
      role: params.role,
      storage_path: params.storagePath,
      processed_path: params.processedPath ?? null,
      sort_order: ROLE_SORT[params.role] ?? 99,
    })
    .select("*")
    .single();

  if (error) throw new Error(`addPhoto: ${error.message}`);
  return data as ListingPhoto;
}

export async function updatePhoto(
  photoId: string,
  patch: Partial<Pick<ListingPhoto, "processed_path" | "storage_path">>
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

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("listing-photos")
      .remove(paths);
    if (storageError) {
      console.error("deleteListingPhoto storage:", storageError.message);
    }
  }

  const { error } = await supabase
    .from("listing_photos")
    .delete()
    .eq("id", photoId)
    .eq("listing_id", listingId);

  if (error) throw new Error(`deleteListingPhoto: ${error.message}`);

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

export async function getSignedPhotoUrl(
  storagePath: string,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath) return null;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("listing-photos")
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    console.error("getSignedPhotoUrl:", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function uploadListingPhoto(
  listingId: string,
  role: PhotoRole,
  bytes: ArrayBuffer | Buffer,
  contentType = "image/jpeg"
): Promise<{ storagePath: string; photo: ListingPhoto }> {
  const supabase = createAdminClient();
  const storagePath = `${listingId}/${role}-${uuidv4()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("listing-photos")
    .upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`uploadListingPhoto: ${uploadError.message}`);
  }

  const photo = await addPhoto({
    listingId,
    role,
    storagePath,
  });

  return { storagePath, photo };
}

export async function markPosted(id: string): Promise<Listing> {
  return updateListing(id, {
    status: "posted",
    posted_at: new Date().toISOString(),
  });
}

export function appUrl(path = "", origin?: string | null): string {
  const base = (
    origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Prefer the browser Origin header so QR links work on vercel.app before custom DNS. */
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
